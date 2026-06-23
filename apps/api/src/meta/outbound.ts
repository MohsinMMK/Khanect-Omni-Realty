import type { AppConfig } from "@workspace/config"

export interface MetaOutboundResult {
  ok: boolean
  externalMessageId?: string
  detail?: string
}

const graphApiVersion = "v21.0"

export async function sendWhatsAppTextReply(
  config: AppConfig,
  input: { to: string; text: string },
  fetchImpl: typeof fetch = fetch,
): Promise<MetaOutboundResult> {
  const phoneNumberId = config.meta.whatsapp.phoneNumberId?.trim()
  const accessToken = config.meta.whatsapp.accessToken?.trim()
  if (!config.meta.whatsapp.enabled || !phoneNumberId || !accessToken) {
    return { ok: false, detail: "WhatsApp channel is not configured." }
  }

  const response = await fetchImpl(`https://graph.facebook.com/${graphApiVersion}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: input.to,
      type: "text",
      text: { body: input.text },
    }),
  })

  if (!response.ok) {
    return { ok: false, detail: `WhatsApp send failed with status ${response.status}` }
  }

  const payload = (await response.json()) as { messages?: Array<{ id?: string }> }
  return { ok: true, externalMessageId: payload.messages?.[0]?.id }
}

export async function sendInstagramTextReply(
  config: AppConfig,
  input: { recipientId: string; text: string },
  fetchImpl: typeof fetch = fetch,
): Promise<MetaOutboundResult> {
  const pageId = config.meta.instagram.pageId?.trim()
  const accessToken = config.meta.instagram.accessToken?.trim()
  if (!config.meta.instagram.messagingEnabled || !pageId || !accessToken) {
    return { ok: false, detail: "Instagram messaging is not configured." }
  }

  const response = await fetchImpl(`https://graph.facebook.com/${graphApiVersion}/${pageId}/messages`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      recipient: { id: input.recipientId },
      message: { text: input.text },
    }),
  })

  if (!response.ok) {
    return { ok: false, detail: `Instagram send failed with status ${response.status}` }
  }

  const payload = (await response.json()) as { message_id?: string }
  return { ok: true, externalMessageId: payload.message_id }
}