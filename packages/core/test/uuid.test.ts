import { describe, expect, it } from "vitest"

import { createUuidV7, isUuidV7 } from "../src/index.js"

describe("UUID v7 helpers", () => {
  it("creates valid UUID v7 values", () => {
    const id = createUuidV7()

    expect(isUuidV7(id)).toBe(true)
  })

  it("rejects non-v7 IDs", () => {
    expect(isUuidV7("00000000-0000-4000-8000-000000000000")).toBe(false)
    expect(isUuidV7("not-a-uuid")).toBe(false)
  })
})
