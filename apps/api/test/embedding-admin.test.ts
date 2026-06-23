import { loadConfig } from "@workspace/config"
import { describe, expect, it, vi } from "vitest"

import { buildApi } from "../src/app.js"

describe("admin embedding routes", () => {
  it("returns embedding status for stub provider", async () => {
    const config = loadConfig({ NODE_ENV: "test", PLATFORM_STORE: "memory", EMBEDDING_PROVIDER: "stub" })
    const app = await buildApi({ logger: false, staticAssets: { enabled: false }, config })

    const response = await app.inject({ method: "GET", url: "/api/v1/admin/ai/embedding" })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      provider: "stub",
      model: "stub/hash-v1",
      dimension: 1024,
      configured: true,
      status: "ok",
      modes: expect.arrayContaining([
        expect.objectContaining({ id: "openai" }),
        expect.objectContaining({ id: "local" }),
      ]),
    })

    await app.close()
  })

  it("runs an embedding smoke test", async () => {
    const config = loadConfig({ NODE_ENV: "test", PLATFORM_STORE: "memory", EMBEDDING_PROVIDER: "stub" })
    const app = await buildApi({ logger: false, staticAssets: { enabled: false }, config })

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/admin/ai/embedding/test",
      payload: { sample: "Dubai Marina parking policy" },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      ok: true,
      provider: "stub",
      dimension: 1024,
      vectorPreview: expect.any(Array),
    })

    await app.close()
  })

  it("marks openai provider misconfigured without an api key", async () => {
    const config = loadConfig({
      NODE_ENV: "test",
      PLATFORM_STORE: "memory",
      EMBEDDING_PROVIDER: "openai",
    })
    const app = await buildApi({ logger: false, staticAssets: { enabled: false }, config })

    const response = await app.inject({ method: "GET", url: "/api/v1/admin/ai/embedding" })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      provider: "openai",
      configured: false,
      status: "misconfigured",
      apiKeyConfigured: false,
    })

    await app.close()
  })

  it("probes openai provider when api key is configured", async () => {
    const vector = Array.from({ length: 1024 }, () => 0.01)
    const fetchImpl = vi.fn(async (input: string | URL) => {
      const url = String(input)
      if (url.includes("/embeddings")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: [{ embedding: vector }] }),
        } as Response
      }
      return { ok: false, status: 404, json: async () => ({}) } as Response
    }) as typeof fetch

    const config = loadConfig({
      NODE_ENV: "test",
      PLATFORM_STORE: "memory",
      EMBEDDING_PROVIDER: "openai",
      OPENAI_API_KEY: "sk-test",
    })

    const originalFetch = globalThis.fetch
    globalThis.fetch = fetchImpl

    try {
      const app = await buildApi({ logger: false, staticAssets: { enabled: false }, config })
      const response = await app.inject({ method: "GET", url: "/api/v1/admin/ai/embedding" })
      expect(response.statusCode).toBe(200)
      expect(response.json()).toMatchObject({
        provider: "openai",
        configured: true,
        status: "ok",
        probe: { ok: true },
      })
      await app.close()
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})