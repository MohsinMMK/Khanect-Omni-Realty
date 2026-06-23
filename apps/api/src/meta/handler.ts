import type { AppConfig } from "@workspace/config"
import type { ConnectorChannel, ProductionChatbotStore } from "@workspace/db"

import type { MetaInboundMessage } from "./inbound.js"
import { sendInstagramTextReply, sendWhatsAppTextReply } from "./outbound.js"

export interface MetaWebhookHandlerResult {
  accepted: boolean
  channel: ConnectorChannel
  processed: number
  replied: number
  skipped: number
  failures: Array<{ messageId: string; detail: string }>
}

export async function handleMetaInboundMessages(
  config: AppConfig,
  store: ProductionChatbotStore,
  messages: MetaInboundMessage[],
  fetchImpl: typeof fetch = fetch,
): Promise<MetaWebhookHandlerResult> {
  const channel = messages[0]?.channel ?? "whatsapp"
  const result: MetaWebhookHandlerResult = {
    accepted: true,
    channel,
    processed: 0,
    replied: 0,
    skipped: 0,
    failures: [],
  }

  for (const message of messages) {
    result.processed += 1
    const chatbot = await store.findActiveChatbotForChannel(message.channel)
    if (!chatbot) {
      result.skipped += 1
      result.failures.push({ messageId: message.messageId, detail: "No active chatbot connector for channel." })
      continue
    }

    const answer = await store.testMessage(chatbot.id, {
      message: message.text,
      channel: message.channel,
    })
    if (!answer) {
      result.skipped += 1
      result.failures.push({ messageId: message.messageId, detail: "Chatbot did not return an answer." })
      continue
    }

    await store.recordChannelExchange(chatbot.id, {
      channel: message.channel,
      externalUserId: message.externalUserId,
      externalMessageId: message.messageId,
      inboundText: message.text,
      outboundText: answer.answer,
      actionTrace: answer.actionTrace,
    })

    const outbound = message.channel === "whatsapp"
      ? await sendWhatsAppTextReply(config, { to: message.externalUserId, text: answer.answer }, fetchImpl)
      : await sendInstagramTextReply(config, { recipientId: message.externalUserId, text: answer.answer }, fetchImpl)

    if (!outbound.ok) {
      result.failures.push({ messageId: message.messageId, detail: outbound.detail ?? "Outbound send failed." })
      continue
    }

    result.replied += 1
  }

  return result
}