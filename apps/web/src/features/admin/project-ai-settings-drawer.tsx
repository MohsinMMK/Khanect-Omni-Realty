import {
  openAiCompatibleEmbeddingPresets,
  OPENAI_COMPATIBLE_EMBEDDINGS_BASE_URL,
  OPENCODE_GO_BASE_URL,
  OPENCODE_ZEN_BASE_URL,
  recommendedEmbeddingPreset,
  recommendedOpencodeLlmPreset,
} from "@workspace/core"
import { localEmbeddingModelPresets } from "@workspace/core/embedding-catalog"
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@workspace/ui/components/drawer"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import { Separator } from "@workspace/ui/components/separator"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Spinner } from "@workspace/ui/components/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group"
import { cn } from "@workspace/ui/lib/utils"
import { Bot, Cloud, KeyRound, Lock, RefreshCw, Server, ShieldCheck, Sparkles } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import { api, getErrorMessage } from "@/lib/api"
import { AlertCallout } from "./components"
import type {
  EmbeddingProviderMode,
  EmbeddingSmokeTestResult,
  Project,
  ProjectAiConfig,
  ProjectAiKeySummary,
  OpenCodeModelCatalog,
  ProjectAiSource,
  ProjectLlmSmokeTestResult,
} from "./types"

const embeddingProviderOptions: Array<{ id: EmbeddingProviderMode; label: string; icon: typeof Cloud }> = [
  { id: "openai", label: "Hosted API", icon: Cloud },
  { id: "local", label: "Local BGE", icon: Server },
]

const recommendedLocalEmbeddingModel =
  localEmbeddingModelPresets.find((preset) => preset.recommended)?.model ?? "BAAI/bge-base-en-v1.5"

