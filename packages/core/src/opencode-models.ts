import {
  OPENCODE_GO_BASE_URL,
  OPENCODE_ZEN_BASE_URL,
  type AiProviderPreset,
  type OpenCodeLlmPlan,
  opencodeGoLlmPresets,
  opencodeZenLlmPresets,
} from "./ai-provider-catalog.js"

/** Docs: https://opencode.ai/docs/go/ — these use /messages, not chat/completions. */
export const OPENCODE_GO_MESSAGES_ONLY_MODELS = new Set([
  "minimax-m3",
  "minimax-m2.7",
  "minimax-m2.5",
  "qwen3.7-max",
  "qwen3.7-plus",
  "qwen3.6-plus",
])

export const OPENCODE_GO_RECOMMENDED_MODEL = "glm-5.2"
export const OPENCODE_ZEN_RECOMMENDED_MODEL = "gpt-5.4-mini"

export type OpenCodeModelCatalogEntry = {
  id: string
  label: string
  model: string
  baseUrl: string
  plan: OpenCodeLlmPlan
  supported: boolean
  recommended: boolean
  summary: string
}

export type OpenCodeModelCatalog = {
  plan: OpenCodeLlmPlan
  baseUrl: string
  fetchedAt: string
  source: "live" | "fallback"
  models: OpenCodeModelCatalogEntry[]
  detail?: string
}

type OpenCodeModelsApiResponse = {
  data?: Array<{ id: string }>
}

const UPPERCASE_MODEL_TOKENS = new Set(["glm", "gpt", "qwen", "mimo"])

function formatModelToken(part: string): string {
  if (/^\d/.test(part)) return part
  if (UPPERCASE_MODEL_TOKENS.has(part)) return part.toUpperCase()
  return part.charAt(0).toUpperCase() + part.slice(1)
}

export function formatOpenCodeModelLabel(modelId: string): string {
  return modelId.split("-").map(formatModelToken).join(" ")
}

export function isOpenCodeGoModelSupported(modelId: string): boolean {
  return !OPENCODE_GO_MESSAGES_ONLY_MODELS.has(modelId)
}

/** Zen models outside these families use non-chat/completions endpoints in OpenCode. */
export function isOpenCodeZenModelSupported(modelId: string): boolean {
  if (/^(claude|gpt-|gemini|qwen)/.test(modelId)) return false
  return /^(deepseek|glm|kimi-k2|minimax-m2|grok-build|big-pickle|mimo|north-mini|nemotron)/.test(modelId)
}

export function isOpenCodeModelSupported(plan: OpenCodeLlmPlan, modelId: string): boolean {
  return plan === "go" ? isOpenCodeGoModelSupported(modelId) : isOpenCodeZenModelSupported(modelId)
}

function planBaseUrl(plan: OpenCodeLlmPlan): string {
  return plan === "go" ? OPENCODE_GO_BASE_URL : OPENCODE_ZEN_BASE_URL
}

function recommendedModelId(plan: OpenCodeLlmPlan): string {
  return plan === "go" ? OPENCODE_GO_RECOMMENDED_MODEL : OPENCODE_ZEN_RECOMMENDED_MODEL
}

function summaryForModel(plan: OpenCodeLlmPlan, modelId: string, supported: boolean): string {
  if (!supported) {
    return plan === "go"
      ? "Uses OpenCode /messages — not compatible with this chatbot runtime yet."
      : "Uses a non-chat/completions Zen endpoint — not compatible with this chatbot runtime yet."
  }
  if (modelId === recommendedModelId(plan)) {
    return plan === "go"
      ? "Recommended Go plan model for grounded real-estate chat answers."
      : "Recommended Zen model for grounded chat answers."
  }
  return `Live from OpenCode ${plan === "go" ? "Go" : "Zen"} catalog.`
}

