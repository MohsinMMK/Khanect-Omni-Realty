import { loadConfig } from "@workspace/config"
import { createInMemoryProductionChatbotStore } from "@workspace/db"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { expect, it } from "vitest"

import { buildApi } from "../src/app.js"

it("serves the SPA fallback while keeping unknown API routes at 404", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "realty-static-test-"))
  const html = "<!doctype html><html><body>Realty app</body></html>"
  await writeFile(path.join(root, "index.html"), html)
  await writeFile(path.join(root, "app.js"), "console.log('realty')")
  const app = await buildApi({
    logger: false,
    staticAssets: { enabled: true, root },
    config: loadConfig({ NODE_ENV: "test", PLATFORM_STORE: "memory" }),
    productionChatbotStore: createInMemoryProductionChatbotStore(),
  })
  try {
    const page = await app.inject({ method: "GET", url: "/projects/example" })
    expect(page.statusCode).toBe(200)
    expect(page.body).toBe(html)
    expect(page.headers["content-type"]).toContain("text/html")
    const asset = await app.inject({ method: "GET", url: "/app.js" })
    expect(asset.statusCode).toBe(200)
    const missingApi = await app.inject({ method: "GET", url: "/api/unknown" })
    expect(missingApi.statusCode).toBe(404)
    expect(missingApi.json()).toMatchObject({ error: { code: "NOT_FOUND" } })
  } finally {
    await app.close()
    await rm(root, { recursive: true, force: true })
  }
})