function LlmPresetSection({
  title,
  description,
  catalog,
  loading,
  selectedModel,
  selectedBaseUrl,
  onSelect,
}: {
  title: string
  description: string
  catalog: OpenCodeModelCatalog | null
  loading: boolean
  selectedModel: string
  selectedBaseUrl: string
  onSelect: (model: string, baseUrl: string) => void
}) {
  const supportedModels = catalog?.models.filter((entry) => entry.supported) ?? []
  const catalogMeta = catalog
    ? `${supportedModels.length} supported of ${catalog.models.length} live models · ${catalog.source === "live" ? "synced" : "cached fallback"}`
    : null

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
        {catalogMeta && <p className="mt-1 text-xs text-muted-foreground">{catalogMeta}</p>}
        {catalog?.source === "fallback" && catalog.detail && (
          <p className="mt-1 text-xs text-amber-600">{catalog.detail}</p>
        )}
      </div>
      {loading && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
      )}
      {!loading && supportedModels.length === 0 && (
        <p className="text-sm text-muted-foreground">No supported models are available right now.</p>
      )}
      {!loading && supportedModels.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {supportedModels.map((preset) => {
            const selected = selectedModel === preset.model && selectedBaseUrl === preset.baseUrl
            return (
              <button
                key={preset.id}
                type="button"
                className={cn(
                  "rounded-lg border p-4 text-left transition-colors",
                  selected ? "border-primary bg-primary/10" : "border-border bg-background hover:bg-muted",
                )}
                onClick={() => onSelect(preset.model, preset.baseUrl)}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{preset.label}</span>
                  {preset.recommended && <Badge variant="secondary">Recommended</Badge>}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{preset.summary}</p>
                <Badge className="mt-3" variant="outline">
                  {preset.model}
                </Badge>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function ProjectAiSettingsDrawer({
  open,
  onOpenChange,
  onSaved,
  project,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: (projectId: string, aiKeys: ProjectAiKeySummary) => void
  project: Project | null
}) {
  const [config, setConfig] = useState<ProjectAiConfig | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [activeTab, setActiveTab] = useState("llm")

  const [llmSource, setLlmSource] = useState<ProjectAiSource>("project")
  const [llmApiKey, setLlmApiKey] = useState("")
  const [llmBaseUrl, setLlmBaseUrl] = useState(recommendedOpencodeLlmPreset.baseUrl)
  const [llmModel, setLlmModel] = useState(recommendedOpencodeLlmPreset.model)

  const [embeddingSource, setEmbeddingSource] = useState<ProjectAiSource>("project")
  const [embeddingProvider, setEmbeddingProvider] = useState<EmbeddingProviderMode>("openai")
  const [embeddingApiKey, setEmbeddingApiKey] = useState("")
  const [embeddingBaseUrl, setEmbeddingBaseUrl] = useState(OPENAI_COMPATIBLE_EMBEDDINGS_BASE_URL)
  const [embedderUrl, setEmbedderUrl] = useState("")
  const [embeddingModel, setEmbeddingModel] = useState(recommendedEmbeddingPreset.model)

  const [llmTesting, setLlmTesting] = useState(false)
  const [embeddingTesting, setEmbeddingTesting] = useState(false)
  const [llmTestResult, setLlmTestResult] = useState<ProjectLlmSmokeTestResult | null>(null)
  const [embeddingTestResult, setEmbeddingTestResult] = useState<EmbeddingSmokeTestResult | null>(null)
  const [testError, setTestError] = useState("")
  const [goCatalog, setGoCatalog] = useState<OpenCodeModelCatalog | null>(null)
  const [zenCatalog, setZenCatalog] = useState<OpenCodeModelCatalog | null>(null)
  const [modelsLoading, setModelsLoading] = useState(false)
  const [modelsError, setModelsError] = useState("")

  const loadOpenCodeModels = useCallback(async (refresh = false) => {
    setModelsLoading(true)
    setModelsError("")
    const refreshQuery = refresh ? "&refresh=1" : ""
    try {
      const [go, zen] = await Promise.all([
        api<OpenCodeModelCatalog>(`/admin/ai/opencode/models?plan=go${refreshQuery}`),
        api<OpenCodeModelCatalog>(`/admin/ai/opencode/models?plan=zen${refreshQuery}`),
      ])
      setGoCatalog(go)
      setZenCatalog(zen)
    } catch (apiError) {
      setModelsError(getErrorMessage(apiError))
    } finally {
      setModelsLoading(false)
    }
  }, [])

  const resetForm = useCallback((next: ProjectAiConfig) => {
    setLlmSource(next.llm.source)
    setLlmApiKey("")
    setLlmBaseUrl(next.llm.baseUrl ?? recommendedOpencodeLlmPreset.baseUrl)
    setLlmModel(next.llm.model ?? recommendedOpencodeLlmPreset.model)
    setEmbeddingSource(next.embedding.source)
    setEmbeddingProvider(next.embedding.configuredProvider ?? next.embedding.provider)
    setEmbeddingApiKey("")
    setEmbeddingBaseUrl(next.embedding.baseUrl ?? recommendedEmbeddingPreset.baseUrl)
    setEmbedderUrl(next.embedding.embedderUrl ?? "")
    setEmbeddingModel(next.embedding.model ?? recommendedEmbeddingPreset.model)
    setLlmTestResult(null)
    setEmbeddingTestResult(null)
    setTestError("")
  }, [])

  const loadConfig = useCallback(async () => {
    if (!project) return
    setLoading(true)
    setError("")
    try {
      const response = await api<ProjectAiConfig>(`/admin/projects/${project.id}/ai-config`)
      setConfig(response)
      resetForm(response)
    } catch (apiError) {
      setConfig(null)
      setError(getErrorMessage(apiError))
    } finally {
      setLoading(false)
    }
  }, [project, resetForm])

  useEffect(() => {
    if (open && project) {
      void loadConfig()
      void loadOpenCodeModels()
    }
  }, [open, project, loadConfig, loadOpenCodeModels])

  function applyLlmPreset(model: string, baseUrl: string) {
    setLlmModel(model)
    setLlmBaseUrl(baseUrl)
  }

  function applyEmbeddingPreset(model: string, baseUrl: string) {
    setEmbeddingModel(model)
    setEmbeddingBaseUrl(baseUrl)
  }

  async function saveConfig() {
    if (!project) return
    setSaving(true)
    setError("")
    try {
      const response = await api<{ config: ProjectAiConfig }>(`/admin/projects/${project.id}/ai-config`, {
        method: "PATCH",
        body: {
          llm: {
            source: llmSource,
            ...(llmApiKey.trim() ? { apiKey: llmApiKey.trim() } : {}),
            baseUrl: llmSource === "project" ? llmBaseUrl.trim() || null : null,
            model: llmSource === "project" ? llmModel.trim() || null : null,
          },
          embedding: {
            source: embeddingSource,
            ...(embeddingSource === "project" ? { provider: embeddingProvider } : {}),
            ...(embeddingApiKey.trim() ? { apiKey: embeddingApiKey.trim() } : {}),
            baseUrl: embeddingSource === "project" && embeddingProvider === "openai" ? embeddingBaseUrl.trim() || null : null,
            embedderUrl: embeddingSource === "project" ? embedderUrl.trim() || null : null,
            model: embeddingSource === "project" ? embeddingModel.trim() || null : null,
          },
        },
      })
      setConfig(response.config)
      resetForm(response.config)
      setLlmApiKey("")
      setEmbeddingApiKey("")
      onSaved?.(project.id, {
        llmSource: response.config.llm.source,
        embeddingSource: response.config.embedding.source,
      })
    } catch (apiError) {
      setError(getErrorMessage(apiError))
    } finally {
      setSaving(false)
    }
  }

  async function runLlmTest() {
    if (!project) return
    setLlmTesting(true)
    setTestError("")
    setLlmTestResult(null)
    try {
      const result = await api<ProjectLlmSmokeTestResult>(`/admin/projects/${project.id}/ai-config/llm/test`, {
        method: "POST",
        body: {},
      })
      setLlmTestResult(result)
    } catch (apiError) {
      setTestError(getErrorMessage(apiError))
    } finally {
      setLlmTesting(false)
    }
  }

  async function runEmbeddingTest() {
    if (!project) return
    setEmbeddingTesting(true)
    setTestError("")
    setEmbeddingTestResult(null)
    try {
      const result = await api<EmbeddingSmokeTestResult>(`/admin/projects/${project.id}/ai-config/embedding/test`, {
        method: "POST",
        body: {},
      })
      setEmbeddingTestResult(result)
    } catch (apiError) {
      setTestError(getErrorMessage(apiError))
    } finally {
      setEmbeddingTesting(false)
    }
  }

  const usesPlatformFallback = llmSource === "platform" || embeddingSource === "platform"
  const normalizedLlmBaseUrl = llmBaseUrl.replace(/\/$/, "")
  const activeLlmPlan =
    normalizedLlmBaseUrl === OPENCODE_GO_BASE_URL
      ? "Go"
      : normalizedLlmBaseUrl === OPENCODE_ZEN_BASE_URL
        ? "Zen"
        : "API"

  return (
    <Drawer direction="right" open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="data-[vaul-drawer-direction=right]:w-[min(720px,100vw)] data-[vaul-drawer-direction=right]:sm:max-w-none">
        <DrawerHeader>
          <DrawerTitle>Project AI keys</DrawerTitle>
          <DrawerDescription>
            {project
              ? `Manage encrypted credentials for ${project.name}. Keys are scoped to this project and never returned in full after save.`
              : "Select a project to manage AI credentials."}
          </DrawerDescription>
        </DrawerHeader>

        <ScrollArea className="min-h-0 flex-1 px-6 pb-4">
          <div className="flex flex-col gap-4 pr-3">
            <Alert>
              <ShieldCheck data-icon="inline-start" />
              <AlertTitle>Security-first credentials</AlertTitle>
              <AlertDescription>
                API keys are encrypted at rest, masked in the UI, and only used server-side for this project. Choose
                &quot;This project&quot; so operators never depend on server environment files.
              </AlertDescription>
            </Alert>

            {usesPlatformFallback && (
              <Alert variant="destructive">
                <AlertTitle>Platform fallback is active</AlertTitle>
                <AlertDescription>
                  One or more tabs still use platform defaults from server env. Switch to &quot;This project&quot; and save
                  your OpenCode key here for full UI control.
                </AlertDescription>
              </Alert>
            )}

            {error && <AlertCallout title="Could not load project AI settings" description={error} variant="destructive" />}
            {loading && (
              <Alert>
                <AlertTitle>Loading project AI configuration</AlertTitle>
                <AlertDescription>Fetching LLM and embedding settings for this project.</AlertDescription>
              </Alert>
            )}

            {!loading && config && (
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="w-full">
                  <TabsTrigger value="llm">
                    <Bot data-icon="inline-start" />
                    LLM answers
                  </TabsTrigger>
                  <TabsTrigger value="embedding">
                    <Sparkles data-icon="inline-start" />
                    Embeddings
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="llm" className="mt-4 flex flex-col gap-4">
                  <div className="rounded-xl border bg-muted/30 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={config.llm.apiKeyConfigured ? "secondary" : "outline"}>
                        {config.llm.apiKeyConfigured ? "Key configured" : "No key"}
                      </Badge>
                      {config.llm.apiKeyMasked && <Badge variant="outline">{config.llm.apiKeyMasked}</Badge>}
                      <Badge variant="outline">{config.llm.effectiveModel}</Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Powers grounded chat answers. Use your OpenCode Go or Zen API key — match the preset plan to your subscription.
                    </p>
                  </div>

                  <FieldGroup>
                    <Field>
                      <FieldLabel>Credential source</FieldLabel>
                      <ToggleGroup
                        className="w-full"
                        spacing={0}
                        value={[llmSource]}
                        variant="outline"
                        onValueChange={(values) => {
                          const next = values[0] as ProjectAiSource | undefined
                          if (next) setLlmSource(next)
                        }}
                      >
                        <ToggleGroupItem className="flex-1" value="project">This project</ToggleGroupItem>
                        <ToggleGroupItem className="flex-1" value="platform">Platform default</ToggleGroupItem>
                      </ToggleGroup>
                    </Field>

                    {llmSource === "project" && (
                      <>
                        <Field>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <FieldLabel>OpenCode model preset</FieldLabel>
                            <Button disabled={modelsLoading} size="sm" variant="outline" onClick={() => void loadOpenCodeModels(true)}>
                              {modelsLoading ? <Spinner data-icon="inline-start" /> : <RefreshCw data-icon="inline-start" />}
                              Refresh models
                            </Button>
                          </div>
                          {modelsError && (
                            <p className="text-sm text-destructive">{modelsError}</p>
                          )}
                          <div className="flex flex-col gap-5">
                            <LlmPresetSection
                              catalog={goCatalog}
                              description="Low-cost subscription ($10/mo). List auto-syncs from opencode.ai/zen/go/v1/models."
                              loading={modelsLoading && !goCatalog}
                              selectedBaseUrl={llmBaseUrl}
                              selectedModel={llmModel}
                              title="OpenCode Go"
                              onSelect={applyLlmPreset}
                            />
                            <Separator />
                            <LlmPresetSection
                              catalog={zenCatalog}
                              description="Pay-as-you-go curated models. List auto-syncs from opencode.ai/zen/v1/models."
                              loading={modelsLoading && !zenCatalog}
                              selectedBaseUrl={llmBaseUrl}
                              selectedModel={llmModel}
                              title="OpenCode Zen"
                              onSelect={applyLlmPreset}
                            />
                          </div>
                          <FieldDescription>
                            New Go models appear automatically after OpenCode publishes them. Models that use /messages instead of chat/completions are hidden.
                          </FieldDescription>
                        </Field>

                        <Field>
                          <FieldLabel>OpenCode {activeLlmPlan} API key</FieldLabel>
                          <Input
                            autoComplete="off"
                            type="password"
                            placeholder={
                              config.llm.apiKeyConfigured
                                ? "Leave blank to keep saved key"
                                : `Paste OpenCode ${activeLlmPlan} key`
                            }
                            value={llmApiKey}
                            onChange={(event) => setLlmApiKey(event.target.value)}
                          />
                          <FieldDescription>
                            <Lock data-icon="inline-start" />
                            Encrypted before storage. Go and Zen keys are different subscriptions — use the key that matches your preset.
                          </FieldDescription>
                        </Field>
                        <Field>
                          <FieldLabel>Base URL</FieldLabel>
                          <Input
                            placeholder={OPENCODE_GO_BASE_URL}
                            value={llmBaseUrl}
                            onChange={(event) => setLlmBaseUrl(event.target.value)}
                          />
                          <FieldDescription>
                            Go: {OPENCODE_GO_BASE_URL} · Zen: {OPENCODE_ZEN_BASE_URL}
                          </FieldDescription>
                        </Field>
                        <Field>
                          <FieldLabel>Model</FieldLabel>
                          <Input
                            placeholder={recommendedOpencodeLlmPreset.model}
                            value={llmModel}
                            onChange={(event) => setLlmModel(event.target.value)}
                          />
                        </Field>
                      </>
                    )}
                  </FieldGroup>

                  <Button disabled={llmTesting} variant="outline" onClick={() => void runLlmTest()}>
                    {llmTesting ? <Spinner data-icon="inline-start" /> : <Bot data-icon="inline-start" />}
                    Test LLM key
                  </Button>
                  {llmTestResult && (
                    <Alert>
                      <AlertTitle>LLM test passed in {llmTestResult.latencyMs} ms</AlertTitle>
                      <AlertDescription>{llmTestResult.answerPreview}</AlertDescription>
                    </Alert>
                  )}
                </TabsContent>

                <TabsContent value="embedding" className="mt-4 flex flex-col gap-4">
                  <div className="rounded-xl border bg-muted/30 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={config.embedding.status === "ok" ? "secondary" : "destructive"}>
                        {config.embedding.status}
                      </Badge>
                      <Badge variant="outline">{config.embedding.provider}</Badge>
                      <Badge variant="outline">{config.embedding.dimension} dimensions</Badge>
                      {config.embedding.apiKeyMasked && <Badge variant="outline">{config.embedding.apiKeyMasked}</Badge>}
                    </div>
                    {config.embedding.detail && (
                      <p className="mt-2 text-sm text-muted-foreground">{config.embedding.detail}</p>
                    )}
                    {config.embedding.probe && !config.embedding.probe.ok && (
                      <p className="mt-2 text-sm text-destructive">{config.embedding.probe.detail}</p>
                    )}
                    {config.embedding.requiresReindex && (
                      <p className="mt-2 text-sm text-amber-600">
                        Embedding settings changed. Reindex published knowledge before connecting or testing this chatbot.
                      </p>
                    )}
                    <p className="mt-2 text-sm text-muted-foreground">
                      Vectorizes knowledge for RAG search. OpenCode Zen covers chat only — use a separate hosted embeddings
                      API here (typically OpenAI-compatible).
                    </p>
                  </div>

                  <FieldGroup>
                    <Field>
                      <FieldLabel>Credential source</FieldLabel>
                      <ToggleGroup
                        className="w-full"
                        spacing={0}
                        value={[embeddingSource]}
                        variant="outline"
                        onValueChange={(values) => {
                          const next = values[0] as ProjectAiSource | undefined
                          if (next) setEmbeddingSource(next)
                        }}
                      >
                        <ToggleGroupItem className="flex-1" value="project">This project</ToggleGroupItem>
                        <ToggleGroupItem className="flex-1" value="platform">Platform default</ToggleGroupItem>
                      </ToggleGroup>
                    </Field>

                    {embeddingSource === "project" && (
                      <>
                        <Field>
                          <FieldLabel>Embedding provider</FieldLabel>
                          <ToggleGroup
                            className="w-full flex-wrap"
                            spacing={0}
                            value={[embeddingProvider]}
                            variant="outline"
                            onValueChange={(values) => {
                              const next = values[0] as EmbeddingProviderMode | undefined
                              if (next) {
                                setEmbeddingProvider(next)
                                if (next === "local" && !localEmbeddingModelPresets.some((preset) => preset.model === embeddingModel)) {
                                  setEmbeddingModel(recommendedLocalEmbeddingModel)
                                }
                              }
                            }}
                          >
                            {embeddingProviderOptions.map((option) => {
                              const Icon = option.icon
                              return (
                                <ToggleGroupItem key={option.id} className="min-w-[8rem] flex-1" value={option.id}>
                                  <Icon data-icon="inline-start" />
                                  {option.label}
                                </ToggleGroupItem>
                              )
                            })}
                          </ToggleGroup>
                        </Field>

                        {embeddingProvider === "openai" && (
                          <>
                            <Field>
                              <FieldLabel>Embedding preset</FieldLabel>
                              <div className="grid gap-3 sm:grid-cols-1">
                                {openAiCompatibleEmbeddingPresets.map((preset) => {
                                  const selected = embeddingModel === preset.model && embeddingBaseUrl === preset.baseUrl
                                  return (
                                    <button
                                      key={preset.id}
                                      type="button"
                                      className={cn(
                                        "rounded-lg border p-4 text-left transition-colors",
                                        selected ? "border-primary bg-primary/10" : "border-border bg-background hover:bg-muted",
                                      )}
                                      onClick={() => applyEmbeddingPreset(preset.model, preset.baseUrl)}
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="font-medium">{preset.label}</span>
                                        {preset.recommended && <Badge variant="secondary">Recommended</Badge>}
                                      </div>
                                      <p className="mt-2 text-sm text-muted-foreground">{preset.summary}</p>
                                    </button>
                                  )
                                })}
                              </div>
                            </Field>

                            <Field>
                              <FieldLabel>Embeddings API key</FieldLabel>
                              <Input
                                autoComplete="off"
                                type="password"
                                placeholder={config.embedding.apiKeyConfigured ? "Leave blank to keep saved key" : "sk-..."}
                                value={embeddingApiKey}
                                onChange={(event) => setEmbeddingApiKey(event.target.value)}
                              />
                              <FieldDescription>
                                <Lock data-icon="inline-start" />
                                Separate from the LLM key. Encrypted at rest and used only to index this project&apos;s knowledge.
                              </FieldDescription>
                            </Field>

                            <Field>
                              <FieldLabel>Embeddings base URL</FieldLabel>
                              <Input
                                placeholder={OPENAI_COMPATIBLE_EMBEDDINGS_BASE_URL}
                                value={embeddingBaseUrl}
                                onChange={(event) => setEmbeddingBaseUrl(event.target.value)}
                              />
                              <FieldDescription>
                                OpenAI-compatible `/v1/embeddings` endpoint. Not the OpenCode Zen chat URL.
                              </FieldDescription>
                            </Field>

                            <Field>
                              <FieldLabel>Model</FieldLabel>
                              <Input
                                placeholder={recommendedEmbeddingPreset.model}
                                value={embeddingModel}
                                onChange={(event) => setEmbeddingModel(event.target.value)}
                              />
                            </Field>
                          </>
                        )}

                        {embeddingProvider === "local" && (
                          <>
                            <Field>
                              <FieldLabel>Embedding preset</FieldLabel>
                              <div className="grid gap-3 sm:grid-cols-2">
                                {localEmbeddingModelPresets.map((preset) => {
                                  const selected = embeddingModel === preset.model
                                  return (
                                    <button
                                      key={preset.id}
                                      type="button"
                                      className={cn(
                                        "rounded-lg border p-4 text-left transition-colors",
                                        selected ? "border-primary bg-primary/10" : "border-border bg-background hover:bg-muted",
                                      )}
                                      onClick={() => setEmbeddingModel(preset.model)}
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="font-medium">{preset.label}</span>
                                        {preset.recommended && <Badge variant="secondary">Recommended</Badge>}
                                      </div>
                                      <p className="mt-2 text-sm text-muted-foreground">{preset.summary}</p>
                                      <div className="mt-3 flex flex-wrap gap-2">
                                        <Badge variant="outline">{preset.dimension} dimensions</Badge>
                                        <Badge variant="outline">{preset.model}</Badge>
                                      </div>
                                    </button>
                                  )
                                })}
                              </div>
                              <FieldDescription>
                                Changing preset clears old vectors and requires published knowledge to be reindexed.
                              </FieldDescription>
                            </Field>

                            <Field>
                              <FieldLabel>Embedder URL</FieldLabel>
                              <Input
                                placeholder="http://rag-embedder:8080"
                                value={embedderUrl}
                                onChange={(event) => setEmbedderUrl(event.target.value)}
                              />
                            </Field>
                          </>
                        )}
                      </>
                    )}
                  </FieldGroup>

                  <Button disabled={embeddingTesting} variant="outline" onClick={() => void runEmbeddingTest()}>
                    {embeddingTesting ? <Spinner data-icon="inline-start" /> : <Sparkles data-icon="inline-start" />}
                    Test embedding key
                  </Button>
                  {embeddingTestResult && (
                    <Alert>
                      <AlertTitle>Embedding test passed in {embeddingTestResult.latencyMs} ms</AlertTitle>
                      <AlertDescription>
                        {embeddingTestResult.model} returned [{embeddingTestResult.vectorPreview.join(", ")}…]
                      </AlertDescription>
                    </Alert>
                  )}
                </TabsContent>
              </Tabs>
            )}

            {testError && (
              <Alert variant="destructive">
                <AlertTitle>Smoke test failed</AlertTitle>
                <AlertDescription>{testError}</AlertDescription>
              </Alert>
            )}
          </div>
        </ScrollArea>

        <Separator />
        <DrawerFooter className="flex-row items-center justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button disabled={!config || saving || loading} onClick={() => void saveConfig()}>
            {saving ? <Spinner data-icon="inline-start" /> : <KeyRound data-icon="inline-start" />}
            Save project keys
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}