import type { AppConfig } from "@workspace/config"
import {
  AGENT_CAPABILITY_POLICY_VERSION,
  validateAgentCapabilities,
  type AgentSourceType,
  type AgentToolId,
  type EmbeddingProviderMode,
} from "@workspace/core"
import type { ChatbotDto, ProductionChatbotStore } from "@workspace/db"
import type { ConnectorChannel, ConnectorStatus } from "@workspace/db"
import type { FastifyPluginAsync } from "fastify"

import {
  type AdminAuthOptions,
  isAdminApiKeyAuthorized,
  resolveAdminAuth,
  sendAdminAuthRequired,
} from "../admin-auth.js"
import { probeProjectEmbedding, runProjectEmbeddingSmokeTest, runProjectLlmSmokeTest } from "../project-ai-admin.js"
import type { RagIndexEnqueuer } from "../rag-index-enqueuer.js"

interface PlatformRoutesOptions {
  store: ProductionChatbotStore
  appConfig: AppConfig
  adminAuth: AdminAuthOptions
  agnoServiceToken?: string
  ragIndexEnqueuer?: RagIndexEnqueuer
  websiteInstallFetcher?: typeof fetch
  widgetRateLimit?: {
    maxMessages: number
    windowMs: number
    now?: () => number
  }
}

const defaultWidgetRateLimit = { maxMessages: 30, windowMs: 60_000 }

