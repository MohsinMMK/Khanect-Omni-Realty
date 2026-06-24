import type { AppConfig } from "@workspace/config"
import { createProjectAiRuntimeResolver, requireRealEmbeddingProvider, type RagIndexJobPayload } from "@workspace/core"
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
      const realEmbed = config.nodeEnv === "test" ? embed : requireRealEmbeddingProvider(embed, "Platform RAG indexing")
      await store.indexPlatformContent({
        chatbotId: job.chatbotId,
        contentItemId: job.contentItemId,
        sourceVersionId: job.contentVersionId,
        documentId: job.documentId,
        embed: realEmbed,
      })
    }
  }

  const queue = createRagIndexQueue(config)
  return async (job) => {
    await enqueuePlatformRagIndex(queue, job)
  }
}
