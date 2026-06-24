import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@workspace/ui/components/drawer"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@workspace/ui/components/hover-card"
import { Input } from "@workspace/ui/components/input"
import { Separator } from "@workspace/ui/components/separator"
import { Textarea } from "@workspace/ui/components/textarea"

import { cn } from "@workspace/ui/lib/utils"
import { recommendedOpencodeLlmPreset } from "@workspace/core/ai-provider-catalog"
import {
  Archive,
  ArchiveRestore,
  Building2,
  CircleHelp,
  FilePlus2,
  KeyRound,
  MoreHorizontal,
  Plus,
  SendHorizontal,
  Server,
  Trash2,
  Upload,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { api, getErrorMessage } from "@/lib/api"
import { capabilityOptions, capabilityPayload } from "@/lib/capabilities"
import { extractDocumentUpload, supportedDocumentUploadAccept } from "@/lib/content-helpers"
import { AlertCallout } from "./components"
import { newBotSteps } from "./constants"
import { ProjectAiKeyBadges } from "./project-ai-key-badges"
import { ProjectAiSettingsDrawer } from "./project-ai-settings-drawer"
import type {
  Chatbot,
  ChatAnswer,
  ContentItem,
  EmbeddingAdminStatus,
  NewBotStepKey,
  Project,
  ProjectAiKeySummary,
} from "./types"

export function ProjectsView(props: {
  projects: Project[]
  chatbots: Chatbot[]
  selectedProjectId: string
  selectedChatbotId: string
  onProjectChange: (id: string) => void
  onChatbotChange: (id: string) => void
  onCreated: (project: Project, chatbot: Chatbot) => void
  onChatbotCreated: (chatbot: Chatbot) => void
  onProjectUpdated: (project: Project) => void
  onProjectAiKeysUpdated: (
    projectId: string,
    aiKeys: ProjectAiKeySummary
  ) => void
  onProjectDeleted: (projectId: string) => void
  onStart: (projectId: string) => void
}) {
  const selectedChatbot = props.chatbots.find(
    (chatbot) => chatbot.id === props.selectedChatbotId
  )
  const [projectActionId, setProjectActionId] = useState<string | null>(null)
  const [projectActionError, setProjectActionError] = useState("")
  const [confirmingProjectAction, setConfirmingProjectAction] = useState<{
    type: "archive" | "unarchive" | "delete"
    project: Project
  } | null>(null)
  const [aiSettingsProject, setAiSettingsProject] = useState<Project | null>(
    null
  )

  async function archiveProject(project: Project) {
    setProjectActionId(project.id)
    setProjectActionError("")
    try {
      const response = await api<{ project: Project }>(
        `/admin/projects/${project.id}/archive`,
        { method: "POST" }
      )
      props.onProjectUpdated(response.project)
      setConfirmingProjectAction(null)
    } catch (apiError) {
      setProjectActionError(getErrorMessage(apiError))
    } finally {
      setProjectActionId(null)
    }
  }

  async function unarchiveProject(project: Project) {
    setProjectActionId(project.id)
    setProjectActionError("")
    try {
      const response = await api<{ project: Project }>(
        `/admin/projects/${project.id}/unarchive`,
        { method: "POST" }
      )
      props.onProjectUpdated(response.project)
      setConfirmingProjectAction(null)
    } catch (apiError) {
      setProjectActionError(getErrorMessage(apiError))
    } finally {
      setProjectActionId(null)
    }
  }

  async function deleteProject(project: Project) {
    setProjectActionId(project.id)
    setProjectActionError("")
    try {
      await api<{ project: Project }>(`/admin/projects/${project.id}`, {
        method: "DELETE",
      })
      props.onProjectDeleted(project.id)
      setConfirmingProjectAction(null)
    } catch (apiError) {
      setProjectActionError(getErrorMessage(apiError))
    } finally {
      setProjectActionId(null)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-heading text-base font-medium">Projects</h2>
        {props.projects.length > 0 && (
          <CreateWorkspaceButton onCreated={props.onCreated} />
        )}
      </div>

      <div className="grid gap-5">
        {projectActionError && (
          <AlertCallout
            title="Project action failed"
            description={projectActionError}
            variant="destructive"
          />
        )}
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {props.projects.length === 0 && (
            <Empty className="min-h-[calc(100vh-14rem)] border-0 bg-transparent p-0 md:col-span-2 xl:col-span-3">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Building2 aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle>No Omni Realty projects yet</EmptyTitle>
                <EmptyDescription>
                  Create a real estate project to connect a website domain,
                  launch a chatbot, and organize approved property knowledge for
                  visitors.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <CreateWorkspaceButton
                  onCreated={props.onCreated}
                  variant="default"
                />
              </EmptyContent>
            </Empty>
          )}
          {props.projects.map((project) => {
            const isSelected = project.id === props.selectedProjectId
            const isArchived = project.status === "archived"
            return (
              <Card
                key={project.id}
                className={cn(
                  "border shadow-none",
                  isSelected && "border-primary"
                )}
                size="sm"
              >
                <CardHeader>
                  <CardTitle className="truncate">{project.name}</CardTitle>
                  <CardDescription className="truncate">
                    {project.domain ?? "Domain not added yet"}
                  </CardDescription>
                  <CardAction className="flex items-center gap-1">
                    <Badge variant={isArchived ? "outline" : "secondary"}>
                      {project.status}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            aria-label={`${project.name} actions`}
                            size="icon-sm"
                            variant="ghost"
                          />
                        }
                      >
                        <MoreHorizontal data-icon="inline-start" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuGroup>
                          <DropdownMenuItem
                            onClick={() => setAiSettingsProject(project)}
                          >
                            <KeyRound data-icon="inline-start" />
                            AI keys
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                          {isArchived ? (
                            <DropdownMenuItem
                              disabled={projectActionId === project.id}
                              onClick={() =>
                                setConfirmingProjectAction({
                                  type: "unarchive",
                                  project,
                                })
                              }
                            >
                              <ArchiveRestore data-icon="inline-start" />
                              Unarchive project
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              disabled={projectActionId === project.id}
                              onClick={() =>
                                setConfirmingProjectAction({
                                  type: "archive",
                                  project,
                                })
                              }
                            >
                              <Archive data-icon="inline-start" />
                              Archive project
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                          <DropdownMenuItem
                            disabled={
                              !isArchived || projectActionId === project.id
                            }
                            variant="destructive"
                            onClick={() =>
                              setConfirmingProjectAction({
                                type: "delete",
                                project,
                              })
                            }
                          >
                            <Trash2 data-icon="inline-start" />
                            Delete project
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </CardAction>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <ProjectAiKeyBadges
                    aiKeys={
                      project.aiKeys ?? {
                        llmSource: "platform",
                        embeddingSource: "platform",
                      }
                    }
                  />
                  <div className="text-sm text-muted-foreground">
                    {isArchived
                      ? "Archived project. Delete is available from the actions menu."
                      : isSelected
                        ? selectedChatbot
                          ? `Assistant: ${selectedChatbot.name}`
                          : "Create a chatbot to start adding content."
                        : "Select this project to manage its assistant."}
                  </div>
                </CardContent>
                <Separator />
                <CardFooter className="gap-2">
                  {!isSelected && (
                    <Button
                      className="flex-1"
                      size="sm"
                      variant="outline"
                      onClick={() => props.onProjectChange(project.id)}
                    >
                      Select project
                    </Button>
                  )}
                  {isSelected && selectedChatbot && (
                    <Button
                      className="flex-1"
                      disabled={isArchived}
                      size="sm"
                      variant="outline"
                      onClick={() => props.onStart(project.id)}
                    >
                      <SendHorizontal data-icon="inline-start" />
                      Open content
                    </Button>
                  )}
                  {isSelected && (
                    <CreateChatbotButton
                      className="flex-1"
                      disabled={!props.selectedProjectId || isArchived}
                      label={selectedChatbot ? "New chatbot" : "Create chatbot"}
                      projectId={props.selectedProjectId}
                      size="sm"
                      onCreated={props.onChatbotCreated}
                    />
                  )}
                </CardFooter>
              </Card>
            )
          })}
        </section>
      </div>

      <ProjectAiSettingsDrawer
        open={Boolean(aiSettingsProject)}
        project={aiSettingsProject}
        onOpenChange={(open) => {
          if (!open) setAiSettingsProject(null)
        }}
        onSaved={(projectId, aiKeys) => {
          props.onProjectAiKeysUpdated(projectId, aiKeys)
        }}
      />

      <AlertDialog
        open={Boolean(confirmingProjectAction)}
        onOpenChange={(open) => {
          if (!open) setConfirmingProjectAction(null)
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmingProjectAction?.type === "delete"
                ? "Delete project?"
                : confirmingProjectAction?.type === "unarchive"
                  ? "Unarchive project?"
                  : "Archive project?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmingProjectAction?.type === "delete"
                ? `This permanently deletes "${confirmingProjectAction.project.name}" and its chatbots. Projects must be archived before deletion.`
                : confirmingProjectAction?.type === "unarchive"
                  ? `Unarchive "${confirmingProjectAction.project.name}" to open its content and create chatbots again.`
                  : `Archive "${confirmingProjectAction?.project.name}" before deletion. Archived projects cannot open content or create new chatbots.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {confirmingProjectAction?.type === "delete" ? (
              <AlertDialogAction
                disabled={
                  !confirmingProjectAction ||
                  projectActionId === confirmingProjectAction.project.id
                }
                variant="destructive"
                onClick={() => {
                  if (confirmingProjectAction)
                    void deleteProject(confirmingProjectAction.project)
                }}
              >
                Delete project
              </AlertDialogAction>
            ) : confirmingProjectAction?.type === "unarchive" ? (
              <AlertDialogAction
                disabled={
                  !confirmingProjectAction ||
                  projectActionId === confirmingProjectAction.project.id
                }
                onClick={() => {
                  if (confirmingProjectAction)
                    void unarchiveProject(confirmingProjectAction.project)
                }}
              >
                Unarchive project
              </AlertDialogAction>
            ) : (
              <AlertDialogAction
                disabled={
                  !confirmingProjectAction ||
                  projectActionId === confirmingProjectAction.project.id
                }
                onClick={() => {
                  if (confirmingProjectAction)
                    void archiveProject(confirmingProjectAction.project)
                }}
              >
                Archive project
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function CreateWorkspaceButton({
  onCreated,
  variant = "outline",
}: {
  onCreated: (project: Project, chatbot: Chatbot) => void
  variant?: "default" | "outline"
}) {
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false)
  const [projectName, setProjectName] = useState("")
  const [domain, setDomain] = useState("")
  const [chatbotName, setChatbotName] = useState("Website assistant")
  const [purpose, setPurpose] = useState(
    "Answer FAQs, qualify leads, and prepare bookings"
  )
  const [capabilities, setCapabilities] = useState(["faq", "leadCapture"])
  const [llmApiKey, setLlmApiKey] = useState("")
  const [llmBaseUrl, setLlmBaseUrl] = useState(
    recommendedOpencodeLlmPreset.baseUrl
  )
  const [llmModel, setLlmModel] = useState(recommendedOpencodeLlmPreset.model)
  const [embeddingStatus, setEmbeddingStatus] =
    useState<EmbeddingAdminStatus | null>(null)
  const [embeddingLoading, setEmbeddingLoading] = useState(false)
  const [error, setError] = useState("")
  const embeddingReady =
    embeddingStatus?.provider === "local" &&
    embeddingStatus.configured &&
    embeddingStatus.status === "ok" &&
    embeddingStatus.model !== "stub/hash-v1" &&
    embeddingStatus.probe?.ok !== false

  useEffect(() => {
    if (!open) return

    let cancelled = false
    async function loadEmbeddingRuntime() {
      setEmbeddingLoading(true)
      setError("")
      try {
        const response =
          await api<EmbeddingAdminStatus>("/admin/ai/embedding")
        if (!cancelled) setEmbeddingStatus(response)
      } catch (apiError) {
        if (!cancelled) {
          setEmbeddingStatus(null)
          setError(getErrorMessage(apiError))
        }
      } finally {
        if (!cancelled) setEmbeddingLoading(false)
      }
    }

    void loadEmbeddingRuntime()
    return () => {
      cancelled = true
    }
  }, [open])

  async function createWorkspace() {
    setSaving(true)
    setError("")
    try {
      const projectResponse = await api<{ project: Project }>(
        "/admin/projects",
        {
          method: "POST",
          body: { name: projectName.trim(), domain: domain.trim() || null },
        }
      )
      await api<{ config: unknown }>(
        `/admin/projects/${projectResponse.project.id}/ai-config`,
        {
          method: "PATCH",
          body: {
            llm: {
              source: "project",
              apiKey: llmApiKey.trim(),
              baseUrl: llmBaseUrl.trim(),
              model: llmModel.trim(),
            },
            embedding: { source: "platform" },
          },
        }
      )
      const chatbotResponse = await api<{ chatbot: Chatbot }>(
        `/admin/projects/${projectResponse.project.id}/chatbots`,
        {
          method: "POST",
          body: {
            name: chatbotName.trim(),
            purpose: purpose.trim(),
            capabilities: capabilityPayload(capabilities),
          },
        }
      )
      onCreated(
        {
          ...projectResponse.project,
          aiKeys: { llmSource: "project", embeddingSource: "platform" },
        },
        chatbotResponse.chatbot
      )
      setOpen(false)
      setProjectName("")
      setDomain("")
      setChatbotName("Website assistant")
      setPurpose("Answer FAQs, qualify leads, and prepare bookings")
      setCapabilities(["faq", "leadCapture"])
      setLlmApiKey("")
      setLlmBaseUrl(recommendedOpencodeLlmPreset.baseUrl)
      setLlmModel(recommendedOpencodeLlmPreset.model)
    } catch (apiError) {
      setError(getErrorMessage(apiError))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)} disabled={saving}>
        <Plus data-icon="inline-start" />
        New project
      </Button>
      <Drawer direction="right" open={open} onOpenChange={setOpen}>
        <DrawerContent className="data-[vaul-drawer-direction=right]:w-[min(620px,100vw)] data-[vaul-drawer-direction=right]:sm:max-w-none">
          <DrawerHeader>
            <DrawerTitle>New business project</DrawerTitle>
            <DrawerDescription>
              Create the project and its first chatbot from the web app.
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 pb-4">
            {error && (
              <AlertCallout
                title="Request failed"
                description={error}
                variant="destructive"
              />
            )}
            <FieldGroup>
              <Field>
                <FieldLabel>Project name</FieldLabel>
                <Input
                  placeholder="Business name"
                  value={projectName}
                  onChange={(event) => setProjectName(event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel>Website domain</FieldLabel>
                <Input
                  placeholder="business.example"
                  value={domain}
                  onChange={(event) => setDomain(event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel>First chatbot name</FieldLabel>
                <Input
                  value={chatbotName}
                  onChange={(event) => setChatbotName(event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel>Purpose</FieldLabel>
                <Textarea
                  className="min-h-24"
                  value={purpose}
                  onChange={(event) => setPurpose(event.target.value)}
                />
              </Field>
              <CapabilityPicker
                value={capabilities}
                onChange={setCapabilities}
              />
              <div className="grid gap-4">
                <div>
                  <div className="text-sm font-medium">Project LLM key</div>
                  <p className="text-sm text-muted-foreground">
                    Saved before the first chatbot is created.
                  </p>
                </div>
                <Field>
                  <FieldLabel>LLM API key</FieldLabel>
                  <Input
                    autoComplete="off"
                    placeholder="sk-..."
                    type="password"
                    value={llmApiKey}
                    onChange={(event) => setLlmApiKey(event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel>LLM base URL</FieldLabel>
                  <Input
                    value={llmBaseUrl}
                    onChange={(event) => setLlmBaseUrl(event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel>LLM model</FieldLabel>
                  <Input
                    value={llmModel}
                    onChange={(event) => setLlmModel(event.target.value)}
                  />
                </Field>
              </div>
              <Alert variant={embeddingReady ? "default" : "destructive"}>
                <Server data-icon="inline-start" />
                <AlertTitle>Embedding runtime</AlertTitle>
                <AlertDescription className="flex flex-col gap-2">
                  {embeddingLoading
                    ? "Checking local BGE embedder health..."
                    : embeddingStatus
                      ? `${embeddingStatus.model} · ${embeddingStatus.dimension} dimensions · ${embeddingStatus.embedderUrl ?? "embedder URL missing"}`
                      : "Embedding runtime status is unavailable."}
                  {embeddingStatus?.detail && <span>{embeddingStatus.detail}</span>}
                  {embeddingStatus?.probe?.detail && (
                    <span>{embeddingStatus.probe.detail}</span>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={embeddingReady ? "secondary" : "outline"}>
                      {embeddingStatus?.provider ?? "unknown"}
                    </Badge>
                    <Badge variant={embeddingReady ? "secondary" : "outline"}>
                      {embeddingReady ? "healthy" : "not ready"}
                    </Badge>
                  </div>
                </AlertDescription>
              </Alert>
            </FieldGroup>
          </div>
          <DrawerFooter>
            <Button
              disabled={
                !projectName.trim() ||
                !chatbotName.trim() ||
                !llmApiKey.trim() ||
                !llmBaseUrl.trim() ||
                !llmModel.trim() ||
                !embeddingReady ||
                saving
              }
              onClick={createWorkspace}
            >
              {saving ? "Creating..." : "Create project"}
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  )
}

function CreateChatbotButton({
  className,
  disabled,
  label = "New chatbot",
  projectId,
  size = "default",
  onCreated,
}: {
  className?: string
  disabled: boolean
  label?: string
  projectId: string
  size?: "default" | "sm"
  onCreated: (chatbot: Chatbot) => void
}) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState("Website assistant")
  const [purpose, setPurpose] = useState(
    "Answer approved questions from website visitors"
  )
  const [capabilities, setCapabilities] = useState(["faq"])
  const [error, setError] = useState("")

  async function createChatbot() {
    setSaving(true)
    setError("")
    try {
      const response = await api<{ chatbot: Chatbot }>(
        `/admin/projects/${projectId}/chatbots`,
        {
          method: "POST",
          body: {
            name: name.trim(),
            purpose: purpose.trim(),
            capabilities: capabilityPayload(capabilities),
          },
        }
      )
      onCreated(response.chatbot)
      setOpen(false)
      setName("Website assistant")
      setPurpose("Answer approved questions from website visitors")
      setCapabilities(["faq"])
    } catch (apiError) {
      setError(getErrorMessage(apiError))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Button
        className={className}
        size={size}
        variant="outline"
        onClick={() => setOpen(true)}
        disabled={disabled || saving}
      >
        <FilePlus2 data-icon="inline-start" />
        {label}
      </Button>
      <Drawer direction="right" open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>New chatbot</DrawerTitle>
            <DrawerDescription>
              Add another chatbot to the selected business project.
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 pb-4">
            {error && (
              <AlertCallout
                title="Request failed"
                description={error}
                variant="destructive"
              />
            )}
            <FieldGroup>
              <Field>
                <FieldLabel>Chatbot name</FieldLabel>
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel>Purpose</FieldLabel>
                <Textarea
                  className="min-h-24"
                  value={purpose}
                  onChange={(event) => setPurpose(event.target.value)}
                />
              </Field>
              <CapabilityPicker
                value={capabilities}
                onChange={setCapabilities}
              />
            </FieldGroup>
          </div>
          <DrawerFooter>
            <Button disabled={!name.trim() || saving} onClick={createChatbot}>
              {saving ? "Creating..." : "Create chatbot"}
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  )
}

export function NewBotSetupButton({
  disabled,
  onCreated,
  onSetupChanged,
  projectId,
}: {
  disabled: boolean
  onCreated: (chatbot: Chatbot) => void
  onSetupChanged: (chatbotId: string) => void
  projectId: string
}) {
  const [open, setOpen] = useState(false)
  const [activeStep, setActiveStep] = useState<NewBotStepKey>("create")
  const [createdChatbot, setCreatedChatbot] = useState<Chatbot | null>(null)
  const [name, setName] = useState("")
  const [purpose, setPurpose] = useState("")
  const [capabilities, setCapabilities] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState("")
  const [uploadedTitles, setUploadedTitles] = useState<string[]>([])
  const [testMessage, setTestMessage] = useState(
    "What can this chatbot help with?"
  )
  const [testAnswer, setTestAnswer] = useState<ChatAnswer | null>(null)
  const newBotFileInputRef = useRef<HTMLInputElement | null>(null)
  const createdChatbotRef = useRef<Chatbot | null>(null)
  const createReady =
    name.trim().length > 0 &&
    purpose.trim().length > 0 &&
    capabilities.length > 0
  const botCreated = Boolean(createdChatbot)
  const knowledgeReady = botCreated || createReady
  const sourcesReady = uploadedTitles.length > 0
  const testReady = botCreated && sourcesReady
  const setupComplete = Boolean(testAnswer)
  const maxUnlockedStepIndex = setupComplete ? 2 : testReady ? 1 : 0
  const completedSteps = new Set<NewBotStepKey>([
    ...(sourcesReady ? (["create"] as NewBotStepKey[]) : []),
    ...(setupComplete ? (["test"] as NewBotStepKey[]) : []),
  ])

  function reset() {
    setActiveStep("create")
    setCreatedChatbot(null)
    createdChatbotRef.current = null
    setName("")
    setPurpose("")
    setCapabilities([])
    setSaving(false)
    setUploading(false)
    setTesting(false)
    setError("")
    setUploadedTitles([])
    setTestMessage("What can this chatbot help with?")
    setTestAnswer(null)
    if (newBotFileInputRef.current) newBotFileInputRef.current.value = ""
  }

  function closeSetup() {
    setOpen(false)
    reset()
  }

  async function createChatbot() {
    if (!projectId || !createReady) return null
    setSaving(true)
    setError("")
    try {
      const response = await api<{ chatbot: Chatbot }>(
        `/admin/projects/${projectId}/chatbots`,
        {
          method: "POST",
          body: {
            name: name.trim(),
            purpose: purpose.trim(),
            capabilities: capabilityPayload(capabilities),
          },
        }
      )
      setCreatedChatbot(response.chatbot)
      createdChatbotRef.current = response.chatbot
      onCreated(response.chatbot)
      setActiveStep("knowledge")
      return response.chatbot
    } catch (apiError) {
      setError(getErrorMessage(apiError))
      return null
    } finally {
      setSaving(false)
    }
  }

  async function getOrCreateChatbot() {
    if (createdChatbotRef.current) return createdChatbotRef.current
    if (createdChatbot) return createdChatbot
    return createChatbot()
  }

  async function openKnowledgeUpload() {
    if (!knowledgeReady || saving || uploading) return
    const chatbot = await getOrCreateChatbot()
    if (chatbot) newBotFileInputRef.current?.click()
  }

  async function uploadDocuments(files: FileList | File[] | null) {
    if (!files?.length || uploading || saving) return
    const chatbot = await getOrCreateChatbot()
    if (!chatbot) return
    setUploading(true)
    setError("")
    const nextTitles: string[] = []
    try {
      for (const file of Array.from(files)) {
        const document = await extractDocumentUpload(file)
        const created = await api<{ item: ContentItem }>(
          `/admin/chatbots/${chatbot.id}/content`,
          {
            method: "POST",
            body: {
              title: document.title,
              body: document.body,
              contentType: document.contentType,
            },
          }
        )
        await api(`/admin/chatbots/${chatbot.id}/content/${created.item.id}/publish`, {
          method: "POST",
        })
        nextTitles.push(document.title)
      }
      setUploadedTitles((current) => [...nextTitles, ...current])
      onSetupChanged(chatbot.id)
    } catch (apiError) {
      setError(getErrorMessage(apiError))
    } finally {
      if (newBotFileInputRef.current) newBotFileInputRef.current.value = ""
      setUploading(false)
    }
  }

  async function testChatbot() {
    if (!createdChatbot || !sourcesReady || !testMessage.trim()) return
    setTesting(true)
    setError("")
    setTestAnswer(null)
    try {
      const response = await api<ChatAnswer>(
        `/admin/chatbots/${createdChatbot.id}/test-message`,
        {
          method: "POST",
          body: { message: testMessage },
        }
      )
      setTestAnswer(response)
    } catch (apiError) {
      setError(getErrorMessage(apiError))
    } finally {
      setTesting(false)
    }
  }

  function selectStep(step: NewBotStepKey) {
    const stepIndex = newBotSteps.findIndex((item) => item.key === step)
    if (stepIndex <= maxUnlockedStepIndex)
      setActiveStep(step === "create" && botCreated ? "knowledge" : step)
  }

  function renderSetupBody() {
    return (
      <div className="flex flex-col gap-4">
        <input
          ref={newBotFileInputRef}
          className="hidden"
          type="file"
          multiple
          accept={supportedDocumentUploadAccept}
          onChange={(event) => void uploadDocuments(event.currentTarget.files)}
        />
        <div className="rounded-2xl bg-background p-4">
          <div className="mb-4 font-heading text-lg font-medium">Create</div>
          <FieldGroup className="gap-4">
            <Field data-disabled={botCreated}>
              <FieldLabel>Name</FieldLabel>
              <Input
                placeholder="Website assistant"
                readOnly={botCreated}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
            <Field data-disabled={botCreated}>
              <FieldLabel>Purpose</FieldLabel>
              <Textarea
                readOnly={botCreated}
                className="min-h-24"
                placeholder="Answer approved questions from website visitors"
                value={purpose}
                onChange={(event) => setPurpose(event.target.value)}
              />
            </Field>
            <CapabilityPicker
              disabled={botCreated}
              value={capabilities}
              onChange={setCapabilities}
            />
          </FieldGroup>
        </div>

        <div
          className={cn(
            "rounded-2xl bg-background p-4",
            !knowledgeReady && "opacity-50"
          )}
        >
          <div className="mb-4 font-heading text-lg font-medium">Knowledge</div>
          {uploadedTitles.length === 0 ? (
            <Empty
              className={cn(
                "min-h-44 cursor-pointer rounded-2xl border border-dashed border-border/60 bg-muted/40 p-6 transition-colors hover:bg-muted/60",
                (!knowledgeReady || saving || uploading) && "cursor-not-allowed"
              )}
              onClick={() => void openKnowledgeUpload()}
              onDragOver={(event) => {
                if (!knowledgeReady || saving || uploading) return
                event.preventDefault()
              }}
              onDrop={(event) => {
                if (!knowledgeReady || saving || uploading) return
                event.preventDefault()
                void uploadDocuments(Array.from(event.dataTransfer.files))
              }}
            >
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Upload />
                </EmptyMedia>
                <EmptyTitle>Upload source documents</EmptyTitle>
                <EmptyDescription>
                  {saving
                    ? "Creating bot..."
                    : uploading
                      ? "Uploading documents..."
                      : "Click here or drag and drop approved source documents."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div
              className={cn(
                "flex cursor-pointer flex-col gap-2 rounded-2xl border border-dashed border-border/60 p-3 transition-colors hover:bg-muted/40",
                (!knowledgeReady || saving || uploading) && "cursor-not-allowed"
              )}
              onClick={() => void openKnowledgeUpload()}
              onDragOver={(event) => {
                if (!knowledgeReady || saving || uploading) return
                event.preventDefault()
              }}
              onDrop={(event) => {
                if (!knowledgeReady || saving || uploading) return
                event.preventDefault()
                void uploadDocuments(Array.from(event.dataTransfer.files))
              }}
            >
              {uploadedTitles.map((title) => (
                <div
                  key={title}
                  className="rounded-2xl border border-border/60 px-4 py-3 text-sm font-medium"
                >
                  {title}
                </div>
              ))}
              <div className="px-4 py-2 text-center text-sm text-muted-foreground">
                Click or drag and drop more documents.
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  function renderStepBody() {
    if (activeStep === "test") {
      return (
        <FieldGroup className="gap-4">
          <Field data-disabled={!testReady}>
            <FieldLabel>Test message</FieldLabel>
            <Textarea
              className="min-h-24"
              disabled={!testReady}
              value={testMessage}
              onChange={(event) => setTestMessage(event.target.value)}
            />
          </Field>
          <Button
            disabled={!testReady || !testMessage.trim() || testing}
            onClick={() => void testChatbot()}
          >
            <SendHorizontal data-icon="inline-start" />
            {testing ? "Testing..." : "Ask"}
          </Button>
          {testAnswer && (
            <Alert>
              <AlertTitle className="flex items-center justify-between gap-2">
                <span>Test response</span>
                <Badge
                  variant={
                    testAnswer.actionTrace.runtime === "agno" &&
                    testAnswer.actionTrace.mode === "live_agent"
                      ? "secondary"
                      : "outline"
                  }
                >
                  {testAnswer.actionTrace.runtime === "agno" &&
                  testAnswer.actionTrace.mode === "live_agent"
                    ? "Agno live"
                    : "Fallback"}
                </Badge>
              </AlertTitle>
              <AlertDescription className="whitespace-pre-wrap">
                {testAnswer.answer}
              </AlertDescription>
              <div className="mt-3 flex flex-wrap gap-2">
                {typeof testAnswer.actionTrace.policyVersion === "string" && (
                  <Badge variant="outline">{testAnswer.actionTrace.policyVersion}</Badge>
                )}
                {Array.isArray(testAnswer.actionTrace.capabilityIds) && testAnswer.actionTrace.capabilityIds.map((capabilityId) => (
                  <Badge key={`capability-${capabilityId}`} variant="secondary">
                    {String(capabilityId).replace(/([A-Z])/g, " $1")}
                  </Badge>
                ))}
                {Array.isArray(testAnswer.actionTrace.toolsEnabled) && (
                  <Badge variant="outline">
                    Tools: {testAnswer.actionTrace.toolsEnabled.map(String).join(", ")}
                  </Badge>
                )}
                {Array.isArray(testAnswer.actionTrace.sourceIds) && (
                  <Badge variant="outline">
                    Sources: {testAnswer.actionTrace.sourceIds.length}
                  </Badge>
                )}
                {testAnswer.agentTraceId && <Badge variant="outline">Trace {testAnswer.agentTraceId}</Badge>}
              </div>
            </Alert>
          )}
        </FieldGroup>
      )
    }

    if (activeStep === "finish") {
      return (
        <FieldGroup className="gap-4">
          <Field>
            <FieldLabel>Status</FieldLabel>
            <Input
              readOnly
              value={
                createdChatbot
                  ? `Runtime ${createdChatbot.runtimeStatus?.replace(/_/g, " ") ?? "provisioning"}`
                  : "Create the bot first"
              }
            />
          </Field>
          <Field>
            <FieldLabel>Knowledge namespace</FieldLabel>
            <Input
              readOnly
              value={
                createdChatbot?.knowledgeNamespace ?? "Created after bot setup"
              }
            />
          </Field>
        </FieldGroup>
      )
    }

    return renderSetupBody()
  }

  function renderFooterActions() {
    if (activeStep === "create") {
      return (
        <>
          <Button variant="outline" onClick={closeSetup}>
            Cancel
          </Button>
          <Button
            disabled={!createReady || saving}
            onClick={() => {
              if (botCreated) setActiveStep("knowledge")
              else void createChatbot()
            }}
            variant={createReady ? "default" : "outline"}
          >
            {saving ? "Creating..." : "Next"}
          </Button>
        </>
      )
    }

    if (activeStep === "knowledge") {
      return (
        <>
          <Button variant="outline" onClick={() => setActiveStep("create")}>
            Back
          </Button>
          <Button
            disabled={!sourcesReady}
            onClick={() => setActiveStep("test")}
            variant={sourcesReady ? "default" : "outline"}
          >
            Next
          </Button>
        </>
      )
    }

    if (activeStep === "test") {
      return (
        <>
          <Button variant="outline" onClick={() => setActiveStep("knowledge")}>
            Back
          </Button>
          <Button
            disabled={!testAnswer}
            onClick={() => setActiveStep("finish")}
            variant={testAnswer ? "default" : "outline"}
          >
            Next
          </Button>
        </>
      )
    }

    return (
      <>
        <Button variant="outline" onClick={() => setActiveStep("test")}>
          Back
        </Button>
        <Button onClick={closeSetup}>Done</Button>
      </>
    )
  }

  return (
    <>
      <Button
        disabled={disabled}
        onClick={() => setOpen(true)}
        size="sm"
        variant="outline"
      >
        <Plus data-icon="inline-start" />
        New Bot
      </Button>
      <Drawer
        direction="right"
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen)
          if (!nextOpen) reset()
        }}
      >
        <DrawerContent className="data-[vaul-drawer-direction=right]:w-[min(860px,100vw)] data-[vaul-drawer-direction=right]:sm:max-w-none">
          <DrawerHeader>
            <DrawerTitle>New bot</DrawerTitle>
            <DrawerDescription>
              Complete each step in order: create the bot, upload knowledge,
              then test it.
            </DrawerDescription>
          </DrawerHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
              <NewBotStepRail
                activeStep={activeStep}
                completedSteps={completedSteps}
                maxUnlockedStepIndex={maxUnlockedStepIndex}
                onSelect={selectStep}
              />
              {error && (
                <AlertCallout
                  title="Request failed"
                  description={error}
                  variant="destructive"
                />
              )}
              <div className="min-h-0 rounded-2xl bg-muted p-4">
                {renderStepBody()}
              </div>
            </div>
          </div>
          <Separator />
          <DrawerFooter className="flex-row items-center justify-between">
            {renderFooterActions()}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  )
}

function NewBotStepRail({
  activeStep,
  completedSteps,
  maxUnlockedStepIndex,
  onSelect,
}: {
  activeStep: NewBotStepKey
  completedSteps: Set<NewBotStepKey>
  maxUnlockedStepIndex: number
  onSelect: (step: NewBotStepKey) => void
}) {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="grid grid-cols-3 gap-2">
        {newBotSteps.map((step, index) => {
          const isActive =
            step.key === "create"
              ? activeStep === "create" || activeStep === "knowledge"
              : activeStep === step.key
          const isUnlocked = index <= maxUnlockedStepIndex
          const isComplete = completedSteps.has(step.key)

          return (
            <Button
              key={step.key}
              aria-current={isActive ? "step" : undefined}
              variant="ghost"
              className={cn(
                "h-10 min-w-0 justify-center gap-2 rounded-full px-3 text-center",
                isActive && "bg-muted",
                !isUnlocked && "opacity-50"
              )}
              disabled={!isUnlocked}
              onClick={() => onSelect(step.key)}
              type="button"
            >
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full border text-xs font-medium",
                  isComplete
                    ? "border-transparent bg-primary text-primary-foreground"
                    : "border-border bg-background"
                )}
              >
                {index + 1}
              </span>
              <span className="truncate text-sm font-medium">{step.title}</span>
            </Button>
          )
        })}
      </div>
    </div>
  )
}

export function CapabilityPicker({
  disabled = false,
  value,
  onChange,
}: {
  disabled?: boolean
  value: string[]
  onChange: (value: string[]) => void
}) {
  const [openCapabilityDetails, setOpenCapabilityDetails] = useState<
    string | null
  >(null)

  return (
    <Field>
      <FieldLabel>Capabilities</FieldLabel>
      <div className="grid w-full grid-cols-2 gap-2">
        {capabilityOptions.map((option) => {
          const checked = value.includes(option.value)
          return (
            <Field
              key={option.value}
              className="items-center gap-3 rounded-2xl border border-border/60 px-3 py-3"
              data-disabled={disabled || undefined}
              orientation="horizontal"
            >
              <Checkbox
                checked={checked}
                disabled={disabled}
                id={`capability-${option.value}`}
                onCheckedChange={(next) => {
                  if (next) onChange([...value, option.value])
                  else onChange(value.filter((item) => item !== option.value))
                }}
              />
              <HoverCard
                open={openCapabilityDetails === option.value}
                onOpenChange={(open) => {
                  setOpenCapabilityDetails(open ? option.value : null)
                }}
              >
                <FieldLabel
                  className="mb-0 min-w-0 flex-1 font-normal"
                  htmlFor={`capability-${option.value}`}
                >
                  <span className="truncate font-medium">{option.label}</span>
                </FieldLabel>
                <HoverCardTrigger
                  aria-label={`${option.label} details`}
                  className="flex size-5 shrink-0 cursor-help items-center justify-center rounded-full border border-border text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 [&_svg]:size-3"
                  href={`#capability-${option.value}-details`}
                  onBlur={() => setOpenCapabilityDetails(null)}
                  onClick={(event) => event.preventDefault()}
                  onFocus={() => setOpenCapabilityDetails(option.value)}
                  onMouseEnter={() => setOpenCapabilityDetails(option.value)}
                  onMouseLeave={() => setOpenCapabilityDetails(null)}
                >
                  <CircleHelp aria-hidden="true" data-icon="inline-start" />
                </HoverCardTrigger>
                <HoverCardContent
                  align="center"
                  className="w-80"
                  side="left"
                  sideOffset={10}
                  onMouseEnter={() => setOpenCapabilityDetails(option.value)}
                  onMouseLeave={() => setOpenCapabilityDetails(null)}
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                      <p className="font-medium">{option.label}</p>
                      <p className="text-sm/relaxed text-muted-foreground">
                        {option.description}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        Enabled tools
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {option.tools.map((tool) => (
                          <Badge key={tool} variant="secondary">
                            {tool}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </HoverCardContent>
              </HoverCard>
            </Field>
          )
        })}
      </div>
    </Field>
  )
}

export function GettingStarted({
  onCreated,
}: {
  onCreated: (project: Project, chatbot: Chatbot) => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Create project</CardTitle>
        <CardAction>
          <CreateWorkspaceButton onCreated={onCreated} />
        </CardAction>
      </CardHeader>
    </Card>
  )
}

export function ProjectNeedsChatbot({
  onBackToProjects,
  onCreated,
  project,
}: {
  project: Project
  onBackToProjects: () => void
  onCreated: (chatbot: Chatbot) => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Create a chatbot for {project.name}</CardTitle>
      </CardHeader>
      <CardFooter className="flex-wrap gap-2">
        <CreateChatbotButton
          disabled={false}
          label="Create chatbot"
          projectId={project.id}
          onCreated={onCreated}
        />
        <Button variant="outline" onClick={onBackToProjects}>
          Back to projects
        </Button>
      </CardFooter>
    </Card>
  )
}
