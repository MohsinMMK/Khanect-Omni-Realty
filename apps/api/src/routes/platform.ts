import type { ProductionChatbotStore } from "@workspace/db"
import type { ConnectorChannel, ConnectorStatus } from "@workspace/db"
import type { FastifyPluginAsync } from "fastify"

interface PlatformRoutesOptions {
  store: ProductionChatbotStore
  allowDevAdminStub: boolean
  adminApiKey?: string
  agnoServiceToken?: string
  websiteInstallFetcher?: typeof fetch
  widgetRateLimit?: {
    maxMessages: number
    windowMs: number
    now?: () => number
  }
}

export function platformRoutes(options: PlatformRoutesOptions): FastifyPluginAsync {
  return async function registerPlatformRoutes(app) {
    const widgetRateLimit = createWidgetRateLimiter(options.widgetRateLimit)

    app.addHook("preHandler", async (request, reply) => {
      if (request.url.includes("/internal/agent-tools/")) {
        const expected = options.agnoServiceToken
        const authorization = request.headers.authorization
        if (!expected || authorization !== `Bearer ${expected}`) {
          return reply.status(401).send({
            error: {
              code: "AGENT_TOOL_AUTH_REQUIRED",
              message: "Agent tool calls require service authentication.",
            },
          })
        }
        return
      }
      if (!request.url.includes("/widget/") && !options.allowDevAdminStub) {
        if (isAdminAuthorized(request.headers, options.adminApiKey)) return
        await reply.status(401).send({
          error: {
            code: "ADMIN_AUTH_REQUIRED",
            message: "Admin API key is required.",
          },
        })
      }
    })

    app.get("/admin/projects", async () => ({ items: await options.store.listProjects() }))

    app.post("/internal/agent-tools/:toolName", async (request, reply) => {
      const { toolName } = request.params as { toolName: string }
      if (!["capture_lead", "request_human_handoff", "request_appointment", "get_business_contact"].includes(toolName)) {
        return reply.status(404).send({ error: { code: "AGENT_TOOL_NOT_FOUND", message: "Agent tool not found." } })
      }
      const body = (request.body ?? {}) as Record<string, unknown>
      const action = await options.store.recordAgentToolAction({
        toolName,
        payload: body,
        status: "recorded_for_follow_up",
      })
      return {
        accepted: true,
        toolName,
        action,
        actionTrace: {
          runtime: "fastify-agent-tool",
          status: "recorded_for_follow_up",
          payloadKeys: Object.keys(body),
        },
      }
    })

    app.get("/admin/agent-actions", async () => ({ items: await options.store.listAgentActions() }))

    app.post("/admin/projects", async (request, reply) => {
      const body = request.body as Partial<{ name: string; domain: string | null }>
      if (!body.name) return reply.status(400).send({ error: { code: "VALIDATION_ERROR", message: "name is required" } })
      try {
        return { project: await options.store.createProject({ name: body.name, domain: body.domain }) }
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          return reply.status(409).send({
            error: {
              code: "PROJECT_DOMAIN_EXISTS",
              message: "A project already uses this domain.",
            },
          })
        }
        throw error
      }
    })

    app.get("/admin/projects/:projectId/chatbots", async (request, reply) => {
      const { projectId } = request.params as { projectId: string }
      const project = await options.store.getProject(projectId)
      if (!project) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Project not found" } })
      return { items: await options.store.listChatbots(projectId) }
    })

    app.post("/admin/projects/:projectId/archive", async (request, reply) => {
      const { projectId } = request.params as { projectId: string }
      const project = await options.store.archiveProject(projectId)
      if (!project) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Project not found" } })
      return { project }
    })

    app.post("/admin/projects/:projectId/unarchive", async (request, reply) => {
      const { projectId } = request.params as { projectId: string }
      const project = await options.store.unarchiveProject(projectId)
      if (!project) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Project not found" } })
      return { project }
    })

    app.delete("/admin/projects/:projectId", async (request, reply) => {
      const { projectId } = request.params as { projectId: string }
      const project = await options.store.getProject(projectId)
      if (!project) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Project not found" } })
      if (project.status !== "archived") {
        return reply.status(409).send({
          error: {
            code: "PROJECT_ARCHIVE_REQUIRED",
            message: "Archive the project before deleting it.",
          },
        })
      }
      const deleted = await options.store.deleteProject(projectId)
      return { project: deleted ?? project }
    })

    app.post("/admin/projects/:projectId/chatbots", async (request, reply) => {
      const { projectId } = request.params as { projectId: string }
      const body = request.body as Partial<{
        name: string
        purpose: string
        capabilities: { faq?: boolean; leadCapture?: boolean; appointmentBooking?: boolean; propertyRecommendations?: boolean }
      }>
      if (!body.name) return reply.status(400).send({ error: { code: "VALIDATION_ERROR", message: "name is required" } })
      const chatbot = await options.store.createChatbot({
        projectId,
        name: body.name,
        purpose: body.purpose,
        capabilities: body.capabilities,
      })
      if (!chatbot) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Project not found" } })
      return { chatbot }
    })

    app.get("/admin/chatbots/:chatbotId", async (request, reply) => {
      const { chatbotId } = request.params as { chatbotId: string }
      const chatbot = await options.store.getChatbot(chatbotId)
      if (!chatbot) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Chatbot not found" } })
      return { chatbot }
    })

    app.post("/admin/chatbots/:chatbotId/archive", async (request, reply) => {
      const { chatbotId } = request.params as { chatbotId: string }
      const chatbot = await options.store.archiveChatbot(chatbotId)
      if (!chatbot) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Chatbot not found" } })
      return { chatbot }
    })

    app.post("/admin/chatbots/:chatbotId/unarchive", async (request, reply) => {
      const { chatbotId } = request.params as { chatbotId: string }
      const chatbot = await options.store.unarchiveChatbot(chatbotId)
      if (!chatbot) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Chatbot not found" } })
      return { chatbot }
    })

    app.delete("/admin/chatbots/:chatbotId", async (request, reply) => {
      const { chatbotId } = request.params as { chatbotId: string }
      const chatbot = await options.store.getChatbot(chatbotId)
      if (!chatbot) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Chatbot not found" } })
      if (chatbot.status !== "archived") {
        return reply.status(409).send({
          error: {
            code: "CHATBOT_ARCHIVE_REQUIRED",
            message: "Archive the chatbot before deleting it.",
          },
        })
      }
      const deleted = await options.store.deleteChatbot(chatbotId)
      return { chatbot: deleted ?? chatbot }
    })

    app.get("/admin/chatbots/:chatbotId/content", async (request, reply) => {
      const { chatbotId } = request.params as { chatbotId: string }
      const chatbot = await options.store.getChatbot(chatbotId)
      if (!chatbot) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Chatbot not found" } })
      return { items: await options.store.listContent(chatbotId) }
    })

    app.post("/admin/chatbots/:chatbotId/content", async (request, reply) => {
      const { chatbotId } = request.params as { chatbotId: string }
      const body = request.body as Partial<{ contentType: "project" | "property" | "faq" | "area" | "policy" | "general"; title: string; slug: string; body: string }>
      if (!body.title || !body.body) {
        return reply.status(400).send({ error: { code: "VALIDATION_ERROR", message: "title and body are required" } })
      }
      const item = await options.store.createContent(chatbotId, {
        contentType: body.contentType,
        title: body.title,
        slug: body.slug,
        body: body.body,
      })
      if (!item) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Chatbot not found" } })
      return { item }
    })

    app.patch("/admin/chatbots/:chatbotId/content/:contentId", async (request, reply) => {
      const { chatbotId, contentId } = request.params as { chatbotId: string; contentId: string }
      const body = request.body as Partial<{ contentType: "project" | "property" | "faq" | "area" | "policy" | "general"; title: string; slug: string; body: string }>
      const item = await options.store.patchContent(chatbotId, contentId, body)
      if (!item) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Content not found" } })
      return { item }
    })

    app.post("/admin/chatbots/:chatbotId/content/:contentId/publish", async (request, reply) => {
      const { chatbotId, contentId } = request.params as { chatbotId: string; contentId: string }
      const result = await options.store.publishContent(chatbotId, contentId)
      if (!result) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Content not found" } })
      return result
    })

    app.delete("/admin/chatbots/:chatbotId/content/:contentId", async (request, reply) => {
      const { chatbotId, contentId } = request.params as { chatbotId: string; contentId: string }
      const item = await options.store.deleteContent(chatbotId, contentId)
      if (!item) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Content not found" } })
      return { item }
    })

    app.get("/admin/chatbots/:chatbotId/knowledge", async (request, reply) => {
      const { chatbotId } = request.params as { chatbotId: string }
      const chatbot = await options.store.getChatbot(chatbotId)
      if (!chatbot) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Chatbot not found" } })
      return { items: await options.store.listKnowledge(chatbotId) }
    })

    app.post("/admin/chatbots/:chatbotId/test-message", async (request, reply) => {
      const { chatbotId } = request.params as { chatbotId: string }
      const body = request.body as Partial<{ message: string; topK: number }>
      if (!body.message) return reply.status(400).send({ error: { code: "VALIDATION_ERROR", message: "message is required" } })
      const answer = await options.store.testMessage(chatbotId, { message: body.message, topK: body.topK })
      if (!answer) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Chatbot not found" } })
      return answer
    })

    app.get("/admin/chatbots/:chatbotId/connectors", async (request, reply) => {
      const { chatbotId } = request.params as { chatbotId: string }
      const result = await options.store.listConnectors(chatbotId)
      if (!result) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Chatbot not found" } })
      return { ...result, deployment: withAbsoluteInstallSnippet(result.deployment, request) }
    })

    app.patch("/admin/chatbots/:chatbotId/connectors/website", async (request, reply) => {
      const { chatbotId } = request.params as { chatbotId: string }
      const body = request.body as Partial<{ allowedDomains: string[] }>
      if (!Array.isArray(body.allowedDomains)) {
        return reply.status(400).send({ error: { code: "VALIDATION_ERROR", message: "allowedDomains must be an array" } })
      }
      const allowedDomains = normalizeAllowedDomains(body.allowedDomains)
      const deployment = await options.store.updateWebsiteAllowedDomains(chatbotId, allowedDomains)
      if (!deployment) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Chatbot not found" } })
      return { deployment: withAbsoluteInstallSnippet(deployment, request) }
    })

    app.patch("/admin/chatbots/:chatbotId/connectors/:channel/status", async (request, reply) => {
      const { chatbotId, channel } = request.params as { chatbotId: string; channel: string }
      const body = request.body as Partial<{ status: string }>
      if (!isConnectorChannel(channel)) {
        return reply.status(400).send({ error: { code: "VALIDATION_ERROR", message: "channel is invalid" } })
      }
      if (!body.status || !isConnectorStatus(body.status)) {
        return reply.status(400).send({ error: { code: "VALIDATION_ERROR", message: "status is invalid" } })
      }
      const connector = await options.store.updateConnectorStatus(chatbotId, channel, body.status)
      if (!connector) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Connector not found" } })
      return { connector }
    })

    app.post("/admin/chatbots/:chatbotId/connectors/website/verify", async (request, reply) => {
      const { chatbotId } = request.params as { chatbotId: string }
      const body = request.body as Partial<{ websiteUrl: string }>
      if (!body.websiteUrl) return reply.status(400).send({ error: { code: "VALIDATION_ERROR", message: "websiteUrl is required" } })
      const result = await options.store.listConnectors(chatbotId)
      if (!result) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Chatbot not found" } })
      const parsed = parseWebsiteUrl(body.websiteUrl)
      if (!parsed) return reply.status(400).send({ error: { code: "VALIDATION_ERROR", message: "websiteUrl must be an http or https URL" } })
      if (!domainAllowed(parsed.hostname, result.deployment.allowedDomains)) {
        return reply.status(403).send({
          error: {
            code: "DOMAIN_NOT_ALLOWED",
            message: "The website URL host is not in this chatbot deployment's allowed domains.",
          },
        })
      }
      const fetcher = options.websiteInstallFetcher ?? fetch
      const response = await fetcher(parsed.toString(), { redirect: "follow" })
      const html = await response.text()
      const verified = response.ok && html.includes(`/widget/${result.deployment.publicKey}/widget.js`)
      const deployment = await options.store.updateWebsiteInstallStatus(chatbotId, verified ? "installed" : "unverified")
      return {
        verified,
        deployment: deployment ? withAbsoluteInstallSnippet(deployment, request) : null,
      }
    })

    app.get("/admin/chatbots/:chatbotId/conversations", async (request, reply) => {
      const { chatbotId } = request.params as { chatbotId: string }
      const chatbot = await options.store.getChatbot(chatbotId)
      if (!chatbot) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Chatbot not found" } })
      return { items: await options.store.listConversations(chatbotId) }
    })

    app.get("/widget/:publicKey/config", async (request, reply) => {
      const { publicKey } = request.params as { publicKey: string }
      setWidgetCorsHeaders(reply)
      const deployment = await getActiveWebsiteDeployment(options.store, publicKey)
      if (!deployment) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Widget not found" } })
      if (deployment === "inactive") return sendInactiveWidget(reply)
      return {
        widget: {
          publicKey: deployment.publicKey,
          title: "Chat with us",
          subtitle: "Approved answers from this business",
          launcherLabel: "Chat",
        },
      }
    })

    app.get("/widget/:publicKey/widget.js", async (request, reply) => {
      const { publicKey } = request.params as { publicKey: string }
      setWidgetCorsHeaders(reply)
      const deployment = await getActiveWebsiteDeployment(options.store, publicKey)
      if (!deployment) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Widget not found" } })
      if (deployment === "inactive") return sendInactiveWidget(reply)
      reply.type("application/javascript")
      return buildWebsiteWidgetScript(publicKey)
    })

    app.options("/widget/:publicKey/message", async (_request, reply) => {
      setWidgetCorsHeaders(reply)
      return reply.status(204).send()
    })

    app.post("/widget/:publicKey/message", async (request, reply) => {
      const { publicKey } = request.params as { publicKey: string }
      const body = request.body as Partial<{ message: string; anonymousSessionId: string }>
      if (!body.message) return reply.status(400).send({ error: { code: "VALIDATION_ERROR", message: "message is required" } })
      const deployment = await getActiveWebsiteDeployment(options.store, publicKey)
      if (!deployment) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Widget not found" } })
      if (deployment === "inactive") {
        setWidgetCorsHeaders(reply)
        return sendInactiveWidget(reply)
      }
      if (deployment.allowedDomains.length === 0) {
        setWidgetCorsHeaders(reply)
        return reply.status(403).send({
          error: {
            code: "WIDGET_DOMAIN_NOT_CONFIGURED",
            message: "Configure at least one allowed website domain before using this chatbot widget.",
          },
        })
      }
      if (!originAllowed(request.headers.origin, deployment.allowedDomains)) {
        setWidgetCorsHeaders(reply)
        return reply.status(403).send({
          error: {
            code: "ORIGIN_NOT_ALLOWED",
            message: "This website is not allowed to use the chatbot widget.",
          },
        })
      }
      const rateLimit = widgetRateLimit.check({
        publicKey,
        origin: request.headers.origin,
        anonymousSessionId: body.anonymousSessionId,
      })
      if (!rateLimit.allowed) {
        setWidgetCorsHeaders(reply)
        reply.header("retry-after", String(Math.ceil(rateLimit.retryAfterMs / 1000)))
        return reply.status(429).send({
          error: {
            code: "WIDGET_RATE_LIMITED",
            message: "Too many chatbot messages. Please try again shortly.",
          },
        })
      }
      const answer = await options.store.sendWidgetMessage(publicKey, {
        message: body.message,
        anonymousSessionId: body.anonymousSessionId,
      })
      if (!answer) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Widget not found" } })
      setWidgetCorsHeaders(reply)
      return answer
    })
  }
}

