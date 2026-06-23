import { createStubEmbeddingProvider } from "@workspace/core"
import { describe, expect, it } from "vitest"

import { createInMemoryProductionChatbotStore } from "../src/platform.js"

describe("platform RAG pipeline", () => {
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
})