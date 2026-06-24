import type { AppConfig } from "@workspace/config"
import {
  createProjectAiRuntimeResolver,
  createRedisConnectionOptions,
  isPlatformRagIndexJob,
  requireRealEmbeddingProvider,
  ragIndexQueueName,
  type RagIndexJobData,
} from "@workspace/core"
import {
  createDbClient,
  createDrizzlePhase1aStore,
  createDrizzleProductionChatbotStore,
  createPgPool,
  type Phase1aStore,
  type ProductionChatbotStore,
} from "@workspace/db"
import { Worker, type Job } from "bullmq"

export const phase0QueueName = "phase0.foundation"
export { ragIndexQueueName }

export interface WorkerLogger {
  info(message: string, metadata?: Record<string, unknown>): void
  error(message: string, metadata?: Record<string, unknown>): void
}

export interface WorkerRuntime {
  queueNames: readonly string[]
  close(): Promise<void>
}

export function createRagIndexProcessor(
  phase1aStore: Phase1aStore,
  platformStore: ProductionChatbotStore,
  config: AppConfig,
  logger: WorkerLogger,
) {
  const projectAiResolver = createProjectAiRuntimeResolver(config.ai, (projectId) => platformStore.getProjectAiSecrets(projectId))

  return async function processRagIndex(job: Job<RagIndexJobData>) {
    logger.info("rag index job received", { jobId: job.id, queueName: ragIndexQueueName })

    if (isPlatformRagIndexJob(job.data)) {
      const chatbot = await platformStore.getChatbot(job.data.chatbotId)
      const embed = chatbot
        ? await projectAiResolver.resolveEmbeddingProvider(chatbot.projectId)
        : await projectAiResolver.resolveEmbeddingProvider("missing-project")
      const realEmbed = config.nodeEnv === "test" ? embed : requireRealEmbeddingProvider(embed, "Platform RAG indexing")
      const result = await platformStore.indexPlatformContent({
        chatbotId: job.data.chatbotId,
        contentItemId: job.data.contentItemId,
        sourceVersionId: job.data.contentVersionId,
        documentId: job.data.documentId,
        embed: realEmbed,
      })
      logger.info("platform rag index job completed", { jobId: job.id, ...result })
      return { status: "indexed", scope: "platform", ...result }
    }

    const result = await phase1aStore.reindexContent(job.data.contentItemId)
    logger.info("phase1a rag index job completed", { jobId: job.id, ...result })
    return { status: "indexed", scope: "phase1a", ...result }
  }
}

export async function startWorkerRuntime(config: AppConfig, logger: WorkerLogger): Promise<WorkerRuntime> {
  const connection = {
    ...createRedisConnectionOptions(config.redis.url),
    maxRetriesPerRequest: null,
  }
  const pool = createPgPool({ databaseUrl: config.db.databaseUrl })
  const db = createDbClient(pool)
  const phase1aStore = createDrizzlePhase1aStore(db, pool)
  const platformStore = createDrizzleProductionChatbotStore(db, pool, {
    appConfig: config,
    encryptionKey: config.auth.encryptionKey,
  })

  const phase0Worker = new Worker(
    phase0QueueName,
    async (job) => {
      logger.info("phase0 placeholder job received", { jobId: job.id, queueName: phase0QueueName })
      return { status: "ignored", reason: "Phase 0 has no product jobs" }
    },
    { connection, autorun: false },
  )

  const ragWorker = new Worker(
    ragIndexQueueName,
    createRagIndexProcessor(phase1aStore, platformStore, config, logger),
    { connection, autorun: false },
  )

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

export { createRedisConnectionOptions }
