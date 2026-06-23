import fastifyStatic from "@fastify/static"
import { loadConfig, type AppConfig } from "@workspace/config"
import {
  createDbClient,
  createDrizzleProductionChatbotStore,
  createDrizzlePhase1aStore,
  createInMemoryProductionChatbotStore,
  createPgPool,
  type Phase1aStore,
  type ProductionChatbotStore,
} from "@workspace/db"
import Fastify, { type FastifyError, type FastifyInstance } from "fastify"
import { existsSync } from "node:fs"
import path from "node:path"
import { randomUUID } from "node:crypto"

import type { AdminAuthOptions } from "./admin-auth.js"
import { createBetterAuthRuntime } from "./auth/create-auth.js"
import { adminRoutes } from "./routes/admin.js"
import { betterAuthRoutes } from "./routes/better-auth.js"
import { dependencyHealthRoutes, type ClamavHealthCheck } from "./routes/dependency-health.js"
import { healthRoutes } from "./routes/health.js"
import { readinessRoutes, type ReadinessRouteOptions } from "./routes/readiness.js"
import { embeddingAdminRoutes } from "./routes/embedding-admin.js"
import { metaWebhookRoutes } from "./routes/meta-webhooks.js"
import { platformRoutes } from "./routes/platform.js"
import { createConfiguredAnswerProvider } from "./llm.js"
import { createAgnoAnswerProvider } from "./agno.js"
import { createRagIndexEnqueuer, type RagIndexEnqueuer } from "./rag-index-enqueuer.js"

export interface StaticAssetsOptions {
  enabled?: boolean
  root?: string
}

type ApiLoggerOption = boolean | { level: AppConfig["logLevel"] }

export interface BuildApiOptions {
  config?: AppConfig
  logger?: ApiLoggerOption
  staticAssets?: StaticAssetsOptions
  clamavHealthCheck?: ClamavHealthCheck
  phase1aStore?: Phase1aStore
  productionChatbotStore?: ProductionChatbotStore
  ragIndexEnqueuer?: RagIndexEnqueuer
  websiteInstallFetcher?: typeof fetch
  metaFetchImpl?: typeof fetch
  readinessProbe?: ReadinessRouteOptions["probe"]
  widgetRateLimit?: {
    maxMessages: number
    windowMs: number
    now?: () => number
  }
}

export async function buildApi(options: BuildApiOptions = {}) {
  const config = options.config ?? loadConfig()
  const app: FastifyInstance = Fastify({
    logger: options.logger ?? (config.nodeEnv === "test" ? false : { level: config.logLevel }),
    genReqId: (request) => {
      const header = request.headers["x-request-id"]
      return typeof header === "string" && header.length > 0 ? header : randomUUID()
    },
  })

  app.setErrorHandler((error: FastifyError, request, reply) => {
    const statusCode = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500
    const message = statusCode >= 500 ? "Internal server error" : error.message

    request.log.error({ error, requestId: request.id }, "request failed")

    void reply.status(statusCode).send({
      error: {
        code: error.code ?? (statusCode >= 500 ? "INTERNAL_SERVER_ERROR" : "REQUEST_ERROR"),
        message,
      },
      requestId: request.id,
    })
  })

  const phase1aStore = options.phase1aStore ?? createDefaultPhase1aStore()
  const productionChatbotStore = options.productionChatbotStore ?? createDefaultProductionChatbotStore(config, {
    answerProvider: createAgnoAnswerProvider(config) ?? createConfiguredAnswerProvider(config),
    appConfig: config,
    encryptionKey: config.auth.encryptionKey,
  })
  const ragIndexEnqueuer = options.ragIndexEnqueuer ?? createRagIndexEnqueuer(config, productionChatbotStore)
  let betterAuthRuntime: ReturnType<typeof createBetterAuthRuntime> | null = null
  if (config.auth.enabled) {
    betterAuthRuntime = createBetterAuthRuntime(config)
  }
  const adminAuth: AdminAuthOptions = {
    allowDevAdminStub: config.nodeEnv !== "production",
    adminApiKey: config.auth.adminApiKey,
    betterAuthEnabled: config.auth.enabled,
    auth: betterAuthRuntime?.auth ?? null,
  }
  const widgetRateLimit = {
    maxMessages: config.platform.widgetRateLimitMax,
    windowMs: config.platform.widgetRateLimitWindowMs,
  }
  app.addHook("onClose", async () => {
    await phase1aStore.close?.()
    await productionChatbotStore.close?.()
    await betterAuthRuntime?.close()
  })

  await app.register(healthRoutes, { prefix: "/api/v1" })
  await app.register(readinessRoutes({ config, probe: options.readinessProbe }), { prefix: "/api/v1" })
  await app.register(dependencyHealthRoutes({ config, clamavHealthCheck: options.clamavHealthCheck }), {
    prefix: "/api/v1",
  })
  if (betterAuthRuntime) {
    await app.register(betterAuthRoutes({ auth: betterAuthRuntime.auth }))
  }
  await app.register(adminRoutes({
    store: phase1aStore,
    adminAuth,
  }), {
    prefix: "/api/v1",
  })
  await app.register(metaWebhookRoutes({
    config,
    store: productionChatbotStore,
    fetchImpl: options.metaFetchImpl,
  }), { prefix: "/api/v1" })
  await app.register(embeddingAdminRoutes({
    config,
    adminAuth,
  }), { prefix: "/api/v1" })
  await app.register(platformRoutes({
    store: productionChatbotStore,
    appConfig: config,
    adminAuth,
    agnoServiceToken: config.agno.serviceToken,
    ragIndexEnqueuer,
    websiteInstallFetcher: options.websiteInstallFetcher,
    widgetRateLimit: options.widgetRateLimit ?? widgetRateLimit,
  }), {
    prefix: "/api/v1",
  })
  await registerStaticAssets(app, config, options.staticAssets)

  return app
}

function createDefaultPhase1aStore() {
  const pool = createPgPool()
  const db = createDbClient(pool)
  const store = createDrizzlePhase1aStore(db, pool)
  return {
    ...store,
    close: async () => {
      await pool.end()
    },
  }
}

function createDefaultProductionChatbotStore(config: AppConfig, options: Parameters<typeof createInMemoryProductionChatbotStore>[0]) {
  if (config.platform.store === "memory") {
    return createInMemoryProductionChatbotStore(options)
  }
  const pool = createPgPool()
  const db = createDbClient(pool)
  const store = createDrizzleProductionChatbotStore(db, pool, options)
  return {
    ...store,
    close: async () => {
      await pool.end()
    },
  }
}

async function registerStaticAssets(
  app: FastifyInstance,
  config: AppConfig,
  options?: StaticAssetsOptions,
) {
  const enabled = options?.enabled ?? config.nodeEnv === "production"
  if (!enabled) return

  const root = options?.root ?? path.resolve(process.cwd(), "apps/web/dist")
  if (!existsSync(root)) {
    app.log.warn({ root }, "web dist not found; static asset serving disabled")
    return
  }

  await app.register(fastifyStatic, {
    root,
    prefix: "/",
    decorateReply: false,
  })

  app.setNotFoundHandler((request, reply) => {
    const url = request.raw.url ?? ""
    if (url.startsWith("/api/")) {
      void reply.status(404).send({
        error: { code: "NOT_FOUND", message: "Not found" },
        requestId: request.id,
      })
      return
    }

    void reply.sendFile("index.html")
  })
}
