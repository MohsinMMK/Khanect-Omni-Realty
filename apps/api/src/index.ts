import { loadConfig } from "@workspace/config"

import { buildApi } from "./app.js"

const config = loadConfig()
const port = Number(process.env.PORT ?? 3000)
const host = process.env.HOST ?? "0.0.0.0"
const app = await buildApi({ config })

let closing = false
async function shutdown(signal: NodeJS.Signals) {
  if (closing) return
  closing = true
  app.log.info({ signal }, "shutting down api")
  await app.close()
}

process.on("SIGINT", (signal) => {
  void shutdown(signal).finally(() => process.exit(0))
})
process.on("SIGTERM", (signal) => {
  void shutdown(signal).finally(() => process.exit(0))
})

try {
  await app.listen({ port, host })
} catch (error) {
  app.log.error({ error }, "api failed to start")
  process.exit(1)
}
