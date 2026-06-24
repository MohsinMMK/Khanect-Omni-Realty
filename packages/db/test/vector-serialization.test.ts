import { describe, expect, it } from "vitest"

import { serializePgVector } from "../src/phase1a.js"

describe("pgvector serialization", () => {
  it("serializes non-stub embedding dimensions used by local BGE providers", () => {
    expect(serializePgVector([0.1, 0.2, 0.3])).toBe("[0.1,0.2,0.3]")
  })

  it("rejects empty and non-finite vectors", () => {
    expect(() => serializePgVector([])).toThrow(/finite numeric dimensions/)
    expect(() => serializePgVector([0.1, Number.NaN])).toThrow(/finite numeric dimensions/)
  })
})
