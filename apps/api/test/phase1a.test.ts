import { loadConfig } from "@workspace/config"
import { createInMemoryPhase1aStore, embedTextStubHashV1 } from "@workspace/db"
import { describe, expect, it } from "vitest"

import { buildApi } from "../src/app.js"

describe("Phase 1A admin RAG loop", () => {
  it("uses deterministic 1024-dimension stub embeddings", () => {
    const first = embedTextStubHashV1("Dubai Marina approved FAQ")
    const second = embedTextStubHashV1("Dubai Marina approved FAQ")

    expect(first).toHaveLength(1024)
    expect(second).toEqual(first)
    expect(Math.sqrt(first.reduce((sum, value) => sum + value * value, 0))).toBeCloseTo(1, 4)
  })

  it("returns admin dev stub context", async () => {
    const app = await buildApi({ logger: false, staticAssets: { enabled: false }, phase1aStore: createInMemoryPhase1aStore() })

    const response = await app.inject({ method: "GET", url: "/api/v1/admin/me" })

    await app.close()
    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      user: { email: "admin.stub@khanect.local", authMode: "dev-stub", productionAuth: false },
      warning: "Dev admin stub only. Not production authentication.",
    })
  })

  it("blocks admin dev stub in production mode", async () => {
    const app = await buildApi({
      logger: false,
      staticAssets: { enabled: false },
      phase1aStore: createInMemoryPhase1aStore(),
      config: loadConfig({
        NODE_ENV: "production",
        BETTER_AUTH_SECRET: "real_production_secret_value_with_more_than_32_chars",
        ENCRYPTION_KEY: "real_encryption_secret_value_with_more_than_32_chars",
        ADMIN_API_KEY: "real_admin_api_key_value_with_more_than_32_chars",
      }),
    })

    const response = await app.inject({ method: "POST", url: "/api/v1/admin/content", payload: { title: "Blocked", body: "Blocked" } })

    await app.close()
    expect(response.statusCode).toBe(401)
    expect(response.json()).toMatchObject({ error: { code: "ADMIN_AUTH_REQUIRED" } })
  })

  it("allows production admin requests with the configured api key", async () => {
    const app = await buildApi({
      logger: false,
      staticAssets: { enabled: false },
      phase1aStore: createInMemoryPhase1aStore(),
      config: loadConfig({
        NODE_ENV: "production",
        BETTER_AUTH_SECRET: "real_production_secret_value_with_more_than_32_chars",
        ENCRYPTION_KEY: "real_encryption_secret_value_with_more_than_32_chars",
        ADMIN_API_KEY: "real_admin_api_key_value_with_more_than_32_chars",
      }),
    })

    const rejected = await app.inject({
      method: "POST",
      url: "/api/v1/admin/content",
      headers: { "x-khanect-admin-api-key": "wrong_key" },
      payload: { title: "Blocked", body: "Blocked" },
    })
    const accepted = await app.inject({
      method: "POST",
      url: "/api/v1/admin/content",
      headers: { "x-khanect-admin-api-key": "real_admin_api_key_value_with_more_than_32_chars" },
      payload: { title: "Allowed", body: "Allowed production admin request." },
    })

    await app.close()
    expect(rejected.statusCode).toBe(401)
    expect(accepted.statusCode).toBe(201)
    expect(accepted.json().item).toMatchObject({ title: "Allowed" })
  })

  it("publishes content, indexes chunks, searches RAG, and answers with sources", async () => {
    const app = await buildApi({ logger: false, staticAssets: { enabled: false }, phase1aStore: createInMemoryPhase1aStore() })

    const draftResponse = await app.inject({
      method: "POST",
      url: "/api/v1/admin/content",
      payload: {
        contentType: "faq",
        title: "Marina Heights FAQ",
        body: "Marina Heights allows pets and has two-bedroom apartments near Dubai Marina tram.",
      },
    })
    const draft = draftResponse.json().item

    const draftSearch = await app.inject({
      method: "POST",
      url: "/api/v1/admin/rag/search-test",
      payload: { query: "pets Marina Heights" },
    })
    expect(draftSearch.json().sources).toEqual([])

    const statusPatchResponse = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/content/${draft.id}`,
      payload: { status: "published" },
    })
    expect(statusPatchResponse.statusCode).toBe(400)
    expect(statusPatchResponse.json()).toMatchObject({ error: { code: "VALIDATION_ERROR" } })
    const afterStatusPatch = await app.inject({ method: "GET", url: `/api/v1/admin/content/${draft.id}` })
    expect(afterStatusPatch.json().item).toMatchObject({ status: "draft", publishedVersionId: null })

    const publishResponse = await app.inject({ method: "POST", url: `/api/v1/admin/content/${draft.id}/publish` })
    expect(publishResponse.statusCode).toBe(200)
    expect(publishResponse.json()).toMatchObject({ embeddingModel: "stub/hash-v1", chunkCount: 1 })

    const searchResponse = await app.inject({
      method: "POST",
      url: "/api/v1/admin/rag/search-test",
      payload: { query: "Marina Heights pets", topK: 3 },
    })
    expect(searchResponse.statusCode).toBe(200)
    expect(searchResponse.json().sources[0]).toMatchObject({ title: "Marina Heights FAQ" })

    const chatResponse = await app.inject({
      method: "POST",
      url: "/api/v1/admin/chat-lab/test-message",
      payload: { message: "Does Marina Heights allow pets?" },
    })
    const chat = chatResponse.json()
    expect(chat.fallback).toBe(false)
    expect(chat.sources.length).toBeGreaterThan(0)
    expect(chat.answer).toContain("Marina Heights")

    const unrelatedChatResponse = await app.inject({
      method: "POST",
      url: "/api/v1/admin/chat-lab/test-message",
      payload: { message: "banana spaceship" },
    })
    expect(unrelatedChatResponse.json()).toMatchObject({ fallback: true, sources: [] })

    await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/content/${draft.id}`,
      payload: { body: "Unapproved draft text about skybridge helipad." },
    })
    await app.inject({ method: "POST", url: "/api/v1/admin/rag/reindex", payload: {} })
    const unapprovedSearch = await app.inject({
      method: "POST",
      url: "/api/v1/admin/rag/search-test",
      payload: { query: "skybridge helipad", topK: 3 },
    })
    expect(unapprovedSearch.json().sources).toEqual([])

    const sensitiveChatResponse = await app.inject({
      method: "POST",
      url: "/api/v1/admin/chat-lab/test-message",
      payload: { message: "What is the RERA registration number?" },
    })
    expect(sensitiveChatResponse.json()).toMatchObject({ fallback: true, sources: [] })

    await app.close()
  })

  it("returns chat lab fallback without approved sources", async () => {
    const app = await buildApi({ logger: false, staticAssets: { enabled: false }, phase1aStore: createInMemoryPhase1aStore() })

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/admin/chat-lab/test-message",
      payload: { message: "Unknown off-plan tower" },
    })

    await app.close()
    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ fallback: true, sources: [] })
  })
})
