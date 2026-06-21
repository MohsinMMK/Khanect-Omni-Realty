import { describe, expect, it } from "vitest"

import { buildApi } from "../src/app.js"

describe("GET /api/v1/health", () => {
  it("returns OpenAPI HealthResponse shape", async () => {
    const app = await buildApi({ logger: false, staticAssets: { enabled: false } })

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/health",
      headers: { "x-request-id": "test-request-id" },
    })

    await app.close()

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      status: "ok",
      requestId: "test-request-id",
    })
  })
})

describe("GET /api/v1/health/clamav", () => {
  it("returns ok when ClamAV TCP health succeeds", async () => {
    const app = await buildApi({
      logger: false,
      staticAssets: { enabled: false },
      clamavHealthCheck: async () => true,
    })

    const response = await app.inject({ method: "GET", url: "/api/v1/health/clamav" })

    await app.close()

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      status: "ok",
      dependency: "clamav",
      host: "clamav",
      port: 3310,
    })
  })

  it("returns unavailable when ClamAV TCP health fails", async () => {
    const app = await buildApi({
      logger: false,
      staticAssets: { enabled: false },
      clamavHealthCheck: async () => false,
    })

    const response = await app.inject({ method: "GET", url: "/api/v1/health/clamav" })

    await app.close()

    expect(response.statusCode).toBe(503)
    expect(response.json()).toMatchObject({
      status: "unavailable",
      dependency: "clamav",
    })
  })
})
