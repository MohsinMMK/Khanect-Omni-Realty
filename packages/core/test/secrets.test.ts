import { describe, expect, it } from "vitest"

import { decryptSecret, encryptSecret, maskSecret } from "../src/secrets.js"

const key = "phase0_dev_only_encryption_key_min_32_chars"

describe("secrets", () => {
  it("encrypts and decrypts round-trip", () => {
    const encrypted = encryptSecret("sk-project-secret-key", key)
    expect(decryptSecret(encrypted, key)).toBe("sk-project-secret-key")
  })

  it("masks api keys for display", () => {
    expect(maskSecret("sk-live-abcdef123456")).toBe("sk-…3456")
    expect(maskSecret("short")).toBe("••••••••")
    expect(maskSecret(null)).toBeNull()
  })
})