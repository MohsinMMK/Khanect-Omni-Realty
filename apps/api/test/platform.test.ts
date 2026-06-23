import { loadConfig } from "@workspace/config"
import { createInMemoryProductionChatbotStore, type ProductionChatbotStore } from "@workspace/db"
import { describe, expect, it } from "vitest"

import { buildApi } from "../src/app.js"

describe("Production website chatbot platform", () => {
  it("requires the configured admin api key for production platform routes", async () => {
    const app = await buildApi({
      logger: false,
      staticAssets: { enabled: false },
      productionChatbotStore: createInMemoryProductionChatbotStore(),
      config: loadConfig({
        NODE_ENV: "production",
        BETTER_AUTH_SECRET: "real_production_secret_value_with_more_than_32_chars",
        ENCRYPTION_KEY: "real_encryption_secret_value_with_more_than_32_chars",
        ADMIN_API_KEY: "real_admin_api_key_value_with_more_than_32_chars",
      }),
    })

    const rejected = await app.inject({ method: "GET", url: "/api/v1/admin/projects" })
    const accepted = await app.inject({
      method: "POST",
      url: "/api/v1/admin/projects",
      headers: { "x-khanect-admin-api-key": "real_admin_api_key_value_with_more_than_32_chars" },
      payload: { name: "Production Realty", domain: "prod-realty.example" },
    })

    await app.close()
    expect(rejected.statusCode).toBe(401)
    expect(rejected.json()).toMatchObject({ error: { code: "ADMIN_AUTH_REQUIRED" } })
    expect(accepted.statusCode).toBe(200)
    expect(accepted.json().project).toMatchObject({ name: "Production Realty" })
  })

  it("returns a conflict when a project domain is already used", async () => {
    const app = await buildApi({
      logger: false,
      staticAssets: { enabled: false },
      productionChatbotStore: createInMemoryProductionChatbotStore(),
    })

    const firstResponse = await app.inject({
      method: "POST",
      url: "/api/v1/admin/projects",
      payload: { name: "First Realty", domain: "duplicate.example" },
    })
    const duplicateResponse = await app.inject({
      method: "POST",
      url: "/api/v1/admin/projects",
      payload: { name: "Second Realty", domain: "duplicate.example" },
    })

    expect(firstResponse.statusCode).toBe(200)
    expect(duplicateResponse.statusCode).toBe(409)
    expect(duplicateResponse.json()).toMatchObject({
      error: {
        code: "PROJECT_DOMAIN_EXISTS",
        message: "A project already uses this domain.",
      },
    })

    await app.close()
  })

  it("requires project archive before delete", async () => {
    const app = await buildApi({
      logger: false,
      staticAssets: { enabled: false },
      productionChatbotStore: createInMemoryProductionChatbotStore(),
    })

    const project = (await app.inject({
      method: "POST",
      url: "/api/v1/admin/projects",
      payload: { name: "Archive Realty", domain: "archive-realty.example" },
    })).json().project

    const activeDeleteResponse = await app.inject({
      method: "DELETE",
      url: `/api/v1/admin/projects/${project.id}`,
    })
    expect(activeDeleteResponse.statusCode).toBe(409)
    expect(activeDeleteResponse.json()).toMatchObject({ error: { code: "PROJECT_ARCHIVE_REQUIRED" } })

    const archiveResponse = await app.inject({
      method: "POST",
      url: `/api/v1/admin/projects/${project.id}/archive`,
    })
    expect(archiveResponse.statusCode).toBe(200)
    expect(archiveResponse.json().project).toMatchObject({ id: project.id, status: "archived" })

    const unarchiveResponse = await app.inject({
      method: "POST",
      url: `/api/v1/admin/projects/${project.id}/unarchive`,
    })
    expect(unarchiveResponse.statusCode).toBe(200)
    expect(unarchiveResponse.json().project).toMatchObject({ id: project.id, status: "active" })

    const restoredDeleteResponse = await app.inject({
      method: "DELETE",
      url: `/api/v1/admin/projects/${project.id}`,
    })
    expect(restoredDeleteResponse.statusCode).toBe(409)
    expect(restoredDeleteResponse.json()).toMatchObject({ error: { code: "PROJECT_ARCHIVE_REQUIRED" } })

    const rearchiveResponse = await app.inject({
      method: "POST",
      url: `/api/v1/admin/projects/${project.id}/archive`,
    })
    expect(rearchiveResponse.statusCode).toBe(200)
    expect(rearchiveResponse.json().project).toMatchObject({ id: project.id, status: "archived" })

    const archivedDeleteResponse = await app.inject({
      method: "DELETE",
      url: `/api/v1/admin/projects/${project.id}`,
    })
    expect(archivedDeleteResponse.statusCode).toBe(200)
    expect(archivedDeleteResponse.json().project).toMatchObject({ id: project.id, status: "archived" })

    const projectsResponse = await app.inject({ method: "GET", url: "/api/v1/admin/projects" })
    expect(projectsResponse.json().items).not.toEqual(expect.arrayContaining([expect.objectContaining({ id: project.id })]))

    await app.close()
  })

  it("creates project chatbots and isolates published knowledge per chatbot", async () => {
    const app = await buildApi({
      logger: false,
      staticAssets: { enabled: false },
      productionChatbotStore: createInMemoryProductionChatbotStore(),
    })

    const projectResponse = await app.inject({
      method: "POST",
      url: "/api/v1/admin/projects",
      payload: { name: "Dubai Realty Group", domain: "dubai-realty.example" },
    })
    expect(projectResponse.statusCode).toBe(200)
    const project = projectResponse.json().project

    const faqBotResponse = await app.inject({
      method: "POST",
      url: `/api/v1/admin/projects/${project.id}/chatbots`,
      payload: {
        name: "Website FAQ",
        purpose: "Answer property questions",
        capabilities: { faq: true, leadCapture: true, appointmentBooking: false },
      },
    })
    const appointmentBotResponse = await app.inject({
      method: "POST",
      url: `/api/v1/admin/projects/${project.id}/chatbots`,
      payload: {
        name: "Appointment concierge",
        purpose: "Book viewings",
        capabilities: { faq: false, leadCapture: true, appointmentBooking: true },
      },
    })
    expect(faqBotResponse.statusCode).toBe(200)
    expect(appointmentBotResponse.statusCode).toBe(200)
    const faqBot = faqBotResponse.json().chatbot
    const appointmentBot = appointmentBotResponse.json().chatbot

    const contentResponse = await app.inject({
      method: "POST",
      url: `/api/v1/admin/chatbots/${faqBot.id}/content`,
      payload: {
        contentType: "faq",
        title: "Marina Heights pet policy",
        body: "Marina Heights allows cats and small dogs after building management registration.",
      },
    })
    expect(contentResponse.statusCode).toBe(200)
    const content = contentResponse.json().item

    const draftTestResponse = await app.inject({
      method: "POST",
      url: `/api/v1/admin/chatbots/${faqBot.id}/test-message`,
      payload: { message: "Does Marina Heights allow cats?" },
    })
    expect(draftTestResponse.json()).toMatchObject({ fallback: true, sources: [] })

    const publishResponse = await app.inject({
      method: "POST",
      url: `/api/v1/admin/chatbots/${faqBot.id}/content/${content.id}/publish`,
    })
    expect(publishResponse.statusCode).toBe(200)
    expect(publishResponse.json()).toMatchObject({ chunkCount: 1 })

    const faqTestResponse = await app.inject({
      method: "POST",
      url: `/api/v1/admin/chatbots/${faqBot.id}/test-message`,
      payload: { message: "Does Marina Heights allow cats?" },
    })
    expect(faqTestResponse.statusCode).toBe(200)
    expect(faqTestResponse.json()).toMatchObject({ fallback: false })
    expect(faqTestResponse.json().answer).toContain("Marina Heights")
    expect(faqTestResponse.json().sources[0]).toMatchObject({ title: "Marina Heights pet policy" })

    const deleteResponse = await app.inject({
      method: "DELETE",
      url: `/api/v1/admin/chatbots/${faqBot.id}/content/${content.id}`,
    })
    expect(deleteResponse.statusCode).toBe(200)
    expect(deleteResponse.json().item).toMatchObject({ id: content.id, title: "Marina Heights pet policy" })

    const deletedTestResponse = await app.inject({
      method: "POST",
      url: `/api/v1/admin/chatbots/${faqBot.id}/test-message`,
      payload: { message: "Does Marina Heights allow cats?" },
    })
    expect(deletedTestResponse.statusCode).toBe(200)
    expect(deletedTestResponse.json()).toMatchObject({ fallback: true, sources: [] })

    const appointmentTestResponse = await app.inject({
      method: "POST",
      url: `/api/v1/admin/chatbots/${appointmentBot.id}/test-message`,
      payload: { message: "Does Marina Heights allow cats?" },
    })
    expect(appointmentTestResponse.statusCode).toBe(200)
    expect(appointmentTestResponse.json()).toMatchObject({ fallback: true, sources: [] })

    await app.close()
  })

  it("returns website connector deployment data and serves public widget chat", async () => {
    const store = createInMemoryProductionChatbotStore()
    const app = await buildApi({
      logger: false,
      staticAssets: { enabled: false },
      productionChatbotStore: store,
      websiteInstallFetcher: async () => new Response(`<html><body>placeholder</body></html>`, {
        headers: { "content-type": "text/html" },
      }),
    })

    const project = (await app.inject({
      method: "POST",
      url: "/api/v1/admin/projects",
      payload: { name: "Khanect Demo", domain: "khanect-demo.example" },
    })).json().project
    const chatbot = (await app.inject({
      method: "POST",
      url: `/api/v1/admin/projects/${project.id}/chatbots`,
      payload: { name: "Website assistant", capabilities: { faq: true, leadCapture: true, appointmentBooking: true } },
    })).json().chatbot

    const connectorsResponse = await app.inject({
      method: "GET",
      url: `/api/v1/admin/chatbots/${chatbot.id}/connectors`,
      headers: { host: "api.example.test:8443" },
    })
    expect(connectorsResponse.statusCode).toBe(200)
    expect(connectorsResponse.json().connectors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ channel: "website", status: "active" }),
        expect.objectContaining({ channel: "whatsapp", status: "needs_credentials" }),
        expect.objectContaining({ channel: "instagram_dm", status: "needs_credentials" }),
      ]),
    )
    expect(connectorsResponse.json().deployment.installSnippet).toContain("http://api.example.test:8443/api/v1/widget/")
    expect(connectorsResponse.json().deployment.installSnippet).toContain("/widget.js")

    const widgetConfigResponse = await app.inject({
      method: "GET",
      url: `/api/v1/widget/${connectorsResponse.json().deployment.publicKey}/config`,
    })
    expect(widgetConfigResponse.statusCode).toBe(200)
    expect(widgetConfigResponse.headers["access-control-allow-origin"]).toBe("*")
    expect(widgetConfigResponse.json()).toEqual({
      widget: {
        publicKey: connectorsResponse.json().deployment.publicKey,
        title: "Chat with us",
        subtitle: "Approved answers from this business",
        launcherLabel: "Chat",
      },
    })
    expect(JSON.stringify(widgetConfigResponse.json())).not.toContain(chatbot.id)
    expect(JSON.stringify(widgetConfigResponse.json())).not.toContain(connectorsResponse.json().deployment.id)

    const widgetScriptResponse = await app.inject({
      method: "GET",
      url: `/api/v1/widget/${connectorsResponse.json().deployment.publicKey}/widget.js`,
    })
    expect(widgetScriptResponse.statusCode).toBe(200)
    expect(widgetScriptResponse.headers["content-type"]).toContain("application/javascript")
    expect(widgetScriptResponse.headers["access-control-allow-origin"]).toBe("*")
    expect(widgetScriptResponse.body).toContain("khanect-widget")
    expect(widgetScriptResponse.body).toContain(`/api/v1/widget/${connectorsResponse.json().deployment.publicKey}/message`)
    expect(widgetScriptResponse.body).toContain("document.currentScript")
    expect(widgetScriptResponse.body).toContain("addEventListener(\"submit\"")
    expect(widgetScriptResponse.body).toContain("if (!response.ok)")
    expect(widgetScriptResponse.body).toContain("data.error.message")

    const widgetPreflightResponse = await app.inject({
      method: "OPTIONS",
      url: `/api/v1/widget/${connectorsResponse.json().deployment.publicKey}/message`,
      headers: { origin: "https://khanect-demo.example", "access-control-request-method": "POST" },
    })
    expect(widgetPreflightResponse.statusCode).toBe(204)
    expect(widgetPreflightResponse.headers["access-control-allow-origin"]).toBe("*")
    expect(widgetPreflightResponse.headers["access-control-allow-methods"]).toContain("POST")
    expect(widgetPreflightResponse.headers["access-control-allow-headers"]).toContain("content-type")

    const content = (await app.inject({
      method: "POST",
      url: `/api/v1/admin/chatbots/${chatbot.id}/content`,
      payload: {
        contentType: "faq",
        title: "Viewing hours",
        body: "Viewings are available from 10 AM to 6 PM every day with a confirmed appointment.",
      },
    })).json().item
    await app.inject({ method: "POST", url: `/api/v1/admin/chatbots/${chatbot.id}/content/${content.id}/publish` })

    const widgetMessageResponse = await app.inject({
      method: "POST",
      url: `/api/v1/widget/${connectorsResponse.json().deployment.publicKey}/message`,
      headers: { origin: "https://khanect-demo.example" },
      payload: { message: "When can I view the property?", anonymousSessionId: "browser-session-1" },
    })

    expect(widgetMessageResponse.statusCode).toBe(200)
    expect(widgetMessageResponse.headers["access-control-allow-origin"]).toBe("*")
    expect(widgetMessageResponse.json()).toMatchObject({ fallback: false, channel: "website" })
    expect(widgetMessageResponse.json().answer).toContain("Viewings are available")

    const blockedWidgetMessageResponse = await app.inject({
      method: "POST",
      url: `/api/v1/widget/${connectorsResponse.json().deployment.publicKey}/message`,
      headers: { origin: "https://wrong-site.example" },
      payload: { message: "When can I view the property?", anonymousSessionId: "browser-session-2" },
    })
    expect(blockedWidgetMessageResponse.statusCode).toBe(403)
    expect(blockedWidgetMessageResponse.json()).toMatchObject({
      error: { code: "ORIGIN_NOT_ALLOWED" },
    })

    await app.close()
  })

  it("blocks public widget routes when the website connector is not active", async () => {
    const baseStore = createInMemoryProductionChatbotStore()
    const store: ProductionChatbotStore = {
      ...baseStore,
      async listConnectors(chatbotId) {
        const result = await baseStore.listConnectors(chatbotId)
        if (!result) return null
        return {
          ...result,
          connectors: result.connectors.map((connector) =>
            connector.channel === "website" ? { ...connector, status: "paused" } : connector,
          ),
        }
      },
    }
    const app = await buildApi({ logger: false, staticAssets: { enabled: false }, productionChatbotStore: store })

    const project = (await app.inject({
      method: "POST",
      url: "/api/v1/admin/projects",
      payload: { name: "Paused Connector", domain: "paused.example" },
    })).json().project
    const chatbot = (await app.inject({
      method: "POST",
      url: `/api/v1/admin/projects/${project.id}/chatbots`,
      payload: { name: "Paused website assistant" },
    })).json().chatbot
    const connectors = (await app.inject({
      method: "GET",
      url: `/api/v1/admin/chatbots/${chatbot.id}/connectors`,
    })).json()

    const configResponse = await app.inject({
      method: "GET",
      url: `/api/v1/widget/${connectors.deployment.publicKey}/config`,
    })
    const scriptResponse = await app.inject({
      method: "GET",
      url: `/api/v1/widget/${connectors.deployment.publicKey}/widget.js`,
    })
    const messageResponse = await app.inject({
      method: "POST",
      url: `/api/v1/widget/${connectors.deployment.publicKey}/message`,
      headers: { origin: "https://paused.example" },
      payload: { message: "Hello", anonymousSessionId: "paused-session" },
    })

    await app.close()
    expect(configResponse.statusCode).toBe(403)
    expect(configResponse.json()).toMatchObject({ error: { code: "WIDGET_CONNECTOR_INACTIVE" } })
    expect(scriptResponse.statusCode).toBe(403)
    expect(messageResponse.statusCode).toBe(403)
  })

  it("rate limits public widget messages per browser session", async () => {
    const store = createInMemoryProductionChatbotStore()
    let now = 1_000
    const app = await buildApi({
      logger: false,
      staticAssets: { enabled: false },
      productionChatbotStore: store,
      widgetRateLimit: { maxMessages: 2, windowMs: 60_000, now: () => now },
    })

    const project = (await app.inject({
      method: "POST",
      url: "/api/v1/admin/projects",
      payload: { name: "Rate Limited", domain: "ratelimited.example" },
    })).json().project
    const chatbot = (await app.inject({
      method: "POST",
      url: `/api/v1/admin/projects/${project.id}/chatbots`,
      payload: { name: "Website assistant" },
    })).json().chatbot
    const connectors = (await app.inject({
      method: "GET",
      url: `/api/v1/admin/chatbots/${chatbot.id}/connectors`,
    })).json()
    const content = (await app.inject({
      method: "POST",
      url: `/api/v1/admin/chatbots/${chatbot.id}/content`,
      payload: { title: "Office hours", body: "The office is open from 9 AM to 5 PM." },
    })).json().item
    await app.inject({ method: "POST", url: `/api/v1/admin/chatbots/${chatbot.id}/content/${content.id}/publish` })

    const first = await app.inject({
      method: "POST",
      url: `/api/v1/widget/${connectors.deployment.publicKey}/message`,
      headers: { origin: "https://ratelimited.example" },
      payload: { message: "When are you open?", anonymousSessionId: "same-browser" },
    })
    const second = await app.inject({
      method: "POST",
      url: `/api/v1/widget/${connectors.deployment.publicKey}/message`,
      headers: { origin: "https://ratelimited.example" },
      payload: { message: "What are office hours?", anonymousSessionId: "same-browser" },
    })
    const limited = await app.inject({
      method: "POST",
      url: `/api/v1/widget/${connectors.deployment.publicKey}/message`,
      headers: { origin: "https://ratelimited.example" },
      payload: { message: "Again?", anonymousSessionId: "same-browser" },
    })
    const differentSession = await app.inject({
      method: "POST",
      url: `/api/v1/widget/${connectors.deployment.publicKey}/message`,
      headers: { origin: "https://ratelimited.example" },
      payload: { message: "Another visitor?", anonymousSessionId: "other-browser" },
    })
    now += 60_001
    const afterWindow = await app.inject({
      method: "POST",
      url: `/api/v1/widget/${connectors.deployment.publicKey}/message`,
      headers: { origin: "https://ratelimited.example" },
      payload: { message: "After window?", anonymousSessionId: "same-browser" },
    })

    await app.close()
    expect(first.statusCode).toBe(200)
    expect(second.statusCode).toBe(200)
    expect(limited.statusCode).toBe(429)
    expect(limited.json()).toMatchObject({ error: { code: "WIDGET_RATE_LIMITED" } })
    expect(Number(limited.headers["retry-after"])).toBeGreaterThan(0)
    expect(differentSession.statusCode).toBe(200)
    expect(afterWindow.statusCode).toBe(200)
  })

  it("blocks public widget messages until allowed website domains are configured", async () => {
    const store = createInMemoryProductionChatbotStore()
    const app = await buildApi({ logger: false, staticAssets: { enabled: false }, productionChatbotStore: store })

    const project = (await app.inject({
      method: "POST",
      url: "/api/v1/admin/projects",
      payload: { name: "No Domain Realty" },
    })).json().project
    const chatbot = (await app.inject({
      method: "POST",
      url: `/api/v1/admin/projects/${project.id}/chatbots`,
      payload: { name: "Website assistant" },
    })).json().chatbot
    const content = (await app.inject({
      method: "POST",
      url: `/api/v1/admin/chatbots/${chatbot.id}/content`,
      payload: { title: "Lobby hours", body: "The lobby is open from 7 AM to 11 PM." },
    })).json().item
    await app.inject({ method: "POST", url: `/api/v1/admin/chatbots/${chatbot.id}/content/${content.id}/publish` })
    const connectors = (await app.inject({
      method: "GET",
      url: `/api/v1/admin/chatbots/${chatbot.id}/connectors`,
    })).json()

    const adminTest = await app.inject({
      method: "POST",
      url: `/api/v1/admin/chatbots/${chatbot.id}/test-message`,
      payload: { message: "When is the lobby open?" },
    })
    const widgetMessage = await app.inject({
      method: "POST",
      url: `/api/v1/widget/${connectors.deployment.publicKey}/message`,
      headers: { origin: "https://unconfigured.example" },
      payload: { message: "When is the lobby open?", anonymousSessionId: "no-domain-session" },
    })

    await app.close()
    expect(connectors.deployment.allowedDomains).toEqual([])
    expect(adminTest.statusCode).toBe(200)
    expect(adminTest.json()).toMatchObject({ fallback: false })
    expect(widgetMessage.statusCode).toBe(403)
    expect(widgetMessage.json()).toMatchObject({ error: { code: "WIDGET_DOMAIN_NOT_CONFIGURED" } })
  })

  it("lets admins pause and reactivate the website connector", async () => {
    const store = createInMemoryProductionChatbotStore()
    const app = await buildApi({ logger: false, staticAssets: { enabled: false }, productionChatbotStore: store })

    const project = (await app.inject({
      method: "POST",
      url: "/api/v1/admin/projects",
      payload: { name: "Connector Controls", domain: "controls.example" },
    })).json().project
    const chatbot = (await app.inject({
      method: "POST",
      url: `/api/v1/admin/projects/${project.id}/chatbots`,
      payload: { name: "Controlled assistant" },
    })).json().chatbot
    const content = (await app.inject({
      method: "POST",
      url: `/api/v1/admin/chatbots/${chatbot.id}/content`,
      payload: { title: "Maintenance hours", body: "Maintenance is available from 8 AM to 4 PM." },
    })).json().item
    await app.inject({ method: "POST", url: `/api/v1/admin/chatbots/${chatbot.id}/content/${content.id}/publish` })
    const connectors = (await app.inject({
      method: "GET",
      url: `/api/v1/admin/chatbots/${chatbot.id}/connectors`,
    })).json()

    const paused = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/chatbots/${chatbot.id}/connectors/website/status`,
      payload: { status: "paused" },
    })
    const blocked = await app.inject({
      method: "POST",
      url: `/api/v1/widget/${connectors.deployment.publicKey}/message`,
      headers: { origin: "https://controls.example" },
      payload: { message: "When is maintenance?", anonymousSessionId: "controlled-browser" },
    })
    const active = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/chatbots/${chatbot.id}/connectors/website/status`,
      payload: { status: "active" },
    })
    const answered = await app.inject({
      method: "POST",
      url: `/api/v1/widget/${connectors.deployment.publicKey}/message`,
      headers: { origin: "https://controls.example" },
      payload: { message: "When is maintenance?", anonymousSessionId: "controlled-browser-2" },
    })

    await app.close()
    expect(paused.statusCode).toBe(200)
    expect(paused.json().connector).toMatchObject({ channel: "website", status: "paused" })
    expect(blocked.statusCode).toBe(403)
    expect(blocked.json()).toMatchObject({ error: { code: "WIDGET_CONNECTOR_INACTIVE" } })
    expect(active.statusCode).toBe(200)
    expect(active.json().connector).toMatchObject({ channel: "website", status: "active" })
    expect(answered.statusCode).toBe(200)
    expect(answered.json().answer).toContain("Maintenance is available")
  })

  it("verifies a website install by fetching the target page and checking the snippet", async () => {
    const store = createInMemoryProductionChatbotStore()
    const app = await buildApi({ logger: false, staticAssets: { enabled: false }, productionChatbotStore: store })

    const project = (await app.inject({
      method: "POST",
      url: "/api/v1/admin/projects",
      payload: { name: "Install Verify", domain: "127.0.0.1" },
    })).json().project
    const chatbot = (await app.inject({
      method: "POST",
      url: `/api/v1/admin/projects/${project.id}/chatbots`,
      payload: { name: "Website assistant" },
    })).json().chatbot
    const connectors = (await app.inject({
      method: "GET",
      url: `/api/v1/admin/chatbots/${chatbot.id}/connectors`,
      headers: { host: "api.example.test" },
    })).json()

    await app.close()

    const verifyApp = await buildApi({
      logger: false,
      staticAssets: { enabled: false },
      productionChatbotStore: store,
      websiteInstallFetcher: async () => new Response(`<html><body>${connectors.deployment.installSnippet}</body></html>`, {
        headers: { "content-type": "text/html" },
      }),
    })

    const verifyResponse = await verifyApp.inject({
      method: "POST",
      url: `/api/v1/admin/chatbots/${chatbot.id}/connectors/website/verify`,
      payload: { websiteUrl: "https://127.0.0.1" },
    })

    expect(verifyResponse.statusCode).toBe(200)
    expect(verifyResponse.json()).toMatchObject({
      verified: true,
      deployment: { installStatus: "installed" },
    })

    await verifyApp.close()
  })

  it("updates website allowed domains before install verification", async () => {
    const store = createInMemoryProductionChatbotStore()
    const app = await buildApi({ logger: false, staticAssets: { enabled: false }, productionChatbotStore: store })

    const project = (await app.inject({
      method: "POST",
      url: "/api/v1/admin/projects",
      payload: { name: "Allowed Domain Test" },
    })).json().project
    const chatbot = (await app.inject({
      method: "POST",
      url: `/api/v1/admin/projects/${project.id}/chatbots`,
      payload: { name: "Website assistant" },
    })).json().chatbot

    const updateResponse = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/chatbots/${chatbot.id}/connectors/website`,
      payload: { allowedDomains: ["business.example", "www.business.example"] },
    })

    expect(updateResponse.statusCode).toBe(200)
    expect(updateResponse.json().deployment.allowedDomains).toEqual(["business.example", "www.business.example"])

    const blockedResponse = await app.inject({
      method: "POST",
      url: `/api/v1/widget/${updateResponse.json().deployment.publicKey}/message`,
      headers: { origin: "https://other.example" },
      payload: { message: "Hello" },
    })
    expect(blockedResponse.statusCode).toBe(403)

    await app.close()
  })

  it("records widget conversations and messages for auditability", async () => {
    const store = createInMemoryProductionChatbotStore()
    const app = await buildApi({ logger: false, staticAssets: { enabled: false }, productionChatbotStore: store })

    const project = (await app.inject({
      method: "POST",
      url: "/api/v1/admin/projects",
      payload: { name: "Conversation Audit", domain: "audit.example" },
    })).json().project
    const chatbot = (await app.inject({
      method: "POST",
      url: `/api/v1/admin/projects/${project.id}/chatbots`,
      payload: { name: "Website assistant" },
    })).json().chatbot
    const connectors = (await app.inject({
      method: "GET",
      url: `/api/v1/admin/chatbots/${chatbot.id}/connectors`,
    })).json()
    const content = (await app.inject({
      method: "POST",
      url: `/api/v1/admin/chatbots/${chatbot.id}/content`,
      payload: { title: "Viewing rules", body: "Tours are available daily at 2 PM." },
    })).json().item
    await app.inject({ method: "POST", url: `/api/v1/admin/chatbots/${chatbot.id}/content/${content.id}/publish` })

    await app.inject({
      method: "POST",
      url: `/api/v1/widget/${connectors.deployment.publicKey}/message`,
      headers: { origin: "https://audit.example" },
      payload: { message: "When are tours?", anonymousSessionId: "session-audit-1" },
    })

    const conversationsResponse = await app.inject({
      method: "GET",
      url: `/api/v1/admin/chatbots/${chatbot.id}/conversations`,
    })

    expect(conversationsResponse.statusCode).toBe(200)
    expect(conversationsResponse.json()).toMatchObject({
      items: [
        {
          channel: "website",
          externalThreadId: "session-audit-1",
          messageCount: 2,
          lastUserMessage: "When are tours?",
          lastAssistantMessage: expect.stringContaining("Tours are available"),
        },
      ],
    })

    await app.close()
  })

  it("can generate grounded answers through an injected production answer provider", async () => {
    const store = createInMemoryProductionChatbotStore({
      answerProvider: async ({ message, sources }) => ({
        answer: `LLM answer for "${message}" using ${sources.length} source(s).`,
        model: "openai-compatible-test",
      }),
    })
    const app = await buildApi({ logger: false, staticAssets: { enabled: false }, productionChatbotStore: store })

    const project = (await app.inject({
      method: "POST",
      url: "/api/v1/admin/projects",
      payload: { name: "Provider Test" },
    })).json().project
    const chatbot = (await app.inject({
      method: "POST",
      url: `/api/v1/admin/projects/${project.id}/chatbots`,
      payload: { name: "Provider bot" },
    })).json().chatbot
    const content = (await app.inject({
      method: "POST",
      url: `/api/v1/admin/chatbots/${chatbot.id}/content`,
      payload: { title: "Pool hours", body: "The pool is open from 8 AM to 8 PM." },
    })).json().item
    await app.inject({ method: "POST", url: `/api/v1/admin/chatbots/${chatbot.id}/content/${content.id}/publish` })

    const response = await app.inject({
      method: "POST",
      url: `/api/v1/admin/chatbots/${chatbot.id}/test-message`,
      payload: { message: "When is the pool open?" },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      answer: "LLM answer for \"When is the pool open?\" using 1 source(s).",
      fallback: false,
      retrieval: { model: "openai-compatible-test" },
    })

    await app.close()
  })

  it("propagates Agno agent trace metadata from the answer provider", async () => {
    const store = createInMemoryProductionChatbotStore({
      answerProvider: async ({ chatbot, sources }) => ({
        answer: `Agno answer for ${chatbot.agentKey}.`,
        model: "agno-agent",
        agentTraceId: "trace_123",
        actionTrace: { runtime: "agno", toolCalls: [], sourceIds: sources.map((source) => source.chunkId) },
      }),
    })
    const app = await buildApi({ logger: false, staticAssets: { enabled: false }, productionChatbotStore: store })

    const project = (await app.inject({
      method: "POST",
      url: "/api/v1/admin/projects",
      payload: { name: "Agno Trace Test" },
    })).json().project
    const chatbot = (await app.inject({
      method: "POST",
      url: `/api/v1/admin/projects/${project.id}/chatbots`,
      payload: { name: "Agno assistant" },
    })).json().chatbot
    expect(chatbot).toMatchObject({
      agentKey: expect.stringContaining("chatbot_"),
      knowledgeNamespace: expect.stringContaining("knowledge_"),
      runtimeStatus: "ready",
      lastIndexedContentVersionId: null,
      lastSyncError: null,
    })

    const content = (await app.inject({
      method: "POST",
      url: `/api/v1/admin/chatbots/${chatbot.id}/content`,
      payload: { title: "Gym rules", body: "The gym is open daily from 6 AM to 10 PM." },
    })).json().item
    const publishResponse = await app.inject({
      method: "POST",
      url: `/api/v1/admin/chatbots/${chatbot.id}/content/${content.id}/publish`,
    })
    expect(publishResponse.json().source).toMatchObject({ status: "indexed" })

    const response = await app.inject({
      method: "POST",
      url: `/api/v1/admin/chatbots/${chatbot.id}/test-message`,
      payload: { message: "When is the gym open?" },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      answer: expect.stringContaining("Agno answer"),
      fallback: false,
      retrieval: { model: "agno-agent" },
      agentTraceId: "trace_123",
      actionTrace: { runtime: "agno" },
    })

    await app.close()
  })

  it("requires service authentication for internal agent tool calls", async () => {
    const app = await buildApi({
      logger: false,
      staticAssets: { enabled: false },
      productionChatbotStore: createInMemoryProductionChatbotStore(),
    })

    const rejected = await app.inject({
      method: "POST",
      url: "/api/v1/internal/agent-tools/capture_lead",
      payload: { name: "Visitor" },
    })
    expect(rejected.statusCode).toBe(401)
    expect(rejected.json()).toMatchObject({ error: { code: "AGENT_TOOL_AUTH_REQUIRED" } })

    const accepted = await app.inject({
      method: "POST",
      url: "/api/v1/internal/agent-tools/capture_lead",
      headers: { authorization: "Bearer phase0_dev_only_agno_service_token" },
      payload: { name: "Visitor", phone: "+971500000000" },
    })
    expect(accepted.statusCode).toBe(200)
    expect(accepted.json()).toMatchObject({
      accepted: true,
      toolName: "capture_lead",
      actionTrace: { runtime: "fastify-agent-tool", status: "recorded_for_follow_up" },
    })

    const actionsResponse = await app.inject({
      method: "GET",
      url: "/api/v1/admin/agent-actions",
    })
    expect(actionsResponse.statusCode).toBe(200)
    expect(actionsResponse.json()).toMatchObject({
      items: [
        {
          toolName: "capture_lead",
          status: "recorded_for_follow_up",
          payload: { name: "Visitor", phone: "+971500000000" },
        },
      ],
    })

    await app.close()
  })
})
