import type { AppConfig } from "@workspace/config"
import { createProjectAiRuntimeResolver, type RagIndexJobPayload } from "@workspace/core"
import type { ProductionChatbotStore } from "@workspace/db"

import { createRagIndexQueue, enqueuePlatformRagIndex } from "./queues/rag-index.js"

export type RagIndexEnqueuer = (job: RagIndexJobPayload) => Promise<void>

export function createRagIndexEnqueuer(config: AppConfig, store: ProductionChatbotStore): RagIndexEnqueuer {
  const projectAiResolver = createProjectAiRuntimeResolver(config.ai, (projectId) => store.getProjectAiSecrets(projectId))

  if (config.platform.ragIndexSync) {
    return async (job) => {
      const chatbot = await store.getChatbot(job.chatbotId)
      const embed = chatbot
        ? await projectAiResolver.resolveEmbeddingProvider(chatbot.projectId)
        : await projectAiResolver.resolveEmbeddingProvider("missing-project")
      await store.indexPlatformContent({
        chatbotId: job.chatbotId,
        contentItemId: job.contentItemId,
        sourceVersionId: job.contentVersionId,
        documentId: job.documentId,
        embed,
      })
    }
  }

  const queue = createRagIndexQueue(config)
  return async (job) => {
    await enqueuePlatformRagIndex(queue, job)
  }
}