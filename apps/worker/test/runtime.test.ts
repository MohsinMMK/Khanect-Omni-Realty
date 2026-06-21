import { createInMemoryPhase1aStore } from "@workspace/db"
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

  it("processes rag.index by reindexing published content only", async () => {
    const store = createInMemoryPhase1aStore()
    const item = await store.createContent({ title: "Worker indexed FAQ", body: "Worker queue content about escrow." })
    await store.createContent({ title: "Draft only", body: "Must not be indexed." })
    await store.publishContent(item.id)

    const processor = createRagIndexProcessor(store, { info() {}, error() {} })
    const result = await processor({ id: "job-1", data: { contentItemId: item.id } } as never)

    expect(result).toMatchObject({ status: "indexed", indexed: 1, chunks: 1 })
  })
})