async function getActiveWebsiteDeployment(store: ProductionChatbotStore, publicKey: string) {
  const deployment = await store.getDeploymentByPublicKey(publicKey)
  if (!deployment) return null
  const result = await store.listConnectors(deployment.chatbotId)
  const website = result?.connectors.find((connector) => connector.channel === "website")
  return website?.status === "active" ? deployment : "inactive"
}

function sendInactiveWidget(reply: { status(code: number): { send(payload: unknown): unknown } }) {
  return reply.status(403).send({
    error: {
      code: "WIDGET_CONNECTOR_INACTIVE",
      message: "Website chatbot connector is not active.",
    },
  })
}

function createWidgetRateLimiter(options: PlatformRoutesOptions["widgetRateLimit"] = { maxMessages: 30, windowMs: 60_000 }) {
  const buckets = new Map<string, { count: number; resetAt: number }>()
  const now = options.now ?? (() => Date.now())

  return {
    check(input: { publicKey: string; origin?: string; anonymousSessionId?: string }) {
      const current = now()
      const key = [
        input.publicKey,
        input.origin ?? "no-origin",
        input.anonymousSessionId?.trim() || "anonymous",
      ].join(":")
      const existing = buckets.get(key)
      if (!existing || existing.resetAt <= current) {
        buckets.set(key, { count: 1, resetAt: current + options.windowMs })
        return { allowed: true, retryAfterMs: 0 }
      }
      if (existing.count >= options.maxMessages) {
        return { allowed: false, retryAfterMs: Math.max(1, existing.resetAt - current) }
      }
      existing.count += 1
      return { allowed: true, retryAfterMs: 0 }
    },
  }
}

