import { loadConfig } from "@workspace/config"
import { describe, expect, it } from "vitest"

import { buildApi } from "../src/app.js"

describe("GET /api/v1/health/ready", () => {
  it("returns ok when injected readiness probes pass", async () => {
    const app = await buildApi({
      logger: false,
      staticAssets: { enabled: false },
      config: loadConfig({
        ...process.env,
        NODE_ENV: "test",
        PLATFORM_STORE: "memory",
      }),
      readinessProbe: {
        config: loadConfig({ NODE_ENV: "test", PLATFORM_STORE: "memory" }),
        checkPostgres: async () => true,
        checkRedis: async () => true,
      },
    })

    const response = await app.inject({ method: "GET", url: "/api/v1/health/ready" })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      status: "ok",
      checks: expect.arrayContaining([
        expect.objectContaining({ dependency: "redis", status: "ok" }),
      ]),
    })

    await app.close()
  })

  it("returns unavailable when a dependency probe fails", async () => {
    const config = loadConfig({ NODE_ENV: "test", PLATFORM_STORE: "memory" })
    const app = await buildApi({
      logger: false,
      staticAssets: { enabled: false },
      config,
      readinessProbe: {
        config,
        checkRedis: async () => false,
      },
    })

    const response = await app.inject({ method: "GET", url: "/api/v1/health/ready" })
    expect(response.statusCode).toBe(503)
    expect(response.json()).toMatchObject({
      status: "unavailable",
      checks: expect.arrayContaining([
        expect.objectContaining({ dependency: "redis", status: "unavailable" }),
      ]),
    })

    await app.close()
  })
})