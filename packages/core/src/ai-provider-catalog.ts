import { OPENAI_EMBEDDING_MODEL } from "./embedding.js"

export const OPENCODE_ZEN_BASE_URL = "https://opencode.ai/zen/v1"
export const OPENAI_COMPATIBLE_EMBEDDINGS_BASE_URL = "https://api.openai.com/v1"

export type AiProviderPreset = {
  id: string
  label: string
  baseUrl: string
  model: string
  summary: string
  recommended?: boolean
}

export const opencodeLlmPresets: AiProviderPreset[] = [
  {
    id: "gpt-5.4-mini",
    label: "GPT 5.4 Mini",
    baseUrl: OPENCODE_ZEN_BASE_URL,
    model: "gpt-5.4-mini",
    summary: "Balanced OpenCode Zen model for grounded chat answers.",
    recommended: true,
  },
  {
    id: "gpt-5.4-nano",
    label: "GPT 5.4 Nano",
    baseUrl: OPENCODE_ZEN_BASE_URL,
    model: "gpt-5.4-nano",
    summary: "Lower-cost OpenCode Zen model for lighter traffic.",
  },
  {
    id: "deepseek-v4-flash",
    label: "DeepSeek V4 Flash",
    baseUrl: OPENCODE_ZEN_BASE_URL,
    model: "deepseek-v4-flash",
    summary: "Fast OpenCode Zen model for high-volume widget traffic.",
  },
]

export const openAiCompatibleEmbeddingPresets: AiProviderPreset[] = [
  {
    id: "text-embedding-3-small",
    label: "text-embedding-3-small",
    baseUrl: OPENAI_COMPATIBLE_EMBEDDINGS_BASE_URL,
    model: OPENAI_EMBEDDING_MODEL,
    summary: "Hosted 1024-dim vectors for RAG search. Uses a separate embeddings API from chat.",
    recommended: true,
  },
]

export const recommendedOpencodeLlmPreset =
  opencodeLlmPresets.find((preset) => preset.recommended) ?? opencodeLlmPresets[0]

export const recommendedEmbeddingPreset =
  openAiCompatibleEmbeddingPresets.find((preset) => preset.recommended) ?? openAiCompatibleEmbeddingPresets[0]