export function platformRoutes(options: PlatformRoutesOptions): FastifyPluginAsync {
  return async function registerPlatformRoutes(app) {
    const widgetRateLimitConfig = { ...defaultWidgetRateLimit, ...options.widgetRateLimit }
    const widgetRateLimit = createWidgetRateLimiter(widgetRateLimitConfig)

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
      if (request.url.includes("/admin/bootstrap")) {
        if (!isAdminApiKeyAuthorized(request.headers, options.adminAuth.adminApiKey)) {
          return reply.status(401).send({
            error: {
              code: "ADMIN_AUTH_REQUIRED",
              message: "Bootstrap requires ADMIN_API_KEY.",
            },
          })
        }
        return
      }
      if (!request.url.includes("/widget/")) {
        const authResult = await resolveAdminAuth(request.headers, options.adminAuth)
        if (!authResult.authorized) {
          return sendAdminAuthRequired(reply, options.adminAuth.betterAuthEnabled)
        }
      }
    })

    app.post("/admin/bootstrap", async (request, reply) => {
      if (!options.adminAuth.betterAuthEnabled || !options.adminAuth.auth) {
        return reply.status(503).send({
          error: {
            code: "BETTER_AUTH_DISABLED",
            message: "Set BETTER_AUTH_ENABLED=true before bootstrapping admin users.",
          },
        })
      }
      const bootstrapEmail = options.appConfig.auth.bootstrapEmail
      if (!bootstrapEmail) {
        return reply.status(400).send({
          error: {
            code: "BOOTSTRAP_EMAIL_REQUIRED",
            message: "ADMIN_BOOTSTRAP_EMAIL must be configured.",
          },
        })
      }
      const body = (request.body ?? {}) as { password?: string; name?: string }
      const password = typeof body.password === "string" ? body.password : ""
      if (password.length < 12) {
        return reply.status(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: "password must be at least 12 characters.",
          },
        })
      }
      try {
        const result = await options.adminAuth.auth.api.signUpEmail({
          body: {
            email: bootstrapEmail,
            password,
            name: typeof body.name === "string" && body.name.trim() ? body.name.trim() : "Platform Admin",
          },
        })
        return {
          bootstrapComplete: true,
          user: {
            id: result.user.id,
            email: result.user.email,
          },
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Bootstrap failed."
        const statusCode = message.toLowerCase().includes("already") ? 409 : 400
        return reply.status(statusCode).send({
          error: {
            code: statusCode === 409 ? "BOOTSTRAP_ALREADY_DONE" : "BOOTSTRAP_FAILED",
            message,
          },
        })
      }
    })

    app.get("/admin/projects", async () => ({ items: await options.store.listProjects() }))

    app.post("/internal/agent-tools/:toolName", async (request, reply) => {
      const { toolName } = request.params as { toolName: string }
      if (!["capture_lead", "request_human_handoff", "request_appointment", "get_business_contact", "recommend_property"].includes(toolName)) {
        return reply.status(404).send({ error: { code: "AGENT_TOOL_NOT_FOUND", message: "Agent tool not found." } })
      }
      const body = (request.body ?? {}) as Record<string, unknown>
      const policy = body.policy
      if (isPolicyToolList(policy) && !policy.toolsEnabled.includes(toolName as AgentToolId)) {
        return reply.status(403).send({
          error: {
            code: "AGENT_TOOL_DENIED_BY_POLICY",
            message: "This tool is not enabled by the chatbot capability policy.",
          },
        })
      }
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

    app.get("/admin/projects/:projectId/ai-config", async (request, reply) => {
      const { projectId } = request.params as { projectId: string }
      const config = await options.store.getProjectAiConfig(projectId)
      if (!config) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Project not found" } })
      const secrets = await options.store.getProjectAiSecrets(projectId)
      const probe = await probeProjectEmbedding(secrets, options.appConfig)
      const requiresReindex = await projectRequiresKnowledgeReindex(options.store, projectId)
      return { ...config, embedding: { ...config.embedding, requiresReindex: config.embedding.requiresReindex || requiresReindex, probe } }
    })

    app.patch("/admin/projects/:projectId/ai-config", async (request, reply) => {
      const { projectId } = request.params as { projectId: string }
      const body = request.body as Partial<{
        llm: {
          source?: "platform" | "project"
          apiKey?: string | null
          baseUrl?: string | null
          model?: string | null
        }
        embedding: {
          source?: "platform" | "project"
          provider?: EmbeddingProviderMode
          apiKey?: string | null
          baseUrl?: string | null
          embedderUrl?: string | null
          model?: string | null
        }
      }>

      if (body.embedding?.provider === "stub") {
        return reply.status(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: "Project embedding provider cannot be stub. Use the enforced local BGE runtime.",
          },
        })
      }

      if (body.llm?.source === "project") {
        const current = await options.store.getProjectAiSecrets(projectId)
        const hasApiKey = Boolean(body.llm.apiKey?.trim() || current?.llmApiKey?.trim())
        const hasBaseUrl = Boolean((body.llm.baseUrl ?? current?.llmBaseUrl)?.trim())
        const hasModel = Boolean((body.llm.model ?? current?.llmModel)?.trim())
        if (!hasApiKey || !hasBaseUrl || !hasModel) {
          return reply.status(400).send({
            error: {
              code: "VALIDATION_ERROR",
              message: "Project LLM source requires an API key, base URL, and model before chatbot creation.",
            },
          })
        }
      }

      let updated
      try {
        updated = await options.store.updateProjectAiConfig(projectId, body)
      } catch (error) {
        return reply.status(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: error instanceof Error ? error.message : "Project AI config is invalid.",
          },
        })
      }
      if (!updated) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Project not found" } })
      const requiresReindex = await projectRequiresKnowledgeReindex(options.store, projectId)
      return { config: { ...updated, embedding: { ...updated.embedding, requiresReindex: updated.embedding.requiresReindex || requiresReindex } } }
    })

    app.post("/admin/projects/:projectId/ai-config/embedding/test", async (request, reply) => {
      const { projectId } = request.params as { projectId: string }
      const body = (request.body ?? {}) as { sample?: string }
      const project = await options.store.getProject(projectId)
      if (!project) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Project not found" } })
      const secrets = await options.store.getProjectAiSecrets(projectId)
      try {
        const result = await runProjectEmbeddingSmokeTest(secrets, options.appConfig, body.sample)
        return result
      } catch (error) {
        return reply.status(502).send({
          error: {
            code: "EMBEDDING_SMOKE_TEST_FAILED",
            message: error instanceof Error ? error.message : "Embedding smoke test failed",
          },
        })
      }
    })

    app.post("/admin/projects/:projectId/ai-config/llm/test", async (request, reply) => {
      const { projectId } = request.params as { projectId: string }
      const body = (request.body ?? {}) as { sample?: string }
      const project = await options.store.getProject(projectId)
      if (!project) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Project not found" } })
      const secrets = await options.store.getProjectAiSecrets(projectId)
      try {
        const result = await runProjectLlmSmokeTest(secrets, options.appConfig, body.sample)
        return result
      } catch (error) {
        return reply.status(502).send({
          error: {
            code: "LLM_SMOKE_TEST_FAILED",
            message: error instanceof Error ? error.message : "LLM smoke test failed",
          },
        })
      }
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
      return { chatbot: await refreshChatbotRuntimeStatus(options, chatbot) }
    })

    app.get("/admin/chatbots/:chatbotId", async (request, reply) => {
      const { chatbotId } = request.params as { chatbotId: string }
      const chatbot = await options.store.getChatbot(chatbotId)
      if (!chatbot) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Chatbot not found" } })
      return { chatbot }
    })

    app.patch("/admin/chatbots/:chatbotId", async (request, reply) => {
      const { chatbotId } = request.params as { chatbotId: string }
      const body = request.body as Partial<{
        name: string
        purpose: string
        capabilities: { faq?: boolean; leadCapture?: boolean; appointmentBooking?: boolean; propertyRecommendations?: boolean }
      }>
      if (body.name !== undefined && !body.name.trim()) {
        return reply.status(400).send({ error: { code: "VALIDATION_ERROR", message: "name cannot be empty" } })
      }
      const chatbot = await options.store.updateChatbot(chatbotId, {
        name: body.name?.trim(),
        purpose: body.purpose,
        capabilities: body.capabilities,
      })
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
      return { chatbot: await refreshChatbotRuntimeStatus(options, chatbot) }
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

      if (options.ragIndexEnqueuer) {
        let indexingError: string | undefined
        try {
          await options.ragIndexEnqueuer({
            chatbotId,
            contentItemId: contentId,
            contentVersionId: result.source.sourceVersionId,
            documentId: result.documentId,
          })
        } catch (error) {
          request.log.error(
            {
              err: error,
              errorMessage: error instanceof Error ? error.message : String(error),
              chatbotId,
              contentId,
            },
            "failed to enqueue rag.index job",
          )
          indexingError = error instanceof Error ? error.message : String(error)
        }

        const refreshedSource = (await options.store.listKnowledge(chatbotId)).find((item) => item.contentItemId === contentId)
        return {
          item: result.item,
          source: refreshedSource ?? result.source,
          chunkCount: refreshedSource?.chunkCount ?? result.chunkCount,
          documentId: result.documentId,
          indexing: indexingError ? false : refreshedSource?.status !== "indexed",
          ...(indexingError ? { indexingError } : {}),
        }
      }

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

    app.post("/admin/chatbots/:chatbotId/knowledge/reindex", async (request, reply) => {
      const { chatbotId } = request.params as { chatbotId: string }
      const chatbot = await options.store.getChatbot(chatbotId)
      if (!chatbot) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Chatbot not found" } })
      const publishedItems = (await options.store.listContent(chatbotId)).filter((item) => item.status === "published")
      const results = []
      for (const item of publishedItems) {
        const result = await options.store.publishContent(chatbotId, item.id)
        if (!result) continue
        if (options.ragIndexEnqueuer) {
          await options.ragIndexEnqueuer({
            chatbotId,
            contentItemId: item.id,
            contentVersionId: result.source.sourceVersionId,
            documentId: result.documentId,
          })
        }
        results.push({
          contentItemId: item.id,
          sourceVersionId: result.source.sourceVersionId,
          documentId: result.documentId,
          indexing: true,
        })
      }
      return {
        chatbotId,
        reindexed: results.length,
        items: results,
      }
    })

    app.get("/admin/chatbots/:chatbotId/runtime", async (request, reply) => {
      const { chatbotId } = request.params as { chatbotId: string }
      const chatbot = await options.store.getChatbot(chatbotId)
      if (!chatbot) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Chatbot not found" } })
      const config = await options.store.getProjectAiConfig(chatbot.projectId)
      const indexedSourceTypes = (await options.store.listKnowledge(chatbotId))
        .filter((source) => source.status === "indexed")
        .map((source) => source.sourceType as AgentSourceType)
      const capabilities = validateAgentCapabilities({
        capabilities: chatbot.capabilities,
        indexedSourceTypes,
      })
      const agno = await probeAgnoRuntime(options.appConfig)
      const runtimeStatus = chatbot.status === "archived"
        ? "paused"
        : agno.enabled && agno.status !== "ok"
          ? "error"
          : chatbot.runtimeStatus === "provisioning"
            ? "live"
            : chatbot.runtimeStatus
      const lastSyncError = agno.enabled && agno.status !== "ok" ? agno.detail : chatbot.lastSyncError
      const updated = runtimeStatus !== chatbot.runtimeStatus || lastSyncError !== chatbot.lastSyncError
        ? await options.store.updateChatbotRuntimeStatus(chatbot.id, { runtimeStatus, lastSyncError })
        : chatbot

      return {
        chatbotId,
        runtimeStatus: updated?.runtimeStatus ?? runtimeStatus,
        agno,
        model: {
          source: config?.llm.source ?? "platform",
          name: config?.llm.effectiveModel ?? options.appConfig.ai.llmModel,
        },
        embedding: {
          source: config?.embedding.source ?? "platform",
          provider: config?.embedding.provider ?? options.appConfig.ai.embeddingProvider,
          model: config?.embedding.model ?? options.appConfig.ai.embeddingModel,
          dimension: config?.embedding.dimension ?? options.appConfig.ai.embeddingDimension,
          status: config?.embedding.status ?? "ok",
          requiresReindex: config?.embedding.requiresReindex ?? false,
        },
        latest: {
          agentTraceId: null,
          lastSyncError: updated?.lastSyncError ?? lastSyncError ?? null,
        },
        capabilities: {
          enabled: capabilities.enabled,
          availableTools: capabilities.availableTools,
          missingRequirements: capabilities.missingRequirements,
          ready: capabilities.ready,
        },
        policyVersion: AGENT_CAPABILITY_POLICY_VERSION,
      }
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
      const deployment = withAbsoluteInstallSnippet(result.deployment, request)
      return {
        ...result,
        deployment,
        widgetPolicy: buildWidgetPolicy(deployment, widgetRateLimitConfig),
      }
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

    app.post("/admin/chatbots/:chatbotId/connectors/website/origin-check", async (request, reply) => {
      const { chatbotId } = request.params as { chatbotId: string }
      const body = request.body as Partial<{ origin: string }>
      if (!body.origin?.trim()) {
        return reply.status(400).send({ error: { code: "VALIDATION_ERROR", message: "origin is required" } })
      }
      const result = await options.store.listConnectors(chatbotId)
      if (!result) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Chatbot not found" } })
      const parsed = parseOriginInput(body.origin)
      if (!parsed) {
        return reply.status(400).send({ error: { code: "VALIDATION_ERROR", message: "origin must be a valid URL or hostname" } })
      }
      if (result.deployment.allowedDomains.length === 0) {
        return {
          allowed: false,
          hostname: parsed.hostname,
          origin: parsed.origin,
          reason: "Configure at least one allowed website domain before public widget chat is enabled.",
          code: "WIDGET_DOMAIN_NOT_CONFIGURED",
        }
      }
      const matchedDomain = result.deployment.allowedDomains.find((domain) => domain.toLowerCase() === parsed.hostname)
      const allowed = Boolean(matchedDomain)
      return {
        allowed,
        hostname: parsed.hostname,
        origin: parsed.origin,
        matchedDomain: matchedDomain ?? null,
        reason: allowed
          ? undefined
          : `Origin host "${parsed.hostname}" is not in the allowed domain list.`,
        code: allowed ? undefined : "ORIGIN_NOT_ALLOWED",
      }
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

async function refreshChatbotRuntimeStatus(options: PlatformRoutesOptions, chatbot: ChatbotDto) {
  if (chatbot.status === "archived") return chatbot
  const agno = await probeAgnoRuntime(options.appConfig)
  const runtimeStatus: ChatbotDto["runtimeStatus"] = agno.enabled && agno.status !== "ok" ? "error" : "live"
  const lastSyncError = agno.enabled && agno.status !== "ok" ? agno.detail : null
  return await options.store.updateChatbotRuntimeStatus(chatbot.id, { runtimeStatus, lastSyncError }) ?? {
    ...chatbot,
    runtimeStatus,
    lastSyncError,
  }
}

async function projectRequiresKnowledgeReindex(store: ProductionChatbotStore, projectId: string) {
  const chatbots = await store.listChatbots(projectId)
  for (const chatbot of chatbots) {
    if (chatbot.runtimeStatus === "syncing" || chatbot.runtimeStatus === "error") return true
    const knowledge = await store.listKnowledge(chatbot.id)
    if (knowledge.some((source) => source.status !== "indexed")) return true
  }
  return false
}

async function probeAgnoRuntime(config: AppConfig) {
  if (!config.agno.enabled) {
    return {
      enabled: false,
      status: "disabled" as const,
      runtime: null,
      detail: "AGNO_ENABLED is false.",
    }
  }

  try {
    const response = await fetch(new URL("/health", config.agno.agentUrl), {
      signal: AbortSignal.timeout(3_000),
    })
    if (!response.ok) {
      return {
        enabled: true,
        status: "unavailable" as const,
        runtime: null,
        detail: `Agno health returned ${response.status}.`,
      }
    }
    const body = (await response.json()) as Partial<{ status: string; runtime: string }>
    const ok = body.status === "ok" && body.runtime === "agno"
    return {
      enabled: true,
      status: ok ? ("ok" as const) : ("unavailable" as const),
      runtime: body.runtime ?? null,
      detail: ok ? undefined : "Agno health response did not report an ok agno runtime.",
    }
  } catch (error) {
    return {
      enabled: true,
      status: "unavailable" as const,
      runtime: null,
      detail: error instanceof Error ? error.message : "Agno health check failed.",
    }
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

function parseOriginInput(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  try {
    const url = trimmed.includes("://") ? new URL(trimmed) : new URL(`https://${trimmed}`)
    if (url.protocol !== "http:" && url.protocol !== "https:") return null
    return { hostname: url.hostname.toLowerCase(), origin: url.origin }
  } catch {
    return null
  }
}

function buildWidgetPolicy(
  deployment: { allowedDomains: string[]; installStatus: string },
  rateLimit: { maxMessages: number; windowMs: number },
) {
  const windowSeconds = Math.max(1, Math.round(rateLimit.windowMs / 1000))
  return {
    originProtection: deployment.allowedDomains.length > 0 ? ("enforced" as const) : ("blocked_until_configured" as const),
    allowedDomains: deployment.allowedDomains,
    installStatus: deployment.installStatus,
    rateLimit: {
      maxMessages: rateLimit.maxMessages,
      windowMs: rateLimit.windowMs,
      summary: `${rateLimit.maxMessages} messages per ${windowSeconds} seconds per visitor session`,
    },
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

function isPolicyToolList(value: unknown): value is { toolsEnabled: AgentToolId[] } {
  return Boolean(
    value &&
      typeof value === "object" &&
      "toolsEnabled" in value &&
      Array.isArray(value.toolsEnabled) &&
      value.toolsEnabled.every((tool) => typeof tool === "string"),
  )
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
        const retryAfter = response.headers.get("retry-after");
        const errorMessage = data && data.error && data.error.message ? data.error.message : "Chat is unavailable right now. Please try again later.";
        messages.lastElementChild.textContent = response.status === 429 && retryAfter
          ? errorMessage + " Try again in " + retryAfter + " seconds."
          : errorMessage;
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
