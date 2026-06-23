import { describe, expect, it } from "vitest"

import { buildPlatformRagIndexJobId } from "../src/rag-index.js"

describe("rag index job ids", () => {
  it("builds BullMQ-safe dedupe keys without colons", () => {
    const chatbotId = "019ef441-27ff-700d-85a8-833f8f76b8da"
    const contentVersionId = "019ef441-280b-72d8-97b8-06a5c59f2bf0"

    expect(buildPlatformRagIndexJobId(chatbotId, contentVersionId)).toBe(
      `${chatbotId}__${contentVersionId}`,
    )
    expect(buildPlatformRagIndexJobId(chatbotId, contentVersionId)).not.toContain(":")
  })
})