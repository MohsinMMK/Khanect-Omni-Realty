import type { AppConfig } from "@workspace/config"
import type { FastifyPluginAsync } from "fastify"

import { type AdminAuthOptions, resolveAdminAuth, sendAdminAuthRequired } from "../admin-auth.js"
import { buildEmbeddingAdminStatus, probeEmbeddingProvider, runEmbeddingSmokeTest } from "../embedding-admin.js"

interface EmbeddingAdminRouteOptions {
  config: AppConfig
  adminAuth: AdminAuthOptions
}

export function embeddingAdminRoutes(options: EmbeddingAdminRouteOptions): FastifyPluginAsync {
  return async function registerEmbeddingAdminRoutes(app) {
    app.addHook("preHandler", async (request, reply) => {
      const authResult = await resolveAdminAuth(request.headers, options.adminAuth)
      if (!authResult.authorized) {
        return sendAdminAuthRequired(reply, options.adminAuth.betterAuthEnabled)
      }
    })

    app.get("/admin/ai/embedding", async () => {
      const status = buildEmbeddingAdminStatus(options.config)
      const probe = await probeEmbeddingProvider(options.config)

      return {
        ...status,
        status: !status.configured ? "misconfigured" : probe.ok ? "ok" : "unavailable",
        detail: status.detail ?? (probe.ok ? undefined : probe.detail),
        probe: {
          ok: probe.ok,
          detail: probe.detail,
        },
      }
    })

    app.post("/admin/ai/embedding/test", async (request, reply) => {
      const status = buildEmbeddingAdminStatus(options.config)
      if (!status.configured) {
        return reply.status(400).send({
          error: {
            code: "EMBEDDING_MISCONFIGURED",
            message: status.detail ?? "Embedding provider is not configured.",
          },
        })
      }

      const body = (request.body ?? {}) as { sample?: string }
      const sample = typeof body.sample === "string" && body.sample.trim().length > 0
        ? body.sample.trim()
        : "Marina Heights pet policy"

      try {
        const result = await runEmbeddingSmokeTest(options.config, sample)
        return result
      } catch (error) {
        return reply.status(502).send({
          error: {
            code: "EMBEDDING_TEST_FAILED",
            message: error instanceof Error ? error.message : "Embedding smoke test failed.",
          },
        })
      }
    })
  }
}