import { loadConfig } from "@workspace/config"
import { createInMemoryProductionChatbotStore } from "@workspace/db"
import { createHmac } from "node:crypto"
import { describe, expect, it, vi } from "vitest"

import { buildApi } from "../src/app.js"

describe("Meta webhooks", () => {
  const config = loadConfig({
    NODE_ENV: "test",
    PLATFORM_STORE: "memory",
    META_WEBHOOK_VERIFY_TOKEN: "phase0_meta_verify_token",
    META_APP_SECRET: "test-meta-app-secret",
    WHATSAPP_ENABLED: "true",
    WHATSAPP_PHONE_NUMBER_ID: "123",
    WHATSAPP_ACCESS_TOKEN: "test-whatsapp-token",
    INSTAGRAM_MESSAGING_ENABLED: "true",
    INSTAGRAM_BUSINESS_ACCOUNT_ID: "business-123",
    INSTAGRAM_PAGE_ID: "page-123",
    INSTAGRAM_ACCESS_TOKEN: "test-instagram-token",
  })

  it("verifies WhatsApp webhook subscription challenges", async () => {
    const app = await buildApi({
      logger: false,
      staticAssets: { enabled: false },
      config,
    })
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/webhooks/meta/whatsapp?hub.mode=subscribe&hub.challenge=challenge-123&hub.verify_token=phase0_meta_verify_token",
    })
    expect(response.statusCode).toBe(200)
    expect(response.body).toBe("challenge-123")
    await app.close()
  })

  it("rejects invalid webhook verification tokens", async () => {
    const app = await buildApi({
      logger: false,
      staticAssets: { enabled: false },
      config,
    })
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/webhooks/meta/whatsapp?hub.mode=subscribe&hub.challenge=challenge-123&hub.verify_token=wrong",
    })
    expect(response.statusCode).toBe(403)
    await app.close()
  })

  it("accepts Instagram webhook events with 202", async () => {
    const app = await buildApi({
      logger: false,
      staticAssets: { enabled: false },
      config,
    })
    const payload = '{ "object": "instagram", "entry": [] }'
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/webhooks/meta/instagram",
      headers: {
        "content-type": "application/json",
        "x-hub-signature-256": sign(payload),
      },
      payload,
    })
    expect(response.statusCode).toBe(202)
    expect(response.json()).toMatchObject({
      accepted: true,
      channel: "instagram_dm",
    })
    await app.close()
  })

  it("rejects unsigned, malformed and tampered events before processing", async () => {
    const store = createInMemoryProductionChatbotStore()
    const project = await store.createProject({
      name: "Signed Meta Realty",
      domain: "signed-meta.example",
    })
    const chatbot = await store.createChatbot({
      projectId: project.id,
      name: "WhatsApp",
    })
    if (!chatbot) throw new Error("chatbot missing")
    await store.updateConnectorStatus(chatbot.id, "whatsapp", "active")
    await store.updateConnectorStatus(chatbot.id, "instagram_dm", "active")
    const processMessage = vi.spyOn(store, "testMessage")
    const recordExchange = vi.spyOn(store, "recordChannelExchange")
    const fetchImpl = vi.fn()
    const app = await buildApi({
      logger: false,
      staticAssets: { enabled: false },
      config,
      productionChatbotStore: store,
      metaFetchImpl: fetchImpl,
    })
    try {
      for (const channel of ["whatsapp", "instagram"]) {
        const payload = JSON.stringify(
          channel === "whatsapp"
            ? {
                object: "whatsapp_business_account",
                entry: [
                  {
                    changes: [
                      {
                        value: {
                          messaging_product: "whatsapp",
                          metadata: { phone_number_id: "123" },
                          messages: [
                            {
                              from: "16505551234",
                              id: "wamid.FORGED",
                              type: "text",
                              text: { body: "Show the property prices" },
                            },
                          ],
                        },
                      },
                    ],
                  },
                ],
              }
            : {
                object: "instagram",
                entry: [
                  {
                    messaging: [
                      {
                        sender: { id: "forged-user" },
                        recipient: { id: "page-123" },
                        message: {
                          mid: "FORGED",
                          text: "Show the property prices",
                        },
                      },
                    ],
                  },
                ],
              }
        )
        for (const signature of [
          undefined,
          "sha256=00",
          `sha256=${"z".repeat(64)}`,
          sign(`${payload} `),
          `sha256=${"0".repeat(64)}`,
        ]) {
          const response = await app.inject({
            method: "POST",
            url: `/api/v1/webhooks/meta/${channel}`,
            headers: {
              "content-type": "application/json",
              ...(signature ? { "x-hub-signature-256": signature } : {}),
            },
            payload,
          })
          expect(response.statusCode).toBe(403)
          expect(response.json()).toMatchObject({
            error: { code: "META_WEBHOOK_SIGNATURE_INVALID" },
          })
        }
        const empty = await app.inject({
          method: "POST",
          url: `/api/v1/webhooks/meta/${channel}`,
        })
        expect(empty.statusCode).toBe(403)
      }
      expect(processMessage).not.toHaveBeenCalled()
      expect(recordExchange).not.toHaveBeenCalled()
      expect(fetchImpl).not.toHaveBeenCalled()
    } finally {
      await app.close()
    }
  })

  it("fails closed without an app secret and keeps malformed signed JSON at 400", async () => {
    const unconfigured = await buildApi({
      logger: false,
      staticAssets: { enabled: false },
      config: loadConfig({
        NODE_ENV: "test",
        PLATFORM_STORE: "memory",
        META_APP_SECRET: "",
      }),
    })
    const app = await buildApi({
      logger: false,
      staticAssets: { enabled: false },
      config,
    })
    try {
      const payload = '{ "object":'
      const request = {
        method: "POST" as const,
        url: "/api/v1/webhooks/meta/instagram",
        headers: {
          "content-type": "application/json",
          "x-hub-signature-256": sign(payload),
        },
        payload,
      }
      expect((await unconfigured.inject(request)).statusCode).toBe(403)
      expect((await app.inject(request)).statusCode).toBe(400)
      expect(
        (
          await app.inject({
            ...request,
            headers: {
              "content-type": "text/plain",
              "x-hub-signature-256": sign(payload),
            },
          })
        ).statusCode
      ).toBe(415)
    } finally {
      await unconfigured.close()
      await app.close()
    }
  })
})

function sign(payload: string) {
  return `sha256=${createHmac("sha256", "test-meta-app-secret").update(payload).digest("hex")}`
}
