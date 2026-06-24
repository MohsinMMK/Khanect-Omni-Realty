import { describe, expect, it } from "vitest"

import {
  agentCapabilityCatalog,
  buildAgentCapabilityPolicy,
  getEnabledAgentCapabilityIds,
  validateAgentCapabilities,
} from "../src/index.js"

describe("agent capability catalog", () => {
  it("maps selected business capabilities to scoped tools and instructions", () => {
    const policy = buildAgentCapabilityPolicy({
      chatbotName: "Marina assistant",
      purpose: "Answer Marina Heights buyer questions.",
      channel: "website",
      sourceIds: ["chunk_1"],
      capabilities: {
        faq: true,
        leadCapture: true,
        appointmentBooking: false,
        propertyRecommendations: true,
      },
    })

    expect(Object.keys(agentCapabilityCatalog)).toEqual([
      "faq",
      "leadCapture",
      "appointmentBooking",
      "propertyRecommendations",
    ])
    expect(policy.policyVersion).toBe("agent-capability-policy-v1")
    expect(policy.capabilityIds).toEqual(["faq", "leadCapture", "propertyRecommendations"])
    expect(policy.toolsEnabled).toEqual([
      "capture_lead",
      "request_human_handoff",
      "get_business_contact",
      "recommend_property",
    ])
    expect(policy.toolsDenied).toEqual(["request_appointment"])
    expect(policy.instructions.join("\n")).toContain("Answer only from approved indexed source excerpts")
    expect(policy.instructions.join("\n")).toContain("Do not book or request appointments")
    expect(policy.instructions.join("\n")).toContain("Recommend properties only when approved property or project sources support the recommendation")
  })

  it("reports missing source requirements for property recommendations", () => {
    const validation = validateAgentCapabilities({
      capabilities: {
        faq: true,
        leadCapture: false,
        appointmentBooking: false,
        propertyRecommendations: true,
      },
      indexedSourceTypes: ["faq"],
    })

    expect(getEnabledAgentCapabilityIds(validation.capabilities)).toEqual(["faq", "propertyRecommendations"])
    expect(validation.availableTools).toEqual(["get_business_contact"])
    expect(validation.missingRequirements).toEqual([
      {
        capabilityId: "propertyRecommendations",
        code: "SOURCE_TYPE_REQUIRED",
        message: "Publish at least one approved property or project source before enabling property recommendations.",
      },
    ])
    expect(validation.ready).toBe(false)
  })
})
