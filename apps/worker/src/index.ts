import { loadConfig } from "@workspace/config"

import { startWorkerRuntime, type WorkerLogger } from "./runtime.js"

const logger: WorkerLogger = {
  info: (message, metadata) => console.info(JSON.stringify({ level: "info", message, ...metadata })),
  error: (message, metadata) => console.error(JSON.stringify({ level: "error", message, ...metadata })),
}

const config = loadConfig()
const runtime = await startWorkerRuntime(config, logger)

let closing = false
async function shutdown(signal: NodeJS.Signals) {
  if (closing) return
  closing = true
  logger.info("shutting down worker", { signal, queues: runtime.queueNames })
  await runtime.close()
}

process.on("SIGINT", (signal) => {
  void shutdown(signal).finally(() => process.exit(0))
})
process.on("SIGTERM", (signal) => {
  void shutdown(signal).finally(() => process.exit(0))
})
