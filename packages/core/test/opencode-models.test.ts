import { describe, expect, it } from "vitest"

import {
  buildOpenCodeModelCatalog,
  fetchOpenCodeModelIds,
  formatOpenCodeModelLabel,
  isOpenCodeGoModelSupported,
  loadOpenCodeModelCatalog,
  OPENCODE_GO_RECOMMENDED_MODEL,
} from "../src/opencode-models.js"

describe("opencode-models", () => {
  it("formats model labels for the admin UI", () => {
    expect(formatOpenCodeModelLabel("glm-5.2")).toBe("GLM 5.2")
    expect(formatOpenCodeModelLabel("kimi-k2.7-code")).toBe("Kimi K2.7 Code")
  })

  it("excludes Go /messages-only models from supported chat presets", () => {
    expect(isOpenCodeGoModelSupported("glm-5.2")).toBe(true)
    expect(isOpenCodeGoModelSupported("qwen3.7-plus")).toBe(false)
  })

  it("builds a live Go catalog with recommended model first", () => {
    const catalog = buildOpenCodeModelCatalog("go", ["qwen3.7-plus", "glm-5.2", "deepseek-v4-flash"], "live")
    expect(catalog.models.find((entry) => entry.model === OPENCODE_GO_RECOMMENDED_MODEL)?.recommended).toBe(true)
    expect(catalog.models.find((entry) => entry.model === "qwen3.7-plus")?.supported).toBe(false)
    expect(catalog.models[0]?.model).toBe(OPENCODE_GO_RECOMMENDED_MODEL)
  })

  it("fetches model ids from the OpenCode API", async () => {
    const ids = await fetchOpenCodeModelIds("go", async () => new Response(JSON.stringify({
      data: [{ id: "glm-5.2" }, { id: "deepseek-v4-flash" }],
    }), { status: 200, headers: { "content-type": "application/json" } }))

    expect(ids).toEqual(["glm-5.2", "deepseek-v4-flash"])
  })

  it("falls back when the live catalog fetch fails", async () => {
    const catalog = await loadOpenCodeModelCatalog("go", {
      fetchImpl: async () => new Response("upstream error", { status: 503 }),
      forceRefresh: true,
    })

    expect(catalog.source).toBe("fallback")
    expect(catalog.models.some((entry) => entry.model === OPENCODE_GO_RECOMMENDED_MODEL)).toBe(true)
    expect(catalog.detail).toContain("503")
  })
})