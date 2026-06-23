import { loadConfig } from "@workspace/config"
import { createInMemoryProductionChatbotStore } from "@workspace/db"
import { describe, expect, it, vi } from "vitest"

import { buildApi } from "../src/app.js"
import { handleMetaInboundMessages } from "../src/meta/handler.js"

describe("Meta channel replies", () => {
  it("replies to WhatsApp inbound text when connector is active", async () => {
    const store = createInMemoryProductionChatbotStore()
    const project = await store.createProject({ name: "Meta Realty", domain: "meta.example" })
    const chatbot = await store.createChatbot({ projectId: project.id, name: "WA bot" })
    if (!chatbot) throw new Error("chatbot missing")
    await store.updateConnectorStatus(chatbot.id, "whatsapp", "active")

    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ messages: [{ id: "wamid.SENT" }] }), { status: 200 }))

    const result = await handleMetaInboundMessages(
      loadConfig({ NODE_ENV: "test", PLATFORM_STORE: "memory", WHATSAPP_ENABLED: "true", WHATSAPP_PHONE_NUMBER_ID: "123", WHATSAPP_ACCESS_TOKEN: "token" }),
      store,
      [{
        channel: "whatsapp",
        externalUserId: "16505551234",
        messageId: "wamid.IN",
        text: "hello",
      }],
      fetchImpl,
    )

    expect(result.replied).toBe(1)
    expect(fetchImpl).toHaveBeenCalledOnce()
  })

  it("processes webhook POST end-to-end through Fastify", async () => {
    const store = createInMemoryProductionChatbotStore()
    const project = await store.createProject({ name: "Webhook Realty", domain: "webhook.example" })
    const chatbot = await store.createChatbot({ projectId: project.id, name: "Webhook bot" })
    if (!chatbot) throw new Error("chatbot missing")
    await store.updateConnectorStatus(chatbot.id, "whatsapp", "active")

    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ messages: [{ id: "wamid.SENT" }] }), { status: 200 }))
    const app = await buildApi({
      logger: false,
      staticAssets: { enabled: false },
      productionChatbotStore: store,
      metaFetchImpl: fetchImpl,
      config: loadConfig({
        NODE_ENV: "test",
        PLATFORM_STORE: "memory",
        WHATSAPP_ENABLED: "true",
        WHATSAPP_PHONE_NUMBER_ID: "123",
        WHATSAPP_ACCESS_TOKEN: "token",
      }),
    })

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/webhooks/meta/whatsapp",
      payload: {
        object: "whatsapp_business_account",
        entry: [{
          changes: [{
            value: {
              messaging_product: "whatsapp",
              metadata: { phone_number_id: "123" },
              messages: [{
                from: "16505551234",
                id: "wamid.IN",
                type: "text",
                text: { body: "Need pricing" },
              }],
            },
          }],
        }],
      },
    })

    await app.close()
    expect(response.statusCode).toBe(202)
    expect(response.json()).toMatchObject({ channel: "whatsapp", replied: 1 })
  })
})