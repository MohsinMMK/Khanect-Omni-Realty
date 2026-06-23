export type MetaInboundMessage = {
  channel: "whatsapp" | "instagram_dm"
  externalUserId: string
  messageId: string
  text: string
  phoneNumberId?: string
  instagramAccountId?: string
}

export function parseWhatsAppInbound(payload: unknown): MetaInboundMessage[] {
  if (!payload || typeof payload !== "object") return []
  const body = payload as { object?: string; entry?: unknown[] }
  if (body.object !== "whatsapp_business_account" || !Array.isArray(body.entry)) return []

  const messages: MetaInboundMessage[] = []
  for (const entry of body.entry) {
    if (!entry || typeof entry !== "object") continue
    const changes = (entry as { changes?: unknown[] }).changes
    if (!Array.isArray(changes)) continue
    for (const change of changes) {
      if (!change || typeof change !== "object") continue
      const value = (change as { value?: Record<string, unknown> }).value
      if (!value || value.messaging_product !== "whatsapp") continue
      const phoneNumberId = typeof value.metadata === "object" && value.metadata !== null
        ? String((value.metadata as { phone_number_id?: string }).phone_number_id ?? "")
        : ""
      const inbound = Array.isArray(value.messages) ? value.messages : []
      for (const message of inbound) {
        if (!message || typeof message !== "object") continue
        const record = message as { from?: string; id?: string; type?: string; text?: { body?: string } }
        if (record.type !== "text" || !record.text?.body?.trim() || !record.from || !record.id) continue
        messages.push({
          channel: "whatsapp",
          externalUserId: record.from,
          messageId: record.id,
          text: record.text.body.trim(),
          phoneNumberId: phoneNumberId || undefined,
        })
      }
    }
  }
  return messages
}

export function parseInstagramInbound(payload: unknown): MetaInboundMessage[] {
  if (!payload || typeof payload !== "object") return []
  const body = payload as { object?: string; entry?: unknown[] }
  if (body.object !== "instagram" || !Array.isArray(body.entry)) return []

  const messages: MetaInboundMessage[] = []
  for (const entry of body.entry) {
    if (!entry || typeof entry !== "object") continue
    const record = entry as { id?: string; messaging?: unknown[] }
    const instagramAccountId = typeof record.id === "string" ? record.id : undefined
    if (!Array.isArray(record.messaging)) continue
    for (const event of record.messaging) {
      if (!event || typeof event !== "object") continue
      const messaging = event as {
        sender?: { id?: string }
        message?: { mid?: string; text?: string }
      }
      const text = messaging.message?.text?.trim()
      const senderId = messaging.sender?.id
      const messageId = messaging.message?.mid
      if (!text || !senderId || !messageId) continue
      messages.push({
        channel: "instagram_dm",
        externalUserId: senderId,
        messageId,
        text,
        instagramAccountId,
      })
    }
  }
  return messages
}