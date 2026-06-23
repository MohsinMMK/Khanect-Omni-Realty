import { describe, expect, it } from "vitest"

import { startWorkerHealthServer } from "../src/health-server.js"

describe("worker health server", () => {
  it("responds with ok on the health port", async () => {
    const server = await startWorkerHealthServer(0)
    const response = await fetch(`http://127.0.0.1:${server.port}/`)
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ status: "ok", runtime: "worker" })
    await server.close()
  })
})