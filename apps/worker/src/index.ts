import { loadConfig } from "@workspace/config"

import { startWorkerHealthServer } from "./health-server.js"
import { startWorkerRuntime, type WorkerLogger } from "./runtime.js"

const logger: WorkerLogger = {
  info: (message, metadata) => console.info(JSON.stringify({ level: "info", message, ...metadata })),
  error: (message, metadata) => console.error(JSON.stringify({ level: "error", message, ...metadata })),
}

const config = loadConfig()
const healthServer = await startWorkerHealthServer(config.runtime.workerHealthPort)
const runtime = await startWorkerRuntime(config, logger)
logger.info("worker health server started", { port: healthServer.port })

let closing = false
async function shutdown(signal: NodeJS.Signals) {
  if (closing) return
  closing = true
  logger.info("shutting down worker", { signal, queues: runtime.queueNames })
  const timeout = setTimeout(() => {
    logger.error("worker shutdown timed out; forcing exit", { signal })
    process.exit(1)
  }, config.runtime.shutdownTimeoutMs)
  timeout.unref()
  try {
    await runtime.close()
    await healthServer.close()
  } finally {
    clearTimeout(timeout)
  }
}

function handleSignal(signal: NodeJS.Signals) {
  void shutdown(signal).finally(() => process.exit(0))
}

process.on("SIGINT", handleSignal)
process.on("SIGTERM", handleSignal)
