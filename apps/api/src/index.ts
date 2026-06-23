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
  const timeout = setTimeout(() => {
    app.log.error({ signal }, "api shutdown timed out; forcing exit")
    process.exit(1)
  }, config.runtime.shutdownTimeoutMs)
  timeout.unref()
  try {
    await app.close()
  } finally {
    clearTimeout(timeout)
  }
}

function handleSignal(signal: NodeJS.Signals) {
  void shutdown(signal).finally(() => process.exit(0))
}

process.on("SIGINT", handleSignal)
process.on("SIGTERM", handleSignal)

try {
  await app.listen({ port, host })
} catch (error) {
  app.log.error({ error }, "api failed to start")
  process.exit(1)
}
