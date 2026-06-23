import { fromNodeHeaders } from "better-auth/node"
import type { FastifyPluginAsync } from "fastify"

import type { AppAuth } from "../auth/create-auth.js"

export interface BetterAuthRouteOptions {
  auth: AppAuth
}

export function betterAuthRoutes(options: BetterAuthRouteOptions): FastifyPluginAsync {
  return async (app) => {
    app.route({
      method: ["GET", "POST"],
      url: "/api/auth/*",
      async handler(request, reply) {
        try {
          const url = new URL(request.url, `${request.protocol}://${request.headers.host}`)
          const headers = fromNodeHeaders(request.headers)
          const req = new Request(url.toString(), {
            method: request.method,
            headers,
            body: request.body ? JSON.stringify(request.body) : undefined,
          })
          const response = await options.auth.handler(req)
          reply.status(response.status)
          response.headers.forEach((value, key) => {
            reply.header(key, value)
          })
          return reply.send(response.body ? await response.text() : null)
        } catch (error) {
          request.log.error({ error }, "better auth handler failed")
          return reply.status(500).send({
            error: {
              code: "AUTH_FAILURE",
              message: "Internal authentication error",
            },
          })
        }
      },
    })
  }
}