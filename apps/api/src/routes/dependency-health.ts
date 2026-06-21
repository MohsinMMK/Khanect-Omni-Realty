import type { AppConfig } from "@workspace/config"
import type { FastifyPluginAsync } from "fastify"
import net from "node:net"

export interface DependencyHealthResponse {
  status: "ok" | "unavailable"
  dependency: "clamav"
  host: string
  port: number
}

export type ClamavHealthCheck = (clamav: AppConfig["uploads"]["clamav"]) => Promise<boolean>

export interface DependencyHealthRouteOptions {
  config: AppConfig
  clamavHealthCheck?: ClamavHealthCheck
}

export function dependencyHealthRoutes(options: DependencyHealthRouteOptions): FastifyPluginAsync {
  const checkClamav = options.clamavHealthCheck ?? checkClamavTcp

  return async (app) => {
    app.get<{ Reply: DependencyHealthResponse }>("/health/clamav", async (_request, reply) => {
      const clamav = options.config.uploads.clamav
      const isAvailable = await checkClamav(clamav)

      return reply.status(isAvailable ? 200 : 503).send({
        status: isAvailable ? "ok" : "unavailable",
        dependency: "clamav",
        host: clamav.host,
        port: clamav.port,
      })
    })
  }
}

async function checkClamavTcp(clamav: AppConfig["uploads"]["clamav"]): Promise<boolean> {
  return await new Promise((resolve) => {
    const socket = net.createConnection({ host: clamav.host, port: clamav.port })
    const timeout = setTimeout(() => {
      socket.destroy()
      resolve(false)
    }, clamav.scanTimeoutMs)

    socket.once("connect", () => {
      clearTimeout(timeout)
      socket.end()
      resolve(true)
    })

    socket.once("error", () => {
      clearTimeout(timeout)
      resolve(false)
    })
  })
}
