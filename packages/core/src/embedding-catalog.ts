export type EmbeddingProviderModeForCatalog = "stub" | "local" | "openai"

export const BGE_SMALL_EN_V15_EMBEDDING_MODEL = "BAAI/bge-small-en-v1.5"
export const BGE_BASE_EN_V15_EMBEDDING_MODEL = "BAAI/bge-base-en-v1.5"
export const BGE_SMALL_EN_V15_DIMENSION = 384
export const BGE_BASE_EN_V15_DIMENSION = 768

export type EmbeddingModelPresetId = "bge-small-en-v1.5" | "bge-base-en-v1.5"

export interface EmbeddingModelPreset {
  id: EmbeddingModelPresetId
  provider: "local"
  model: string
  dimension: number
  label: string
  summary: string
  ramHint: string
  recommended: boolean
}

export const localEmbeddingModelPresets = [
  {
    id: "bge-small-en-v1.5",
    provider: "local",
    model: BGE_SMALL_EN_V15_EMBEDDING_MODEL,
    dimension: BGE_SMALL_EN_V15_DIMENSION,
    label: "BGE small",
    summary: "Lowest RAM local English embedder for compact VPS deployments.",
    ramHint: "Smallest footprint; good for tight 1-2 GB embedder budgets.",
    recommended: false,
  },
  {
    id: "bge-base-en-v1.5",
    provider: "local",
    model: BGE_BASE_EN_V15_EMBEDDING_MODEL,
    dimension: BGE_BASE_EN_V15_DIMENSION,
    label: "BGE base",
    summary: "Recommended production default for better retrieval quality on an 8 GB VPS.",
    ramHint: "Moderate footprint; stronger retrieval than small.",
    recommended: true,
  },
] as const satisfies readonly EmbeddingModelPreset[]

export function getLocalEmbeddingPresetByModel(model: string | null | undefined): EmbeddingModelPreset | undefined {
  const normalized = model?.trim()
  return localEmbeddingModelPresets.find((preset) => preset.model === normalized)
}

export function isSupportedLocalEmbeddingModel(model: string | null | undefined): boolean {
  return Boolean(getLocalEmbeddingPresetByModel(model))
}

export function resolveEmbeddingDimension(input: {
  provider: EmbeddingProviderModeForCatalog
  model?: string | null
  fallbackDimension?: number
}): number {
  if (input.provider === "local") {
    return getLocalEmbeddingPresetByModel(input.model)?.dimension ?? input.fallbackDimension ?? BGE_BASE_EN_V15_DIMENSION
  }
  return input.fallbackDimension ?? 1024
}
