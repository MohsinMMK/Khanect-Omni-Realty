import { describe, expect, it } from "vitest"

import { loadConfig } from "../src/index.js"

describe("loadConfig", () => {
  it("parses strict boolean strings", () => {
    const config = loadConfig({
      WHATSAPP_ENABLED: "true",
      INSTAGRAM_MESSAGING_ENABLED: "1",
      GMAIL_SEND_ENABLED: "false",
      GOOGLE_CALENDAR_ENABLED: "0",
    })

    expect(config.meta.whatsapp.enabled).toBe(true)
    expect(config.meta.instagram.messagingEnabled).toBe(true)
    expect(config.google.gmailSendEnabled).toBe(false)
    expect(config.google.calendarEnabled).toBe(false)
  })

  it("rejects invalid boolean strings", () => {
    expect(() => loadConfig({ WHATSAPP_ENABLED: "maybe" })).toThrow()
  })

  it("rejects invalid connection URLs", () => {
    expect(() => loadConfig({ REDIS_URL: "not a url" })).toThrow()
    expect(() => loadConfig({ DATABASE_URL: "not a url" })).toThrow()
  })

  it("rejects phase0 placeholder secrets in production", () => {
    expect(() => loadConfig({ NODE_ENV: "production" })).toThrow(/BETTER_AUTH_SECRET/)
    expect(() =>
      loadConfig({
        NODE_ENV: "production",
        BETTER_AUTH_SECRET: "phase0_dev_only_better_auth_secret_min_32_chars",
        ENCRYPTION_KEY: "phase0_dev_only_encryption_key_min_32_chars",
      }),
    ).toThrow(/BETTER_AUTH_SECRET/)
  })
})
