import {
  createOpenCodeModelCatalogCache,
  loadOpenCodeModelCatalog,
  type OpenCodeLlmPlan,
} from "@workspace/core"
import type { FastifyPluginAsync } from "fastify"

import { type AdminAuthOptions, resolveAdminAuth, sendAdminAuthRequired } from "../admin-auth.js"

interface OpenCodeAdminRouteOptions {
  adminAuth: AdminAuthOptions
}

const catalogCache = createOpenCodeModelCatalogCache()

function parsePlan(value: unknown): OpenCodeLlmPlan | null {
  if (value === "go" || value === "zen") return value
  return null
}

export function opencodeAdminRoutes(options: OpenCodeAdminRouteOptions): FastifyPluginAsync {
  return async function registerOpenCodeAdminRoutes(app) {
    app.addHook("preHandler", async (request, reply) => {
      const authResult = await resolveAdminAuth(request.headers, options.adminAuth)
      if (!authResult.authorized) {
        return sendAdminAuthRequired(reply, options.adminAuth.betterAuthEnabled)
      }
    })

    app.get("/admin/ai/opencode/models", async (request, reply) => {
      const query = request.query as { plan?: string; refresh?: string }
      const plan = parsePlan(query.plan)
      if (!plan) {
        return reply.status(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: 'Query param "plan" must be "go" or "zen".',
          },
        })
      }

      const forceRefresh = query.refresh === "1" || query.refresh === "true"
      const catalog = await loadOpenCodeModelCatalog(plan, { forceRefresh, cache: catalogCache })
      return catalog
    })
  }
}