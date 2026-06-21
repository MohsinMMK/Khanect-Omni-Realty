import type { Phase1aStore } from "@workspace/db"
import type { FastifyInstance } from "fastify"

interface AdminRoutesOptions {
  store: Phase1aStore
  allowDevAdminStub: boolean
}

export function adminRoutes(options: AdminRoutesOptions) {
  return async function register(app: FastifyInstance) {
    app.addHook("preHandler", async (request, reply) => {
      if (!options.allowDevAdminStub) {
        return reply.status(403).send({
          error: {
            code: "ADMIN_AUTH_NOT_CONFIGURED",
            message: "Admin dev stub is disabled outside development. Configure production auth before using admin routes.",
          },
        })
      }

      request.headers["x-khanect-admin-auth"] = "dev-stub-only"
    })

    app.get("/admin/me", async () => {
      const admin = await options.store.getAdminContext()
      return {
        user: {
          id: admin.userId,
          email: admin.email,
          roles: admin.roles,
          authMode: admin.authMode,
          productionAuth: admin.productionAuth,
        },
        tenant: { id: admin.tenantId },
        warning: "Dev admin stub only. Not production authentication.",
      }
    })

    app.get("/admin/content", async () => ({ items: await options.store.listContent() }))

    app.post("/admin/content", async (request, reply) => {
      const body = parseRecord(request.body)
      const item = await options.store.createContent({
        contentType: typeof body.contentType === "string" ? (body.contentType as never) : "general",
        title: requireString(body.title, "title"),
        slug: typeof body.slug === "string" ? body.slug : undefined,
        body: requireString(body.body, "body"),
        metadata: parseMetadata(body.metadata),
      })
      return reply.status(201).send({ item })
    })

    app.get("/admin/content/:id", async (request, reply) => {
      const id = getParam(request.params, "id")
      const item = await options.store.getContent(id)
      if (!item) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Content item not found" } })
      return { item }
    })

    app.patch("/admin/content/:id", async (request, reply) => {
      const id = getParam(request.params, "id")
      const body = parseRecord(request.body)
      if (Object.hasOwn(body, "status")) {
        const error = new Error("status cannot be patched; use /publish")
        Object.assign(error, { statusCode: 400, code: "VALIDATION_ERROR" })
        throw error
      }
      const item = await options.store.patchContent(id, {
        contentType: typeof body.contentType === "string" ? (body.contentType as never) : undefined,
        title: typeof body.title === "string" ? body.title : undefined,
        slug: typeof body.slug === "string" ? body.slug : undefined,
        body: typeof body.body === "string" ? body.body : undefined,
        metadata: parseMetadata(body.metadata),
      })
      if (!item) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Content item not found" } })
      return { item }
    })

    app.post("/admin/content/:id/publish", async (request, reply) => {
      const id = getParam(request.params, "id")
      const result = await options.store.publishContent(id)
      if (!result) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Content item not found" } })
      return { ...result, embeddingModel: "stub/hash-v1" }
    })

    app.get("/admin/rag/documents", async () => ({ items: await options.store.listDocuments() }))

    app.get("/admin/rag/documents/:id/chunks", async (request) => {
      const id = getParam(request.params, "id")
      return { items: await options.store.listChunks(id) }
    })

    app.post("/admin/rag/reindex", async (request) => {
      const body = parseRecord(request.body)
      return options.store.reindexContent(typeof body.contentItemId === "string" ? body.contentItemId : undefined)
    })

    app.post("/admin/rag/search-test", async (request) => {
      const body = parseRecord(request.body)
      const query = requireString(body.query, "query")
      const topK = typeof body.topK === "number" ? body.topK : 5
      const sources = await options.store.search(query, topK)
      return { query, sources, retrieval: { topK, embeddingModel: "stub/hash-v1" } }
    })

    app.post("/admin/chat-lab/sessions", async (_request, reply) => reply.status(201).send({ session: await options.store.createChatSession() }))

    app.get("/admin/chat-lab/sessions", async () => ({ items: await options.store.listChatSessions() }))

    app.get("/admin/chat-lab/sessions/:id/messages", async (request) => {
      const id = getParam(request.params, "id")
      return { items: await options.store.listChatMessages(id) }
    })

    app.post("/admin/chat-lab/test-message", async (request) => {
      const body = parseRecord(request.body)
      return options.store.sendChatMessage({
        sessionId: typeof body.sessionId === "string" ? body.sessionId : undefined,
        message: requireString(body.message, "message"),
        topK: typeof body.topK === "number" ? body.topK : undefined,
      })
    })
  }
}

function parseRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function parseMetadata(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined
}

function requireString(value: unknown, name: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    const error = new Error(`${name} is required`)
    Object.assign(error, { statusCode: 400, code: "VALIDATION_ERROR" })
    throw error
  }
  return value
}

function getParam(params: unknown, name: string) {
  const record = parseRecord(params)
  const value = record[name]
  if (typeof value !== "string") throw new Error(`Missing param ${name}`)
  return value
}
