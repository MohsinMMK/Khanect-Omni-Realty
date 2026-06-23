import type { Connector } from "@/features/admin/types"

export function channelDescription(channel: Connector["channel"]) {
  if (channel === "website") return "Embeddable website widget for the selected chatbot."
  if (channel === "whatsapp") return "Meta WhatsApp Business connector placeholder."
  return "Instagram DM connector placeholder."
}