export function buildOpenCodeModelCatalog(
  plan: OpenCodeLlmPlan,
  modelIds: string[],
  source: OpenCodeModelCatalog["source"],
  fetchedAt = new Date().toISOString(),
  detail?: string,
): OpenCodeModelCatalog {
  const baseUrl = planBaseUrl(plan)
  const recommended = recommendedModelId(plan)

  const models = modelIds
    .map((modelId) => {
      const supported = isOpenCodeModelSupported(plan, modelId)
      return {
        id: modelId,
        label: formatOpenCodeModelLabel(modelId),
        model: modelId,
        baseUrl,
        plan,
        supported,
        recommended: supported && modelId === recommended,
        summary: summaryForModel(plan, modelId, supported),
      }
    })
    .sort((left, right) => {
      if (left.recommended !== right.recommended) return left.recommended ? -1 : 1
      if (left.supported !== right.supported) return left.supported ? -1 : 1
      return left.label.localeCompare(right.label)
    })

  return { plan, baseUrl, fetchedAt, source, models, detail }
}

export function fallbackOpenCodeModelCatalog(plan: OpenCodeLlmPlan, detail?: string): OpenCodeModelCatalog {
  const presets = plan === "go" ? opencodeGoLlmPresets : opencodeZenLlmPresets
  return buildOpenCodeModelCatalog(
    plan,
    presets.map((preset) => preset.model),
    "fallback",
    new Date().toISOString(),
    detail,
  )
}

export async function fetchOpenCodeModelIds(
  plan: OpenCodeLlmPlan,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 8_000,
): Promise<string[]> {
  const baseUrl = planBaseUrl(plan)
  const response = await fetchImpl(`${baseUrl}/models`, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { accept: "application/json" },
  })

  if (!response.ok) {
    throw new Error(`OpenCode ${plan} models request failed with status ${response.status}`)
  }

  const payload = (await response.json()) as OpenCodeModelsApiResponse
  const ids = payload.data?.map((entry) => entry.id).filter((id): id is string => Boolean(id)) ?? []
  if (ids.length === 0) {
    throw new Error(`OpenCode ${plan} models response was empty`)
  }

  return ids
}

export async function loadOpenCodeModelCatalog(
  plan: OpenCodeLlmPlan,
  options: { fetchImpl?: typeof fetch; forceRefresh?: boolean; cache?: OpenCodeModelCatalogCache } = {},
): Promise<OpenCodeModelCatalog> {
  const fetchImpl = options.fetchImpl ?? fetch
  const cache = options.cache ?? createOpenCodeModelCatalogCache()

  if (!options.forceRefresh) {
    const cached = cache.get(plan)
    if (cached) return cached
  }

  try {
    const modelIds = await fetchOpenCodeModelIds(plan, fetchImpl)
    const catalog = buildOpenCodeModelCatalog(plan, modelIds, "live")
    cache.set(plan, catalog)
    return catalog
  } catch (error) {
    const detail = error instanceof Error ? error.message : "OpenCode model catalog fetch failed"
    const fallback = fallbackOpenCodeModelCatalog(plan, detail)
    cache.set(plan, fallback, 60_000)
    return fallback
  }
}

export type OpenCodeModelCatalogCache = {
  get(plan: OpenCodeLlmPlan): OpenCodeModelCatalog | null
  set(plan: OpenCodeLlmPlan, catalog: OpenCodeModelCatalog, ttlMs?: number): void
  clear(): void
}

type CacheEntry = { catalog: OpenCodeModelCatalog; expiresAt: number }

export function createOpenCodeModelCatalogCache(ttlMs = 15 * 60_000): OpenCodeModelCatalogCache {
  const entries = new Map<OpenCodeLlmPlan, CacheEntry>()

  return {
    get(plan) {
      const entry = entries.get(plan)
      if (!entry) return null
      if (Date.now() > entry.expiresAt) {
        entries.delete(plan)
        return null
      }
      return entry.catalog
    },
    set(plan, catalog, customTtlMs = ttlMs) {
      entries.set(plan, { catalog, expiresAt: Date.now() + customTtlMs })
    },
    clear() {
      entries.clear()
    },
  }
}

export function toAiProviderPresets(catalog: OpenCodeModelCatalog): AiProviderPreset[] {
  return catalog.models
    .filter((entry) => entry.supported)
    .map((entry) => ({
      id: entry.id,
      label: entry.label,
      baseUrl: entry.baseUrl,
      model: entry.model,
      summary: entry.summary,
      plan: entry.plan,
      recommended: entry.recommended,
    }))
}