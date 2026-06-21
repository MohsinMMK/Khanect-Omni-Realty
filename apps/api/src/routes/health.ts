import type { FastifyPluginAsync } from "fastify"

export interface HealthResponse {
  status: "ok"
  requestId?: string
}

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Reply: HealthResponse }>("/health", async (request) => ({
    status: "ok",
    requestId: request.id,
  }))
}
