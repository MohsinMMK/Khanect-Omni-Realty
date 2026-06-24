import {
  OPENCODE_GO_BASE_URL,
  OPENCODE_ZEN_BASE_URL,
  recommendedOpencodeLlmPreset,
} from "@workspace/core/ai-provider-catalog"
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@workspace/ui/components/command"
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@workspace/ui/components/drawer"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@workspace/ui/components/input-group"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import { Spinner } from "@workspace/ui/components/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip"
import { Bot, Check, ChevronsUpDown, Copy, RefreshCw, Server, ShieldCheck, Sparkles } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import { api, getErrorMessage } from "@/lib/api"
import { AlertCallout } from "./components"
import type {
  OpenCodeModelCatalog,
  Project,
  ProjectAiConfig,
  ProjectAiKeySummary,
  ProjectLlmSmokeTestResult,
} from "./types"

type OpenCodeModelPlan = "opencode-go" | "opencode-zen"

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

  const [llmApiKey, setLlmApiKey] = useState("")
  const [llmKeyCopied, setLlmKeyCopied] = useState(false)
  const [llmBaseUrl, setLlmBaseUrl] = useState(recommendedOpencodeLlmPreset.baseUrl)
  const [llmModel, setLlmModel] = useState(recommendedOpencodeLlmPreset.model)
  const [modelPlan, setModelPlan] = useState<OpenCodeModelPlan>("opencode-go")
  const [modelPickerOpen, setModelPickerOpen] = useState(false)

  const [llmTesting, setLlmTesting] = useState(false)
  const [llmTestResult, setLlmTestResult] = useState<ProjectLlmSmokeTestResult | null>(null)
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
    const nextBaseUrl = next.llm.baseUrl ?? recommendedOpencodeLlmPreset.baseUrl
    setLlmApiKey("")
    setLlmKeyCopied(false)
    setLlmBaseUrl(nextBaseUrl)
    setLlmModel(next.llm.model ?? recommendedOpencodeLlmPreset.model)
    setModelPlan(nextBaseUrl.replace(/\/$/, "") === OPENCODE_ZEN_BASE_URL ? "opencode-zen" : "opencode-go")
    setLlmTestResult(null)
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

  async function saveConfig() {
    if (!project) return
    setSaving(true)
    setError("")
    try {
      const response = await api<{ config: ProjectAiConfig }>(`/admin/projects/${project.id}/ai-config`, {
        method: "PATCH",
        body: {
          llm: {
            source: "project",
            ...(llmApiKey.trim() ? { apiKey: llmApiKey.trim() } : {}),
            baseUrl: llmBaseUrl.trim() || null,
            model: llmModel.trim() || null,
          },
          embedding: { source: "platform" },
        },
      })
      setConfig(response.config)
      resetForm(response.config)
      onSaved?.(project.id, {
        llmSource: "project",
        embeddingSource: "platform",
      })
    } catch (apiError) {
      setError(getErrorMessage(apiError))
    } finally {
      setSaving(false)
    }
  }

  async function copyLlmApiKey() {
    const value = llmApiKey.trim()
    if (!value || typeof navigator === "undefined" || !navigator.clipboard) return

    try {
      await navigator.clipboard.writeText(value)
      setLlmKeyCopied(true)
      window.setTimeout(() => setLlmKeyCopied(false), 1500)
    } catch {
      setLlmKeyCopied(false)
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

  const goModelOptions = goCatalog?.models.filter((entry) => entry.supported) ?? []
  const zenModelOptions = zenCatalog?.models.filter((entry) => entry.supported) ?? []
  const activeModelOptions = modelPlan === "opencode-go" ? goModelOptions : zenModelOptions
  const activeModelCatalog = modelPlan === "opencode-go" ? goCatalog : zenCatalog
  const activeLlmPlan = modelPlan === "opencode-go" ? "Go" : "Zen"
  const selectedModelOption = activeModelOptions.find((entry) => entry.model === llmModel)
  const embeddingReady = config?.embedding.provider === "local" && config.embedding.status === "ok" && config.embedding.probe?.ok !== false

  function selectModelPlan(nextPlan: string) {
    const plan = nextPlan === "opencode-zen" ? "opencode-zen" : "opencode-go"
    const options = plan === "opencode-go" ? goModelOptions : zenModelOptions
    const fallbackBaseUrl = plan === "opencode-go" ? OPENCODE_GO_BASE_URL : OPENCODE_ZEN_BASE_URL
    const nextModel =
      options.find((entry) => entry.model === llmModel) ?? options.find((entry) => entry.recommended) ?? options[0]

    setModelPlan(plan)
    setModelPickerOpen(false)
    if (nextModel) {
      applyLlmPreset(nextModel.model, nextModel.baseUrl)
    } else {
      setLlmBaseUrl(fallbackBaseUrl)
    }
  }

  return (
    <Drawer direction="right" open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="data-[vaul-drawer-direction=right]:w-[min(540px,100vw)] data-[vaul-drawer-direction=right]:sm:max-w-none">
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
              <AlertTitle>Project LLM key</AlertTitle>
              <AlertDescription>
                API keys are encrypted at rest, masked in the UI, and only used server-side for this project.
              </AlertDescription>
            </Alert>

            {error && <AlertCallout title="Could not load project AI settings" description={error} variant="destructive" />}
            {loading && (
              <Alert>
                <AlertTitle>Loading project AI configuration</AlertTitle>
                <AlertDescription>Fetching LLM settings and the enforced embedding runtime for this project.</AlertDescription>
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
                  <FieldGroup>
                    <Field>
                      <FieldLabel>OpenCode model preset</FieldLabel>
                      {modelsError && <p className="text-sm text-destructive">{modelsError}</p>}
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2">
                          <Tabs className="min-w-0 flex-1" value={modelPlan} onValueChange={selectModelPlan}>
                            <TabsList className="w-full">
                              <TabsTrigger value="opencode-go">Go</TabsTrigger>
                              <TabsTrigger value="opencode-zen">Zen</TabsTrigger>
                            </TabsList>
                          </Tabs>
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <Button
                                  aria-label="Refresh models"
                                  disabled={modelsLoading}
                                  size="icon-sm"
                                  variant="outline"
                                  onClick={() => void loadOpenCodeModels(true)}
                                />
                              }
                            >
                              {modelsLoading ? <Spinner data-icon="inline-start" /> : <RefreshCw data-icon="inline-start" />}
                            </TooltipTrigger>
                            <TooltipContent>Refresh models</TooltipContent>
                          </Tooltip>
                        </div>

                        <div className="flex flex-col gap-2">
                          <Button
                            aria-expanded={modelPickerOpen}
                            aria-label="OpenCode model"
                            className="w-full justify-between"
                            disabled={modelsLoading || activeModelOptions.length === 0}
                            role="combobox"
                            type="button"
                            variant="outline"
                            onClick={() => setModelPickerOpen((current) => !current)}
                          >
                            <span className="truncate">
                              {selectedModelOption?.label ?? (modelsLoading ? "Loading models..." : "Select a model")}
                            </span>
                            <ChevronsUpDown data-icon="inline-end" />
                          </Button>
                          {modelPickerOpen && (
                            <Command className="rounded-3xl border">
                              <CommandInput placeholder={`Search OpenCode ${activeLlmPlan} models...`} />
                              <CommandList>
                                <CommandEmpty>No models found.</CommandEmpty>
                                <CommandGroup>
                                  {activeModelOptions.map((preset) => (
                                    <CommandItem
                                      key={preset.id}
                                      data-checked={llmModel === preset.model}
                                      value={`${preset.label} ${preset.model}`}
                                      onPointerDown={(event) => {
                                        event.preventDefault()
                                        applyLlmPreset(preset.model, preset.baseUrl)
                                        setModelPickerOpen(false)
                                      }}
                                      onClick={() => {
                                        applyLlmPreset(preset.model, preset.baseUrl)
                                        setModelPickerOpen(false)
                                      }}
                                      onSelect={() => {
                                        applyLlmPreset(preset.model, preset.baseUrl)
                                        setModelPickerOpen(false)
                                      }}
                                    >
                                      <span className="truncate">{preset.label}</span>
                                      {preset.recommended && <Badge variant="secondary">Recommended</Badge>}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          )}
                        </div>

                        {!modelsLoading && activeModelOptions.length === 0 && (
                          <p className="text-sm text-muted-foreground">No supported {activeLlmPlan} models are available right now.</p>
                        )}
                        {activeModelCatalog?.source === "fallback" && activeModelCatalog.detail && (
                          <p className="text-xs text-amber-600">{activeModelCatalog.detail}</p>
                        )}
                      </div>
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="project-llm-api-key">OpenCode {activeLlmPlan} API key</FieldLabel>
                      <InputGroup>
                        <InputGroupInput
                          id="project-llm-api-key"
                          autoComplete="off"
                          type="password"
                          placeholder={
                            config.llm.apiKeyConfigured
                              ? "Leave blank to keep saved key"
                              : `Paste OpenCode ${activeLlmPlan} key`
                          }
                          value={llmApiKey}
                          onChange={(event) => {
                            setLlmApiKey(event.target.value)
                            setLlmKeyCopied(false)
                          }}
                        />
                        <InputGroupAddon align="inline-end">
                          <InputGroupButton
                            aria-label="Copy entered API key"
                            disabled={!llmApiKey.trim()}
                            size="icon-xs"
                            onClick={() => void copyLlmApiKey()}
                          >
                            {llmKeyCopied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
                          </InputGroupButton>
                        </InputGroupAddon>
                      </InputGroup>
                      <FieldDescription>Your API key is encrypted and stored securely.</FieldDescription>
                    </Field>
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
                  <Alert variant={embeddingReady ? "default" : "destructive"}>
                    <Server data-icon="inline-start" />
                    <AlertTitle>Local BGE embedder</AlertTitle>
                    <AlertDescription className="flex flex-col gap-2">
                      <span>Enforced embedding runtime for local development, local-prod, and VPS production.</span>
                      <span>
                        {config.embedding.model ?? "Unknown model"} - {config.embedding.dimension} dimensions -{" "}
                        {config.embedding.embedderUrl ?? "embedder URL missing"}
                      </span>
                      {config.embedding.detail && <span>{config.embedding.detail}</span>}
                      {config.embedding.probe?.detail && <span>{config.embedding.probe.detail}</span>}
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={embeddingReady ? "secondary" : "outline"}>{config.embedding.provider}</Badge>
                        <Badge variant={embeddingReady ? "secondary" : "outline"}>{config.embedding.status}</Badge>
                        <Badge variant="outline">{config.embedding.dimension}d</Badge>
                      </div>
                    </AlertDescription>
                  </Alert>
                  <div className="rounded-xl border bg-muted/30 p-4">
                    <p className="text-sm font-medium">Enforced embedding runtime</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Project operators edit only LLM keys here. Knowledge chunking remains local deterministic text splitting, and vector creation always uses the managed BGE embedder.
                    </p>
                  </div>
                  <Button disabled={loading} variant="outline" onClick={() => void loadConfig()}>
                    <RefreshCw data-icon="inline-start" />
                    Refresh runtime status
                  </Button>
                </TabsContent>
              </Tabs>
            )}

            {testError && <AlertCallout title="AI test failed" description={testError} variant="destructive" />}
          </div>
        </ScrollArea>

        <DrawerFooter>
          <Button disabled={saving || loading || !llmBaseUrl.trim() || !llmModel.trim()} onClick={() => void saveConfig()}>
            {saving ? <Spinner data-icon="inline-start" /> : <ShieldCheck data-icon="inline-start" />}
            Save project key
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
