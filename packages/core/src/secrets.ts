import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto"

const ALGORITHM = "aes-256-gcm"
const IV_BYTES = 12
const AUTH_TAG_BYTES = 16
const KEY_BYTES = 32

function deriveKey(encryptionKey: string): Buffer {
  const salt = Buffer.from("khanect-project-ai-v1", "utf8")
  return scryptSync(encryptionKey, salt, KEY_BYTES)
}

export function maskSecret(value: string | null | undefined): string | null {
  if (!value?.trim()) return null
  const trimmed = value.trim()
  if (trimmed.length <= 8) return "••••••••"
  return `${trimmed.slice(0, 3)}…${trimmed.slice(-4)}`
}

export function encryptSecret(plaintext: string, encryptionKey: string): string {
  const key = deriveKey(encryptionKey)
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, encrypted]).toString("base64url")
}

export function decryptSecret(ciphertext: string, encryptionKey: string): string {
  const payload = Buffer.from(ciphertext, "base64url")
  if (payload.length <= IV_BYTES + AUTH_TAG_BYTES) {
    throw new Error("encrypted secret payload is invalid")
  }

  const iv = payload.subarray(0, IV_BYTES)
  const authTag = payload.subarray(IV_BYTES, IV_BYTES + AUTH_TAG_BYTES)
  const encrypted = payload.subarray(IV_BYTES + AUTH_TAG_BYTES)
  const key = deriveKey(encryptionKey)
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
  return decrypted.toString("utf8")
}