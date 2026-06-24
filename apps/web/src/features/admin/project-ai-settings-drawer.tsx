import {
  openAiCompatibleEmbeddingPresets,
  opencodeLlmPresets,
  OPENAI_COMPATIBLE_EMBEDDINGS_BASE_URL,
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
import { Spinner } from "@workspace/ui/components/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group"
import { cn } from "@workspace/ui/lib/utils"
import { Bot, Cloud, KeyRound, Lock, Server, ShieldCheck, Sparkles } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import { api, getErrorMessage } from "@/lib/api"
import { AlertCallout } from "./components"
import type {
  EmbeddingProviderMode,
  EmbeddingSmokeTestResult,
  Project,
  ProjectAiConfig,
  ProjectAiKeySummary,
  ProjectAiSource,
  ProjectLlmSmokeTestResult,
} from "./types"

const embeddingProviderOptions: Array<{ id: EmbeddingProviderMode; label: string; icon: typeof Cloud }> = [
  { id: "openai", label: "Hosted API", icon: Cloud },
  { id: "local", label: "Local BGE", icon: Server },
]

const recommendedLocalEmbeddingModel =
  localEmbeddingModelPresets.find((preset) => preset.recommended)?.model ?? "BAAI/bge-base-en-v1.5"

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
  const [llmBaseUrl, setLlmBaseUrl] = useState(OPENCODE_ZEN_BASE_URL)
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
    if (open && project) void loadConfig()
  }, [open, project, loadConfig])

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
                      Powers grounded chat answers. Use your OpenCode Zen key with the presets below.
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
                          <FieldLabel>OpenCode Zen preset</FieldLabel>
                          <div className="grid gap-3 sm:grid-cols-2">
                            {opencodeLlmPresets.map((preset) => {
                              const selected = llmModel === preset.model && llmBaseUrl === preset.baseUrl
                              return (
                                <button
                                  key={preset.id}
                                  type="button"
                                  className={cn(
                                    "rounded-lg border p-4 text-left transition-colors",
                                    selected ? "border-primary bg-primary/10" : "border-border bg-background hover:bg-muted",
                                  )}
                                  onClick={() => applyLlmPreset(preset.model, preset.baseUrl)}
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
                        </Field>

                        <Field>
                          <FieldLabel>OpenCode API key</FieldLabel>
                          <Input
                            autoComplete="off"
                            type="password"
                            placeholder={config.llm.apiKeyConfigured ? "Leave blank to keep saved key" : "Paste OpenCode Zen key"}
                            value={llmApiKey}
                            onChange={(event) => setLlmApiKey(event.target.value)}
                          />
                          <FieldDescription>
                            <Lock data-icon="inline-start" />
                            Encrypted before storage. Used only for chat answers in this project.
                          </FieldDescription>
                        </Field>
                        <Field>
                          <FieldLabel>Base URL</FieldLabel>
                          <Input
                            placeholder={OPENCODE_ZEN_BASE_URL}
                            value={llmBaseUrl}
                            onChange={(event) => setLlmBaseUrl(event.target.value)}
                          />
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