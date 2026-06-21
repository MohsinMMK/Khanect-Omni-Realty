import type { AppConfig } from "@workspace/config"
import { createDbClient, createDrizzlePhase1aStore, createPgPool, type Phase1aStore } from "@workspace/db"
import { Worker, type Job, type WorkerOptions } from "bullmq"

export const phase0QueueName = "phase0.foundation"
export const ragIndexQueueName = "rag.index"

export interface RagIndexJobData {
  tenantId?: string
  contentItemId?: string
  contentVersionId?: string
}

export interface WorkerLogger {
  info(message: string, metadata?: Record<string, unknown>): void
  error(message: string, metadata?: Record<string, unknown>): void
}

export interface WorkerRuntime {
  queueNames: readonly string[]
  close(): Promise<void>
}

export function createRedisConnectionOptions(redisUrl: string): WorkerOptions["connection"] {
  const url = new URL(redisUrl)

  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    db: url.pathname.length > 1 ? Number(url.pathname.slice(1)) : 0,
    tls: url.protocol === "rediss:" ? {} : undefined,
  }
}

export function createRagIndexProcessor(store: Phase1aStore, logger: WorkerLogger) {
  return async function processRagIndex(job: Job<RagIndexJobData>) {
    logger.info("rag index job received", { jobId: job.id, queueName: ragIndexQueueName })
    const result = await store.reindexContent(job.data.contentItemId)
    logger.info("rag index job completed", { jobId: job.id, ...result })
    return { status: "indexed", ...result }
  }
}

export async function startWorkerRuntime(config: AppConfig, logger: WorkerLogger): Promise<WorkerRuntime> {
  const connection = createRedisConnectionOptions(config.redis.url)
  const pool = createPgPool({ databaseUrl: config.db.databaseUrl })
  const store = createDrizzlePhase1aStore(createDbClient(pool), pool)

  const phase0Worker = new Worker(
    phase0QueueName,
    async (job) => {
      logger.info("phase0 placeholder job received", { jobId: job.id, queueName: phase0QueueName })
      return { status: "ignored", reason: "Phase 0 has no product jobs" }
    },
    { connection, autorun: false },
  )

  const ragWorker = new Worker(ragIndexQueueName, createRagIndexProcessor(store, logger), {
    connection,
    autorun: false,
  })

  for (const worker of [phase0Worker, ragWorker]) {
    worker.on("error", (error) => {
      logger.error("worker runtime error", { error: error.message })
    })

    void worker.run().catch((error: unknown) => {
      logger.error("worker runtime run failed", {
        error: error instanceof Error ? error.message : String(error),
      })
    })
  }

  const queues = [phase0QueueName, ragIndexQueueName]
  logger.info("worker runtime started", { queues })

  return {
    queueNames: queues,
    close: async () => {
      await Promise.all([phase0Worker.close(), ragWorker.close()])
      await pool.end()
      logger.info("worker runtime stopped", { queues })
    },
  }
}
