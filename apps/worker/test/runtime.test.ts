import { loadConfig } from "@workspace/config"
import { createStubEmbeddingProvider } from "@workspace/core"
import { createInMemoryPhase1aStore, createInMemoryProductionChatbotStore } from "@workspace/db"
import { describe, expect, it } from "vitest"

import { createRagIndexProcessor, createRedisConnectionOptions, phase0QueueName, ragIndexQueueName } from "../src/runtime.js"

describe("worker runtime", () => {
  it("keeps Phase 0 queue and adds Phase 1A rag index queue", () => {
    expect(phase0QueueName).toBe("phase0.foundation")
    expect(ragIndexQueueName).toBe("rag.index")
  })

  it("parses Redis URL into BullMQ connection options", () => {
    expect(createRedisConnectionOptions("redis://user:pass@localhost:6380/2")).toMatchObject({
      host: "localhost",
      port: 6380,
      username: "user",
      password: "pass",
      db: 2,
    })
  })

  it("processes rag.index by reindexing published Phase 1A content only", async () => {
    const store = createInMemoryPhase1aStore()
    const platformStore = createInMemoryProductionChatbotStore()
    const item = await store.createContent({ title: "Worker indexed FAQ", body: "Worker queue content about escrow." })
    await store.createContent({ title: "Draft only", body: "Must not be indexed." })
    await store.publishContent(item.id)

    const processor = createRagIndexProcessor(store, platformStore, loadConfig({ NODE_ENV: "test" }), { info() {}, error() {} })
    const result = await processor({ id: "job-1", data: { contentItemId: item.id } } as never)

    expect(result).toMatchObject({ status: "indexed", scope: "phase1a", indexed: 1, chunks: 1 })
  })

  it("processes rag.index for platform publish jobs", async () => {
    const phase1aStore = createInMemoryPhase1aStore()
    const platformStore = createInMemoryProductionChatbotStore({ embeddingProvider: createStubEmbeddingProvider() })
    const project = await platformStore.createProject({ name: "Worker Realty", domain: "worker.example" })
    const chatbot = await platformStore.createChatbot({ projectId: project.id, name: "Worker bot" })
    const content = await platformStore.createContent(chatbot!.id, {
      title: "Escrow FAQ",
      body: "Escrow refunds follow the approved project policy.",
    })
    const published = await platformStore.publishContent(chatbot!.id, content!.id)

    const processor = createRagIndexProcessor(phase1aStore, platformStore, loadConfig({ NODE_ENV: "test" }), { info() {}, error() {} })
    const result = await processor({
      id: "job-2",
      data: {
        chatbotId: chatbot!.id,
        contentItemId: content!.id,
        contentVersionId: published!.source.sourceVersionId,
        documentId: published!.documentId,
      },
    } as never)

    expect(result).toMatchObject({ status: "indexed", scope: "platform", chunkCount: 1 })
  })
})