export const ragIndexQueueName = "rag.index"

/** BullMQ rejects custom job IDs that contain ":" — use a stable dedupe key per published version. */
export function buildPlatformRagIndexJobId(chatbotId: string, contentVersionId: string) {
  return `${chatbotId}__${contentVersionId}`
}

export interface RagIndexJobPayload {
  chatbotId: string
  contentItemId: string
  contentVersionId: string
  documentId: string
  tenantId?: string
}

export interface LegacyRagIndexJobPayload {
  contentItemId?: string
}

export type RagIndexJobData = RagIndexJobPayload | LegacyRagIndexJobPayload

export function isPlatformRagIndexJob(data: RagIndexJobData): data is RagIndexJobPayload {
  return Boolean(
    "chatbotId" in data &&
      data.chatbotId &&
      "contentVersionId" in data &&
      data.contentVersionId &&
      "documentId" in data &&
      data.documentId &&
      "contentItemId" in data &&
      data.contentItemId,
  )
}