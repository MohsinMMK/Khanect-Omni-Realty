import type { ChatbotCapabilities } from "@/features/admin/types"

export const capabilityOptions = [
  {
    value: "faq",
    label: "FAQ answers",
    description: "Answers only from approved indexed source excerpts.",
    tools: ["Approved-source search"],
  },
  {
    value: "leadCapture",
    label: "Lead capture",
    description: "Records visitor contact intent and can request human follow-up.",
    tools: ["capture_lead", "request_human_handoff"],
  },
  {
    value: "appointmentBooking",
    label: "Appointment booking",
    description: "Records appointment requests without promising availability.",
    tools: ["request_appointment"],
  },
  {
    value: "propertyRecommendations",
    label: "Property recommendations",
    description: "Recommends properties only from approved property or project sources.",
    tools: ["recommend_property"],
  },
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

export function capabilitiesToSelection(capabilities: ChatbotCapabilities) {
  return capabilityOptions
    .filter((option) => capabilities[option.value as keyof ChatbotCapabilities])
    .map((option) => option.value)
}
