import { loadConfig } from "@workspace/config"
import { describe, expect, it } from "vitest"

import { buildApi } from "../src/app.js"

describe("Meta webhooks", () => {
  const config = loadConfig({
    NODE_ENV: "test",
    PLATFORM_STORE: "memory",
    META_WEBHOOK_VERIFY_TOKEN: "phase0_meta_verify_token",
  })

  it("verifies WhatsApp webhook subscription challenges", async () => {
    const app = await buildApi({ logger: false, staticAssets: { enabled: false }, config })
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/webhooks/meta/whatsapp?hub.mode=subscribe&hub.challenge=challenge-123&hub.verify_token=phase0_meta_verify_token",
    })
    expect(response.statusCode).toBe(200)
    expect(response.body).toBe("challenge-123")
    await app.close()
  })

  it("rejects invalid webhook verification tokens", async () => {
    const app = await buildApi({ logger: false, staticAssets: { enabled: false }, config })
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/webhooks/meta/whatsapp?hub.mode=subscribe&hub.challenge=challenge-123&hub.verify_token=wrong",
    })
    expect(response.statusCode).toBe(403)
    await app.close()
  })

  it("accepts Instagram webhook events with 202", async () => {
    const app = await buildApi({ logger: false, staticAssets: { enabled: false }, config })
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/webhooks/meta/instagram",
      payload: { object: "instagram", entry: [] },
    })
    expect(response.statusCode).toBe(202)
    expect(response.json()).toMatchObject({ accepted: true, channel: "instagram_dm" })
    await app.close()
  })
})