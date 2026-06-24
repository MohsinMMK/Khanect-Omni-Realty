import { OPENAI_EMBEDDING_MODEL } from "./embedding.js"

export const OPENCODE_ZEN_BASE_URL = "https://opencode.ai/zen/v1"
export const OPENCODE_GO_BASE_URL = "https://opencode.ai/zen/go/v1"
export const OPENAI_COMPATIBLE_EMBEDDINGS_BASE_URL = "https://api.openai.com/v1"

export type OpenCodeLlmPlan = "go" | "zen"

export type AiProviderPreset = {
  id: string
  label: string
  baseUrl: string
  model: string
  summary: string
  plan?: OpenCodeLlmPlan
  recommended?: boolean
}

/** OpenCode Go — $10/mo open models via chat/completions. Docs: https://opencode.ai/docs/go/ */
export const opencodeGoLlmPresets: AiProviderPreset[] = [
  {
    id: "glm-5.2",
    label: "GLM 5.2",
    baseUrl: OPENCODE_GO_BASE_URL,
    model: "glm-5.2",
    plan: "go",
    summary: "Recommended Go plan model for grounded real-estate chat answers.",
    recommended: true,
  },
  {
    id: "deepseek-v4-flash",
    label: "DeepSeek V4 Flash",
    baseUrl: OPENCODE_GO_BASE_URL,
    model: "deepseek-v4-flash",
    plan: "go",
    summary: "Highest volume on Go — great for busy widget traffic.",
  },
  {
    id: "kimi-k2.7-code",
    label: "Kimi K2.7 Code",
    baseUrl: OPENCODE_GO_BASE_URL,
    model: "kimi-k2.7-code",
    plan: "go",
    summary: "Strong coding-oriented Go model for structured property answers.",
  },
  {
    id: "mimo-v2.5",
    label: "MiMo V2.5",
    baseUrl: OPENCODE_GO_BASE_URL,
    model: "mimo-v2.5",
    plan: "go",
    summary: "Low-cost Go model with very high monthly request limits.",
  },
]

/** OpenCode Zen — pay-as-you-go curated models. Docs: https://opencode.ai/docs/zen/ */
export const opencodeZenLlmPresets: AiProviderPreset[] = [
  {
    id: "gpt-5.4-mini",
    label: "GPT 5.4 Mini",
    baseUrl: OPENCODE_ZEN_BASE_URL,
    model: "gpt-5.4-mini",
    plan: "zen",
    summary: "Balanced Zen model for grounded chat answers.",
  },
  {
    id: "gpt-5.4-nano",
    label: "GPT 5.4 Nano",
    baseUrl: OPENCODE_ZEN_BASE_URL,
    model: "gpt-5.4-nano",
    plan: "zen",
    summary: "Lower-cost Zen model for lighter traffic.",
  },
  {
    id: "deepseek-v4-flash-zen",
    label: "DeepSeek V4 Flash",
    baseUrl: OPENCODE_ZEN_BASE_URL,
    model: "deepseek-v4-flash",
    plan: "zen",
    summary: "Fast Zen model for high-volume widget traffic.",
  },
]

export const opencodeLlmPresets: AiProviderPreset[] = [...opencodeGoLlmPresets, ...opencodeZenLlmPresets]

export const openAiCompatibleEmbeddingPresets: AiProviderPreset[] = [
  {
    id: "text-embedding-3-small",
    label: "text-embedding-3-small",
    baseUrl: OPENAI_COMPATIBLE_EMBEDDINGS_BASE_URL,
    model: OPENAI_EMBEDDING_MODEL,
    summary: "Hosted 1024-dim vectors for RAG search. Separate from OpenCode chat plans.",
    recommended: true,
  },
]

export const recommendedOpencodeLlmPreset =
  opencodeGoLlmPresets.find((preset) => preset.recommended) ?? opencodeGoLlmPresets[0]

export const recommendedEmbeddingPreset =
  openAiCompatibleEmbeddingPresets.find((preset) => preset.recommended) ?? openAiCompatibleEmbeddingPresets[0]

export function listOpencodeLlmPresetsByPlan(plan: OpenCodeLlmPlan): AiProviderPreset[] {
  return plan === "go" ? opencodeGoLlmPresets : opencodeZenLlmPresets
}