import { buildApi } from "../src/app.js"
import { describe, expect, it } from "vitest"

describe("opencode admin routes", () => {
  it("returns a live Go model catalog for authenticated admins", async () => {
    const app = await buildApi({ logger: false, staticAssets: { enabled: false } })

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/admin/ai/opencode/models?plan=go",
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.plan).toBe("go")
    expect(body.baseUrl).toBe("https://opencode.ai/zen/go/v1")
    expect(body.models.length).toBeGreaterThan(0)
    expect(body.models.some((entry: { model: string; supported: boolean }) => entry.model === "glm-5.2" && entry.supported)).toBe(true)

    await app.close()
  })

  it("rejects unknown plan values", async () => {
    const app = await buildApi({ logger: false, staticAssets: { enabled: false } })

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/admin/ai/opencode/models?plan=invalid",
    })

    expect(response.statusCode).toBe(400)
    await app.close()
  })
})