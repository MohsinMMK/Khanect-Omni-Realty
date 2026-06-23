import type { AppConfig } from "@workspace/config"
import type { FastifyPluginAsync } from "fastify"

import { probeReadiness, readinessIsOk, type ReadinessProbeOptions } from "../readiness.js"

export interface ReadinessResponse {
  status: "ok" | "unavailable"
  checks: Array<{
    dependency: string
    status: "ok" | "unavailable"
    detail?: string
  }>
}

export interface ReadinessRouteOptions {
  config: AppConfig
  probe?: ReadinessProbeOptions
}

export function readinessRoutes(options: ReadinessRouteOptions): FastifyPluginAsync {
  return async (app) => {
    app.get<{ Reply: ReadinessResponse }>("/health/ready", async (_request, reply) => {
      const checks = await probeReadiness(options.probe ?? { config: options.config })
      const ok = readinessIsOk(checks)
      return reply.status(ok ? 200 : 503).send({
        status: ok ? "ok" : "unavailable",
        checks,
      })
    })
  }
}