function originAllowed(origin: string | undefined, allowedDomains: string[]) {
  if (!origin || allowedDomains.length === 0) return true
  try {
    const hostname = new URL(origin).hostname.toLowerCase()
    return domainAllowed(hostname, allowedDomains)
  } catch {
    return false
  }
}

function parseWebsiteUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:" ? url : null
  } catch {
    return null
  }
}

function normalizeAllowedDomains(values: string[]) {
  const normalized = values
    .map((value) => normalizeAllowedDomain(value))
    .filter((value): value is string => Boolean(value))
  return [...new Set(normalized)]
}

function normalizeAllowedDomain(value: string) {
  const trimmed = value.trim().toLowerCase()
  if (!trimmed) return null
  try {
    const candidate = trimmed.includes("://") ? trimmed : `https://${trimmed}`
    return new URL(candidate).hostname
  } catch {
    return trimmed.replace(/^https?:\/\//, "").split("/")[0]?.split(":")[0] || null
  }
}

function isConnectorChannel(value: string): value is ConnectorChannel {
  return ["website", "whatsapp", "instagram_dm"].includes(value)
}

function isConnectorStatus(value: string): value is ConnectorStatus {
  return ["active", "not_configured", "needs_credentials", "error", "paused"].includes(value)
}

function domainAllowed(hostname: string, allowedDomains: string[]) {
  if (allowedDomains.length === 0) return true
  const normalized = hostname.toLowerCase()
  return allowedDomains.some((domain) => domain.toLowerCase() === normalized)
}

function isUniqueConstraintError(error: unknown): boolean {
  let current: unknown = error
  while (current && typeof current === "object") {
    if ("code" in current && current.code === "23505") return true
    current = "cause" in current ? current.cause : undefined
  }
  return false
}

function isAdminAuthorized(headers: Record<string, string | string[] | undefined>, adminApiKey: string | undefined) {
  if (!adminApiKey) return false
  const direct = headers["x-khanect-admin-api-key"]
  if (direct === adminApiKey || (Array.isArray(direct) && direct.includes(adminApiKey))) return true
  const authorization = headers.authorization
  return authorization === `Bearer ${adminApiKey}`
}

function setWidgetCorsHeaders(reply: {
  header(name: string, value: string): unknown
}) {
  reply.header("access-control-allow-origin", "*")
  reply.header("access-control-allow-methods", "GET,POST,OPTIONS")
  reply.header("access-control-allow-headers", "content-type")
}

function buildWebsiteWidgetScript(publicKey: string) {
  const messagePath = `/api/v1/widget/${publicKey}/message`
  return `(() => {
  if (window.KhanectWidget && window.KhanectWidget.mounted) return;
  const scriptUrl = new URL(document.currentScript.src);
  const messageEndpoint = new URL(${JSON.stringify(messagePath)}, scriptUrl.origin).toString();
  window.KhanectWidget = { publicKey: ${JSON.stringify(publicKey)}, mounted: true, apiOrigin: scriptUrl.origin };

  const root = document.createElement("div");
  root.id = "khanect-widget";
  root.setAttribute("aria-live", "polite");
  root.innerHTML = \`
    <style>
      #khanect-widget{position:fixed;right:20px;bottom:20px;z-index:2147483647;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#171717}
      #khanect-widget *{box-sizing:border-box}
      #khanect-widget .kw-panel{width:min(360px,calc(100vw - 32px));overflow:hidden;border:1px solid rgba(23,23,23,.12);border-radius:18px;background:#fff;box-shadow:0 24px 70px rgba(0,0,0,.22)}
      #khanect-widget .kw-header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border-bottom:1px solid rgba(23,23,23,.08);background:#171717;color:#fff}
      #khanect-widget .kw-title{font-size:14px;font-weight:700}
      #khanect-widget .kw-subtitle{font-size:12px;color:rgba(255,255,255,.72)}
      #khanect-widget .kw-close,#khanect-widget .kw-launcher{border:0;cursor:pointer}
      #khanect-widget .kw-close{border-radius:999px;background:rgba(255,255,255,.12);color:#fff;width:30px;height:30px}
      #khanect-widget .kw-messages{display:flex;min-height:220px;max-height:320px;flex-direction:column;gap:10px;overflow:auto;padding:14px;background:#fafafa}
      #khanect-widget .kw-message{max-width:88%;border-radius:14px;padding:10px 12px;font-size:13px;line-height:1.4}
      #khanect-widget .kw-message.kw-bot{align-self:flex-start;background:#fff;border:1px solid rgba(23,23,23,.08)}
      #khanect-widget .kw-message.kw-user{align-self:flex-end;background:#171717;color:#fff}
      #khanect-widget .kw-form{display:flex;gap:8px;padding:12px;border-top:1px solid rgba(23,23,23,.08);background:#fff}
      #khanect-widget .kw-input{min-width:0;flex:1;border:1px solid rgba(23,23,23,.14);border-radius:999px;padding:10px 12px;font:inherit;font-size:13px;outline:none}
      #khanect-widget .kw-send{border:0;border-radius:999px;background:#171717;color:#fff;padding:0 14px;font-weight:700;cursor:pointer}
      #khanect-widget .kw-launcher{display:none;border-radius:999px;background:#171717;color:#fff;padding:12px 16px;font-weight:800;box-shadow:0 16px 40px rgba(0,0,0,.22)}
      #khanect-widget.kw-collapsed .kw-panel{display:none}
      #khanect-widget.kw-collapsed .kw-launcher{display:block}
    </style>
    <section class="kw-panel" role="dialog" aria-label="Website chatbot">
      <div class="kw-header">
        <div><div class="kw-title">Chat with us</div><div class="kw-subtitle">Approved answers from this business</div></div>
        <button class="kw-close" type="button" aria-label="Minimize chatbot">×</button>
      </div>
      <div class="kw-messages">
        <div class="kw-message kw-bot">Hi, ask me a question about this business.</div>
      </div>
      <form class="kw-form">
        <input class="kw-input" name="message" autocomplete="off" placeholder="Type your question..." />
        <button class="kw-send" type="submit">Send</button>
      </form>
    </section>
    <button class="kw-launcher" type="button">Chat</button>
  \`;
  document.body.appendChild(root);

  const messages = root.querySelector(".kw-messages");
  const form = root.querySelector(".kw-form");
  const input = root.querySelector(".kw-input");
  const closeButton = root.querySelector(".kw-close");
  const launcher = root.querySelector(".kw-launcher");
  const sessionId = window.localStorage.getItem("khanect-widget-session") || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
  window.localStorage.setItem("khanect-widget-session", sessionId);

  function appendMessage(text, role) {
    const node = document.createElement("div");
    node.className = "kw-message " + (role === "user" ? "kw-user" : "kw-bot");
    node.textContent = text;
    messages.appendChild(node);
    messages.scrollTop = messages.scrollHeight;
  }

  closeButton.addEventListener("click", () => root.classList.add("kw-collapsed"));
  launcher.addEventListener("click", () => root.classList.remove("kw-collapsed"));
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = input.value.trim();
    if (!message) return;
    input.value = "";
    appendMessage(message, "user");
    const pending = "Checking approved sources...";
    appendMessage(pending, "bot");
    try {
      const response = await fetch(messageEndpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, anonymousSessionId: sessionId })
      });
      const data = await response.json();
      if (!response.ok) {
        messages.lastElementChild.textContent = data && data.error && data.error.message ? data.error.message : "Chat is unavailable right now. Please try again later.";
        return;
      }
      messages.lastElementChild.textContent = data.answer || "I do not have an approved answer yet.";
    } catch {
      messages.lastElementChild.textContent = "Chat is unavailable right now. Please try again later.";
    }
  });
})();`
}

function withAbsoluteInstallSnippet<T extends { publicKey: string }>(
  deployment: T,
  request: { protocol: string; hostname: string; headers: { host?: string | string[] } },
) {
  const hostHeader = Array.isArray(request.headers.host) ? request.headers.host[0] : request.headers.host
  const origin = `${request.protocol}://${hostHeader ?? request.hostname}`
  return {
    ...deployment,
    installSnippet: `<script async src="${origin}/api/v1/widget/${deployment.publicKey}/widget.js"></script>`,
  }
}
