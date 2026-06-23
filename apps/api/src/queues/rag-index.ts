import type { AppConfig } from "@workspace/config"
import {
  buildPlatformRagIndexJobId,
  createRedisConnectionOptions,
  ragIndexQueueName,
  type RagIndexJobPayload,
} from "@workspace/core"
import { Queue } from "bullmq"

export { ragIndexQueueName }

export function createRagIndexQueue(config: AppConfig) {
  return new Queue(ragIndexQueueName, {
    connection: createRedisConnectionOptions(config.redis.url),
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    },
  })
}

export async function enqueuePlatformRagIndex(queue: Queue, job: RagIndexJobPayload) {
  await queue.add("platform.index", job, {
    jobId: buildPlatformRagIndexJobId(job.chatbotId, job.contentVersionId),
  })
}