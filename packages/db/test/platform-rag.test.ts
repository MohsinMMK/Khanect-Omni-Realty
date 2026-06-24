import { createStubEmbeddingProvider } from "@workspace/core"
import type { EmbeddingProvider } from "@workspace/core"
import { describe, expect, it } from "vitest"

import { createInMemoryProductionChatbotStore } from "../src/platform.js"

describe("platform RAG pipeline", () => {
  function fixedEmbeddingProvider(dimension: number, model: string): EmbeddingProvider {
    return {
      dimension,
      model,
      mode: "local",
      async embedTexts(texts) {
        return texts.map((text) => {
          const vector = Array.from({ length: dimension }, (_, index) => ((text.length + index) % 17) / 17)
          const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1
          return vector.map((value) => value / magnitude)
        })
      },
    }
  }

  it("indexes published content asynchronously and retrieves by vector similarity", async () => {
    const store = createInMemoryProductionChatbotStore({ embeddingProvider: createStubEmbeddingProvider() })
    const project = await store.createProject({ name: "Vector Realty", domain: "vector.example" })
    const chatbot = await store.createChatbot({ projectId: project.id, name: "FAQ bot" })
    const content = await store.createContent(chatbot!.id, {
      title: "Marina Heights pet policy",
      body: "Marina Heights allows cats and small dogs after building management registration.",
    })

    const published = await store.publishContent(chatbot!.id, content!.id)
    expect(published).toMatchObject({ chunkCount: 0, indexing: true })
    expect(await store.listKnowledge(chatbot!.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          contentItemId: content!.id,
          status: "syncing",
          chunkCount: 0,
        }),
      ]),
    )

    const indexed = await store.indexPlatformContent({
      chatbotId: chatbot!.id,
      contentItemId: content!.id,
      sourceVersionId: published!.source.sourceVersionId,
      documentId: published!.documentId,
      embed: createStubEmbeddingProvider(),
    })
    expect(indexed).toMatchObject({ chunkCount: 1 })
    expect(await store.listKnowledge(chatbot!.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          contentItemId: content!.id,
          status: "indexed",
          chunkCount: 1,
        }),
      ]),
    )

    const answer = await store.testMessage(chatbot!.id, { message: "Does Marina Heights allow cats?" })
    expect(answer).toMatchObject({ fallback: false })
    expect(answer?.sources[0]).toMatchObject({ title: "Marina Heights pet policy" })
  })

  it("can reindex and query a project with 384-dimension local vectors", async () => {
    const provider = fixedEmbeddingProvider(384, "BAAI/bge-small-en-v1.5")
    const store = createInMemoryProductionChatbotStore({ embeddingProvider: provider })
    const project = await store.createProject({ name: "Small Vector Realty", domain: "small-vector.example" })
    const chatbot = await store.createChatbot({ projectId: project.id, name: "Small FAQ bot" })
    const content = await store.createContent(chatbot!.id, {
      title: "Small vector policy",
      body: "Small vector policy confirms parking registration is required before move in.",
    })

    const published = await store.publishContent(chatbot!.id, content!.id)
    await store.indexPlatformContent({
      chatbotId: chatbot!.id,
      contentItemId: content!.id,
      sourceVersionId: published!.source.sourceVersionId,
      documentId: published!.documentId,
      embed: provider,
    })

    const answer = await store.testMessage(chatbot!.id, { message: "Is parking registration required?" })
    expect(answer?.retrieval.model).toBe("BAAI/bge-small-en-v1.5")
    expect(answer?.sources[0]?.title).toBe("Small vector policy")
  })

  it("refuses unsupported questions even when an indexed source shares a location token", async () => {
    const store = createInMemoryProductionChatbotStore({ embeddingProvider: createStubEmbeddingProvider() })
    const project = await store.createProject({ name: "Scoped Realty", domain: "scoped.example" })
    const chatbot = await store.createChatbot({ projectId: project.id, name: "Scoped bot" })
    const content = await store.createContent(chatbot!.id, {
      title: "Aetheria Master Property Agreement",
      contentType: "property",
      body: "Aetheria Residency is located at 4410 Whispering Pines Way, Austin, TX. The execution date is June 24, 2026.",
    })

    const published = await store.publishContent(chatbot!.id, content!.id)
    await store.indexPlatformContent({
      chatbotId: chatbot!.id,
      contentItemId: content!.id,
      sourceVersionId: published!.source.sourceVersionId,
      documentId: published!.documentId,
      embed: createStubEmbeddingProvider(),
    })

    const answer = await store.testMessage(chatbot!.id, { message: "What is the current weather in Austin right now?" })

    expect(answer).toMatchObject({
      fallback: true,
      answer: expect.stringContaining("I do not have an approved source"),
      sources: [],
      actionTrace: { reason: "no_approved_source" },
    })
  })
})
