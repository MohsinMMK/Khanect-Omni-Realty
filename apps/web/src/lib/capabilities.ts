import type { ChatbotCapabilities } from "@/features/admin/types"

export const capabilityOptions = [
  { value: "faq", label: "FAQ answers" },
  { value: "leadCapture", label: "Lead capture" },
  { value: "appointmentBooking", label: "Appointment booking" },
  { value: "propertyRecommendations", label: "Property recommendations" },
]

export function capabilityPayload(capabilities: string[]) {
  return {
    faq: capabilities.includes("faq"),
    leadCapture: capabilities.includes("leadCapture"),
    appointmentBooking: capabilities.includes("appointmentBooking"),
    propertyRecommendations: capabilities.includes("propertyRecommendations"),
  }
}

export function getSelectedCapabilityLabels(capabilities: ChatbotCapabilities) {
  return capabilityOptions
    .filter((option) => Boolean(capabilities[option.value as keyof ChatbotCapabilities]))
    .map((option) => option.label)
}