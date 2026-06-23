import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@workspace/ui/components/alert-dialog"
import { AspectRatio } from "@workspace/ui/components/aspect-ratio"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@workspace/ui/components/drawer"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@workspace/ui/components/empty"
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import { Separator } from "@workspace/ui/components/separator"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
} from "@workspace/ui/components/sidebar"
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { Textarea } from "@workspace/ui/components/textarea"
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group"
import { cn } from "@workspace/ui/lib/utils"
import { useTheme } from "@/components/theme-provider"
import {
  Building2,
  Bot,
  ChevronUp,
  Check,
  CheckCircle2,
  CircleUserRound,
  Clipboard,
  FilePlus2,
  FileText,
  Archive,
  ArchiveRestore,
  Globe2,
  KeyRound,
  LayoutDashboard,
  Monitor,
  MoreHorizontal,
  Moon,
  Palette,
  Plus,
  Search,
  SendHorizontal,
  Settings as SettingsIcon,
  ShieldCheck,
  Sun,
  Trash2,
  Upload,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"

type Page = "projects" | "content" | "connect" | "settings"
type ThemePreference = "dark" | "light" | "system"
type NewBotStepKey = "create" | "knowledge" | "test" | "finish"
type Project = { id: string; name: string; domain: string | null; status: "active" | "archived" }
type ChatbotCapabilities = { faq: boolean; leadCapture: boolean; appointmentBooking: boolean; propertyRecommendations: boolean }
type Chatbot = {
  id: string
  projectId: string
  name: string
  purpose: string
  capabilities: ChatbotCapabilities
  status: string
  agentKey?: string
  knowledgeNamespace?: string
  runtimeStatus?: "ready" | "syncing" | "error" | "paused"
  lastIndexedContentVersionId?: string | null
  lastSyncError?: string | null
}
type ContentItem = { id: string; title: string; slug: string; body: string; status: string; contentType: string; publishedVersionId?: string | null }
type KnowledgeSource = { id: string; chatbotId?: string; contentItemId?: string; sourceVersionId?: string; title: string; sourceType: string; chunkCount: number; status: string; indexedAt: string }
type Source = { chunkId: string; title: string; excerpt: string; score: number }
type ChatAnswer = {
  answer: string
  fallback: boolean
  sources: Source[]
  channel: "website" | "whatsapp" | "instagram_dm"
  confidence: string
  actionTrace: Record<string, unknown>
  agentTraceId?: string
}
type Connector = { id: string; channel: "website" | "whatsapp" | "instagram_dm"; status: string; displayName: string; config: Record<string, unknown> }
type Deployment = { id: string; publicKey: string; allowedDomains: string[]; installStatus: string; installSnippet: string }

const apiBase = import.meta.env.VITE_API_BASE_URL ?? "/api/v1"
const adminApiKeyStorageKey = "khanect-admin-api-key"
const contentTypeOptions = [
  { value: "faq", label: "FAQ / common question" },
  { value: "property", label: "Property details" },
  { value: "project", label: "Project / development" },
  { value: "area", label: "Area guide" },
  { value: "policy", label: "Policy / rules" },
  { value: "general", label: "General note" },
]
const navItems: Array<{ key: Page; label: string; icon: typeof FileText }> = [
  { key: "projects", label: "Projects", icon: LayoutDashboard },
  { key: "content", label: "Content", icon: FileText },
  { key: "connect", label: "Connect", icon: Globe2 },
]
const sampleContent = {
  title: "Marina Heights pet policy",
  contentType: "faq",
  body: "Marina Heights allows cats and small dogs. Pet owners must register pets with building management before move-in. The tower is a five-minute walk from Dubai Marina tram.",
}

export function App() {
  const { theme, setTheme } = useTheme()
  const [page, setPage] = useState<Page>(() => pageFromPath(window.location.pathname))
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState("")
  const [chatbots, setChatbots] = useState<Chatbot[]>([])
  const [selectedChatbotId, setSelectedChatbotId] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [authRequired, setAuthRequired] = useState(false)
  const [authVersion, setAuthVersion] = useState(0)

  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null
  const selectedChatbot = chatbots.find((chatbot) => chatbot.id === selectedChatbotId) ?? null
  const contentChatbot = selectedChatbot ?? chatbots[0] ?? null

  useEffect(() => {
    let cancelled = false
    void api<{ items: Project[] }>("/admin/projects")
      .then((response) => {
        if (cancelled) return
        setAuthRequired(false)
        setError("")
        setProjects(response.items)
        setSelectedProjectId((current) => current || response.items[0]?.id || "")
      })
      .catch((apiError) => {
        if (!cancelled) {
          if (isAdminAuthError(apiError)) setAuthRequired(true)
          setError(getErrorMessage(apiError))
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [authVersion])

  useEffect(() => {
    if (!selectedProjectId) return
    let cancelled = false
    void api<{ items: Chatbot[] }>(`/admin/projects/${selectedProjectId}/chatbots`)
      .then((response) => {
        if (cancelled) return
        setError("")
        setChatbots(response.items)
        setSelectedChatbotId((current) => response.items.some((chatbot) => chatbot.id === current) ? current : response.items[0]?.id || "")
      })
      .catch((apiError) => {
        if (!cancelled) {
          setChatbots([])
          setSelectedChatbotId("")
          if (page !== "projects") setError(getErrorMessage(apiError))
        }
      })
    return () => {
      cancelled = true
    }
  }, [page, selectedProjectId])

  useEffect(() => {
    const syncPage = () => setPage(pageFromPath(window.location.pathname))
    window.addEventListener("popstate", syncPage)
    return () => window.removeEventListener("popstate", syncPage)
  }, [])

  useEffect(() => {
    const handleAuthRequired = () => setAuthRequired(true)
    window.addEventListener("khanect-admin-auth-required", handleAuthRequired)
    return () => window.removeEventListener("khanect-admin-auth-required", handleAuthRequired)
  }, [])

  function navigate(next: Page) {
    window.history.pushState(null, "", `/admin/${next}`)
    setPage(next)
  }

  return (
    <div className="flex h-svh flex-col overflow-hidden bg-background text-foreground">
      <header className="shrink-0 border-b bg-background px-4 py-5 sm:px-6">
        <div className="flex min-w-0 items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border bg-muted">
              <Building2 aria-hidden="true" />
            </div>
            <h1 className="truncate text-2xl font-semibold">Khanect Omni Realty</h1>
          </div>
          <Button aria-label="Profile" className="shrink-0 rounded-full" size="icon" variant="outline">
            <CircleUserRound data-icon="inline-start" />
          </Button>
        </div>
      </header>

      <SidebarProvider className="min-h-0 flex-1">
        <Sidebar className="border-border bg-background text-foreground" collapsible="none">
          <SidebarContent className="p-4">
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navItems.map(({ key, label, icon: Icon }) => (
                    <SidebarMenuItem key={key}>
                      <SidebarMenuButton isActive={page === key} onClick={() => navigate(key)}>
                        <Icon data-icon="inline-start" />
                        <span>{label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="p-4 pt-0">
            <SidebarSeparator />
            <SidebarMenu>
              <SidebarMenuItem>
                <DropdownMenu>
                  <DropdownMenuTrigger render={<SidebarMenuButton aria-label="Workspace menu" />}>
                    <Building2 data-icon="inline-start" />
                    <span className="min-w-0 flex-1 truncate">{selectedProject?.name ?? "Workspace"}</span>
                    <ChevronUp data-icon="inline-end" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-72" side="top" sideOffset={8}>
                    <DropdownMenuGroup>
                      <DropdownMenuItem onClick={() => navigate("settings")}>
                        <SettingsIcon data-icon="inline-start" />
                        Settings
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      <DropdownMenuLabel className="flex items-center gap-2">
                        <Palette data-icon="inline-start" />
                        Themes
                      </DropdownMenuLabel>
                      <ToggleGroup
                        className="w-full px-1"
                        spacing={0}
                        value={[theme as ThemePreference]}
                        variant="outline"
                        onValueChange={(values) => {
                          const nextTheme = values[0] as ThemePreference | undefined
                          if (nextTheme) setTheme(nextTheme)
                        }}
                      >
                        <ToggleGroupItem className="flex-1" value="system">
                          <Monitor data-icon="inline-start" />
                          System
                        </ToggleGroupItem>
                        <ToggleGroupItem className="flex-1" value="light">
                          <Sun data-icon="inline-start" />
                          Light
                        </ToggleGroupItem>
                        <ToggleGroupItem className="flex-1" value="dark">
                          <Moon data-icon="inline-start" />
                          Dark
                        </ToggleGroupItem>
                      </ToggleGroup>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset className="min-h-0">
          <main className={cn("min-h-0 flex-1 p-4 sm:p-6", page === "content" ? "overflow-hidden" : "overflow-y-auto")}>
          <section className={cn("flex w-full flex-col gap-5", page === "content" ? "h-full min-h-0" : "min-h-full")}>
            {authRequired && (
              <AdminAccessPanel
                onSaved={() => {
                  setAuthRequired(false)
                  setError("")
                  setAuthVersion((version) => version + 1)
                }}
              />
            )}
            {error && <AlertCallout title="Request failed" description={error} variant="destructive" />}
            {!authRequired && loading && <Card><CardHeader><CardTitle>Loading workspace</CardTitle><CardDescription>Preparing projects and chatbots.</CardDescription></CardHeader></Card>}
            {!authRequired && !loading && page === "settings" && (
              <SettingsView
                chatbots={chatbots}
                project={selectedProject}
                selectedChatbot={selectedChatbot}
                onNavigate={navigate}
              />
            )}
            {!authRequired && !loading && !contentChatbot && page !== "projects" && page !== "settings" && (
              selectedProject ? (
                <ProjectNeedsChatbot
                  project={selectedProject}
                  onBackToProjects={() => navigate("projects")}
                  onCreated={(chatbot) => {
                    setChatbots((current) => [chatbot, ...current])
                    setSelectedChatbotId(chatbot.id)
                    navigate("content")
                  }}
                />
              ) : (
                <GettingStarted onCreated={(project, chatbot) => {
                  setProjects((current) => [project, ...current])
                  setChatbots([chatbot])
                  setSelectedProjectId(project.id)
                  setSelectedChatbotId(chatbot.id)
                  navigate("content")
                }} />
              )
            )}
            {!authRequired && !loading && page === "projects" && (
              <ProjectsView
                chatbots={chatbots}
                projects={projects}
                selectedChatbotId={selectedChatbotId}
                selectedProjectId={selectedProjectId}
                onChatbotChange={setSelectedChatbotId}
                onProjectChange={setSelectedProjectId}
                onCreated={(project, chatbot) => {
                  setProjects((current) => [project, ...current])
                  setChatbots([chatbot])
                  setSelectedProjectId(project.id)
                  setSelectedChatbotId(chatbot.id)
                  navigate("content")
                }}
                onChatbotCreated={(chatbot) => {
                  setChatbots((current) => [chatbot, ...current])
                  setSelectedChatbotId(chatbot.id)
                  navigate("content")
                }}
                onProjectUpdated={(project) => {
                  setProjects((current) => current.map((item) => item.id === project.id ? project : item))
                }}
                onProjectDeleted={(projectId) => {
                  const remainingProjects = projects.filter((project) => project.id !== projectId)
                  setProjects(remainingProjects)
                  if (selectedProjectId === projectId) {
                    setSelectedProjectId(remainingProjects[0]?.id ?? "")
                    setSelectedChatbotId("")
                    setChatbots([])
                  }
                }}
                onStart={(projectId) => {
                  setSelectedProjectId(projectId)
                  navigate("content")
                }}
              />
            )}
            {!authRequired && !loading && contentChatbot && page !== "projects" && page !== "settings" && (
              <>
                {page === "content" && (
                  <ContentView
                    chatbots={chatbots}
                    chatbotId={contentChatbot.id}
                    onChatbotSelected={setSelectedChatbotId}
                    onChatbotCreated={(chatbot) => {
                      setChatbots((current) => [chatbot, ...current])
                      setSelectedChatbotId(chatbot.id)
                    }}
                    onChatbotDeleted={(deletedChatbotId) => {
                      const remainingChatbots = chatbots.filter((chatbot) => chatbot.id !== deletedChatbotId)
                      setChatbots(remainingChatbots)
                      if (selectedChatbotId === deletedChatbotId) setSelectedChatbotId(remainingChatbots[0]?.id ?? "")
                    }}
                    onChatbotUpdated={(chatbot) => {
                      setChatbots((current) => current.map((item) => item.id === chatbot.id ? chatbot : item))
                    }}
                    project={selectedProject}
                  />
                )}
                {page === "connect" && <ConnectView chatbotId={contentChatbot.id} />}
              </>
            )}
          </section>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </div>
  )
}

function AdminAccessPanel({ onSaved }: { onSaved: () => void }) {
  const [key, setKey] = useState(() => readAdminApiKey())

  function saveKey() {
    const trimmed = key.trim()
    if (trimmed) {
      window.localStorage.setItem(adminApiKeyStorageKey, trimmed)
    } else {
      window.localStorage.removeItem(adminApiKeyStorageKey)
    }
    onSaved()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Admin access required</CardTitle>
        <CardDescription>Enter the production admin API key configured on the API server.</CardDescription>
      </CardHeader>
      <CardContent>
        <Field>
          <FieldLabel>Admin API key</FieldLabel>
          <Input
            autoComplete="off"
            type="password"
            value={key}
            onChange={(event) => setKey(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") saveKey()
            }}
          />
        </Field>
      </CardContent>
      <CardFooter className="gap-2">
        <Button disabled={!key.trim()} onClick={saveKey}>Unlock admin</Button>
        <Button
          variant="outline"
          onClick={() => {
            setKey("")
            window.localStorage.removeItem(adminApiKeyStorageKey)
          }}
        >
          Clear
        </Button>
      </CardFooter>
    </Card>
  )
}

function SettingsView({
  chatbots,
  onNavigate,
  project,
  selectedChatbot,
}: {
  chatbots: Chatbot[]
  onNavigate: (page: Page) => void
  project: Project | null
  selectedChatbot: Chatbot | null
}) {
  const { theme, setTheme } = useTheme()
  const [adminKeySaved, setAdminKeySaved] = useState(() => Boolean(readAdminApiKey()))
  const themeValue = theme as ThemePreference
  const totalChatbots = chatbots.length
  const activeChatbots = chatbots.filter((chatbot) => chatbot.status === "active").length

  function clearAdminKey() {
    window.localStorage.removeItem(adminApiKeyStorageKey)
    setAdminKeySaved(false)
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <div className="flex flex-col gap-5">
        <Card>
          <CardHeader>
            <CardTitle>Themes</CardTitle>
            <CardDescription>Choose how the admin workspace renders on this device.</CardDescription>
            <CardAction><Badge variant="outline">{themeValue}</Badge></CardAction>
          </CardHeader>
          <CardContent>
            <ToggleGroup
              className="w-full flex-wrap"
              spacing={0}
              value={[themeValue]}
              variant="outline"
              onValueChange={(values) => {
                const nextTheme = values[0] as ThemePreference | undefined
                if (nextTheme) setTheme(nextTheme)
              }}
            >
              <ToggleGroupItem className="flex-1" value="system">
                <Monitor data-icon="inline-start" />
                System
              </ToggleGroupItem>
              <ToggleGroupItem className="flex-1" value="light">
                <Sun data-icon="inline-start" />
                Light
              </ToggleGroupItem>
              <ToggleGroupItem className="flex-1" value="dark">
                <Moon data-icon="inline-start" />
                Dark
              </ToggleGroupItem>
            </ToggleGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Admin access</CardTitle>
            <CardDescription>Local browser access for production admin requests.</CardDescription>
            <CardAction><Badge variant={adminKeySaved ? "secondary" : "outline"}>{adminKeySaved ? "Saved" : "Not saved"}</Badge></CardAction>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel>Admin API key</FieldLabel>
                <Input readOnly value={adminKeySaved ? "Saved in this browser" : "No key saved"} />
              </Field>
            </FieldGroup>
          </CardContent>
          <CardFooter className="gap-2">
            <Button disabled={!adminKeySaved} variant="outline" onClick={clearAdminKey}>
              <KeyRound data-icon="inline-start" />
              Clear saved key
            </Button>
          </CardFooter>
        </Card>
      </div>

      <div className="flex flex-col gap-5">
        <Card>
          <CardHeader>
            <CardTitle>Workspace</CardTitle>
            <CardDescription>Current project and assistant configuration.</CardDescription>
            <CardAction><Badge variant={project?.status === "active" ? "secondary" : "outline"}>{project?.status ?? "No project"}</Badge></CardAction>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel>Project</FieldLabel>
                <Input readOnly value={project?.name ?? "No project selected"} />
              </Field>
              <Field>
                <FieldLabel>Domain</FieldLabel>
                <Input readOnly value={project?.domain ?? "Domain not added yet"} />
              </Field>
              <Field>
                <FieldLabel>Selected assistant</FieldLabel>
                <Input readOnly value={selectedChatbot?.name ?? "No assistant selected"} />
              </Field>
            </FieldGroup>
          </CardContent>
          <CardFooter className="flex-wrap gap-2">
            <Button variant="outline" onClick={() => onNavigate("projects")}>
              <LayoutDashboard data-icon="inline-start" />
              Projects
            </Button>
            <Button variant="outline" onClick={() => onNavigate("connect")}>
              <Globe2 data-icon="inline-start" />
              Connect
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Assistant</CardTitle>
            <CardDescription>Knowledge and runtime status for the selected chatbot.</CardDescription>
            <CardAction><Badge variant="outline">{activeChatbots}/{totalChatbots} active</Badge></CardAction>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel>Purpose</FieldLabel>
                <Textarea readOnly className="min-h-24" value={selectedChatbot?.purpose || "No assistant selected"} />
              </Field>
              <Field>
                <FieldLabel>Runtime</FieldLabel>
                <Input readOnly value={selectedChatbot?.runtimeStatus ?? "Not available"} />
              </Field>
              <Field>
                <FieldLabel>Knowledge namespace</FieldLabel>
                <Input readOnly value={selectedChatbot?.knowledgeNamespace ?? "Not available"} />
              </Field>
            </FieldGroup>
          </CardContent>
          <CardFooter className="flex-wrap gap-2">
            <Badge variant={selectedChatbot?.capabilities.faq ? "secondary" : "outline"}>
              <Bot data-icon="inline-start" />
              FAQ
            </Badge>
            <Badge variant={selectedChatbot?.capabilities.leadCapture ? "secondary" : "outline"}>
              <ShieldCheck data-icon="inline-start" />
              Lead capture
            </Badge>
            <Badge variant={selectedChatbot?.capabilities.appointmentBooking ? "secondary" : "outline"}>
              <Clipboard data-icon="inline-start" />
              Appointments
            </Badge>
            <Badge variant={selectedChatbot?.capabilities.propertyRecommendations ? "secondary" : "outline"}>
              <Building2 data-icon="inline-start" />
              Properties
            </Badge>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}

function ProjectsView(props: {
  projects: Project[]
  chatbots: Chatbot[]
  selectedProjectId: string
  selectedChatbotId: string
  onProjectChange: (id: string) => void
  onChatbotChange: (id: string) => void
  onCreated: (project: Project, chatbot: Chatbot) => void
  onChatbotCreated: (chatbot: Chatbot) => void
  onProjectUpdated: (project: Project) => void
  onProjectDeleted: (projectId: string) => void
  onStart: (projectId: string) => void
}) {
  const selectedChatbot = props.chatbots.find((chatbot) => chatbot.id === props.selectedChatbotId)
  const [projectActionId, setProjectActionId] = useState<string | null>(null)
  const [projectActionError, setProjectActionError] = useState("")
  const [confirmingProjectAction, setConfirmingProjectAction] = useState<{ type: "archive" | "unarchive" | "delete"; project: Project } | null>(null)

  async function archiveProject(project: Project) {
    setProjectActionId(project.id)
    setProjectActionError("")
    try {
      const response = await api<{ project: Project }>(`/admin/projects/${project.id}/archive`, { method: "POST" })
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
      const response = await api<{ project: Project }>(`/admin/projects/${project.id}/unarchive`, { method: "POST" })
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
      await api<{ project: Project }>(`/admin/projects/${project.id}`, { method: "DELETE" })
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
        {props.projects.length > 0 && <CreateWorkspaceButton onCreated={props.onCreated} />}
      </div>

      <div className="grid gap-5">
        {projectActionError && <AlertCallout title="Project action failed" description={projectActionError} variant="destructive" />}
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {props.projects.length === 0 && (
            <Empty className="min-h-96 border bg-muted/20 md:col-span-2 xl:col-span-3">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Building2 aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle>No Omni Realty projects yet</EmptyTitle>
                <EmptyDescription>
                  Create a real estate project to connect a website domain, launch a chatbot, and organize approved property knowledge for visitors.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <CreateWorkspaceButton onCreated={props.onCreated} variant="default" />
              </EmptyContent>
            </Empty>
          )}
          {props.projects.map((project) => {
            const isSelected = project.id === props.selectedProjectId
            const isArchived = project.status === "archived"
            return (
              <Card key={project.id} className={cn("border shadow-none", isSelected && "border-primary")} size="sm">
                <CardHeader>
                  <CardTitle className="truncate">{project.name}</CardTitle>
                  <CardDescription className="truncate">{project.domain ?? "Domain not added yet"}</CardDescription>
                  <CardAction className="flex items-center gap-1">
                    <Badge variant={isArchived ? "outline" : "secondary"}>{project.status}</Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button aria-label={`${project.name} actions`} size="icon-sm" variant="ghost" />}>
                        <MoreHorizontal data-icon="inline-start" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuGroup>
                          {isArchived ? (
                            <DropdownMenuItem disabled={projectActionId === project.id} onClick={() => setConfirmingProjectAction({ type: "unarchive", project })}>
                              <ArchiveRestore data-icon="inline-start" />
                              Unarchive project
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem disabled={projectActionId === project.id} onClick={() => setConfirmingProjectAction({ type: "archive", project })}>
                              <Archive data-icon="inline-start" />
                              Archive project
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                          <DropdownMenuItem
                            disabled={!isArchived || projectActionId === project.id}
                            variant="destructive"
                            onClick={() => setConfirmingProjectAction({ type: "delete", project })}
                          >
                            <Trash2 data-icon="inline-start" />
                            Delete project
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </CardAction>
                </CardHeader>
                <CardContent>
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
                    <Button className="flex-1" size="sm" variant="outline" onClick={() => props.onProjectChange(project.id)}>
                      Select project
                    </Button>
                  )}
                  {isSelected && selectedChatbot && (
                    <Button className="flex-1" disabled={isArchived} size="sm" variant="outline" onClick={() => props.onStart(project.id)}>
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

      <AlertDialog open={Boolean(confirmingProjectAction)} onOpenChange={(open) => { if (!open) setConfirmingProjectAction(null) }}>
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
                disabled={!confirmingProjectAction || projectActionId === confirmingProjectAction.project.id}
                variant="destructive"
                onClick={() => { if (confirmingProjectAction) void deleteProject(confirmingProjectAction.project) }}
              >
                Delete project
              </AlertDialogAction>
            ) : confirmingProjectAction?.type === "unarchive" ? (
              <AlertDialogAction
                disabled={!confirmingProjectAction || projectActionId === confirmingProjectAction.project.id}
                onClick={() => { if (confirmingProjectAction) void unarchiveProject(confirmingProjectAction.project) }}
              >
                Unarchive project
              </AlertDialogAction>
            ) : (
              <AlertDialogAction
                disabled={!confirmingProjectAction || projectActionId === confirmingProjectAction.project.id}
                onClick={() => { if (confirmingProjectAction) void archiveProject(confirmingProjectAction.project) }}
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
  const [purpose, setPurpose] = useState("Answer FAQs, qualify leads, and prepare bookings")
  const [capabilities, setCapabilities] = useState(["faq", "leadCapture"])
  const [error, setError] = useState("")

  async function createWorkspace() {
    setSaving(true)
    setError("")
    try {
      const projectResponse = await api<{ project: Project }>("/admin/projects", {
        method: "POST",
        body: { name: projectName.trim(), domain: domain.trim() || null },
      })
      const chatbotResponse = await api<{ chatbot: Chatbot }>(`/admin/projects/${projectResponse.project.id}/chatbots`, {
        method: "POST",
        body: {
          name: chatbotName.trim(),
          purpose: purpose.trim(),
          capabilities: capabilityPayload(capabilities),
        },
      })
      onCreated(projectResponse.project, chatbotResponse.chatbot)
      setOpen(false)
      setProjectName("")
      setDomain("")
      setChatbotName("Website assistant")
      setPurpose("Answer FAQs, qualify leads, and prepare bookings")
      setCapabilities(["faq", "leadCapture"])
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
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>New business project</DrawerTitle>
            <DrawerDescription>Create the project and its first chatbot from the web app.</DrawerDescription>
          </DrawerHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 pb-4">
            {error && <AlertCallout title="Request failed" description={error} variant="destructive" />}
            <FieldGroup>
              <Field>
                <FieldLabel>Project name</FieldLabel>
                <Input placeholder="Business name" value={projectName} onChange={(event) => setProjectName(event.target.value)} />
              </Field>
              <Field>
                <FieldLabel>Website domain</FieldLabel>
                <Input placeholder="business.example" value={domain} onChange={(event) => setDomain(event.target.value)} />
              </Field>
              <Field>
                <FieldLabel>First chatbot name</FieldLabel>
                <Input value={chatbotName} onChange={(event) => setChatbotName(event.target.value)} />
              </Field>
              <Field>
                <FieldLabel>Purpose</FieldLabel>
                <Textarea className="min-h-24" value={purpose} onChange={(event) => setPurpose(event.target.value)} />
              </Field>
              <CapabilityPicker value={capabilities} onChange={setCapabilities} />
            </FieldGroup>
          </div>
          <DrawerFooter>
            <Button disabled={!projectName.trim() || !chatbotName.trim() || saving} onClick={createWorkspace}>{saving ? "Creating..." : "Create project"}</Button>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
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
  const [purpose, setPurpose] = useState("Answer approved questions from website visitors")
  const [capabilities, setCapabilities] = useState(["faq"])
  const [error, setError] = useState("")

  async function createChatbot() {
    setSaving(true)
    setError("")
    try {
      const response = await api<{ chatbot: Chatbot }>(`/admin/projects/${projectId}/chatbots`, {
        method: "POST",
        body: { name: name.trim(), purpose: purpose.trim(), capabilities: capabilityPayload(capabilities) },
      })
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
      <Button className={className} size={size} variant="outline" onClick={() => setOpen(true)} disabled={disabled || saving}>
        <FilePlus2 data-icon="inline-start" />
        {label}
      </Button>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>New chatbot</DrawerTitle>
            <DrawerDescription>Add another chatbot to the selected business project.</DrawerDescription>
          </DrawerHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 pb-4">
            {error && <AlertCallout title="Request failed" description={error} variant="destructive" />}
            <FieldGroup>
              <Field>
                <FieldLabel>Chatbot name</FieldLabel>
                <Input value={name} onChange={(event) => setName(event.target.value)} />
              </Field>
              <Field>
                <FieldLabel>Purpose</FieldLabel>
                <Textarea className="min-h-24" value={purpose} onChange={(event) => setPurpose(event.target.value)} />
              </Field>
              <CapabilityPicker value={capabilities} onChange={setCapabilities} />
            </FieldGroup>
          </div>
          <DrawerFooter>
            <Button disabled={!name.trim() || saving} onClick={createChatbot}>{saving ? "Creating..." : "Create chatbot"}</Button>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  )
}

function NewBotSetupButton({
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
  const [testMessage, setTestMessage] = useState("What can this chatbot help with?")
  const [testAnswer, setTestAnswer] = useState<ChatAnswer | null>(null)
  const newBotFileInputRef = useRef<HTMLInputElement | null>(null)
  const createdChatbotRef = useRef<Chatbot | null>(null)
  const createReady = name.trim().length > 0 && purpose.trim().length > 0 && capabilities.length > 0
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
      const response = await api<{ chatbot: Chatbot }>(`/admin/projects/${projectId}/chatbots`, {
        method: "POST",
        body: { name: name.trim(), purpose: purpose.trim(), capabilities: capabilityPayload(capabilities) },
      })
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
        const body = (await file.text()).trim()
        if (!body) continue
        const title = cleanFileTitle(file.name)
        await api<{ item: ContentItem }>(`/admin/chatbots/${chatbot.id}/content`, {
          method: "POST",
          body: {
            title,
            body: body.slice(0, 50000),
            contentType: inferContentType(file.name),
          },
        })
        nextTitles.push(title)
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
      const response = await api<ChatAnswer>(`/admin/chatbots/${createdChatbot.id}/test-message`, {
        method: "POST",
        body: { message: testMessage },
      })
      setTestAnswer(response)
    } catch (apiError) {
      setError(getErrorMessage(apiError))
    } finally {
      setTesting(false)
    }
  }

  function selectStep(step: NewBotStepKey) {
    const stepIndex = newBotSteps.findIndex((item) => item.key === step)
    if (stepIndex <= maxUnlockedStepIndex) setActiveStep(step === "create" && botCreated ? "knowledge" : step)
  }

  function renderSetupBody() {
    return (
      <div className="flex flex-col gap-4">
        <input
          ref={newBotFileInputRef}
          className="hidden"
          type="file"
          multiple
          accept=".txt,.md,.markdown,.csv,.json,.html,.htm"
          onChange={(event) => void uploadDocuments(event.currentTarget.files)}
        />
        <div className="rounded-2xl bg-background p-4">
          <div className="mb-4 font-heading text-lg font-medium">Create</div>
          <FieldGroup className="gap-4">
            <Field data-disabled={botCreated}>
              <FieldLabel>Name</FieldLabel>
              <Input placeholder="Website assistant" readOnly={botCreated} value={name} onChange={(event) => setName(event.target.value)} />
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
            <CapabilityPicker disabled={botCreated} value={capabilities} onChange={setCapabilities} />
          </FieldGroup>
        </div>

        <div className={cn("rounded-2xl bg-background p-4", !knowledgeReady && "opacity-50")}>
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
                  {saving ? "Creating bot..." : uploading ? "Uploading documents..." : "Click here or drag and drop approved source documents."}
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
                <div key={title} className="rounded-2xl border border-border/60 px-4 py-3 text-sm font-medium">
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
          <Button disabled={!testReady || !testMessage.trim() || testing} onClick={() => void testChatbot()}>
            <SendHorizontal data-icon="inline-start" />
            {testing ? "Testing..." : "Ask"}
          </Button>
          {testAnswer && (
            <Alert>
              <AlertTitle>Test response</AlertTitle>
              <AlertDescription className="whitespace-pre-wrap">{testAnswer.answer}</AlertDescription>
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
            <Input readOnly value={createdChatbot ? "Ready to manage from content" : "Create the bot first"} />
          </Field>
          <Field>
            <FieldLabel>Knowledge namespace</FieldLabel>
            <Input readOnly value={createdChatbot?.knowledgeNamespace ?? "Created after bot setup"} />
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
          <Button variant="outline" onClick={closeSetup}>Cancel</Button>
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
          <Button variant="outline" onClick={() => setActiveStep("create")}>Back</Button>
          <Button disabled={!sourcesReady} onClick={() => setActiveStep("test")} variant={sourcesReady ? "default" : "outline"}>Next</Button>
        </>
      )
    }

    if (activeStep === "test") {
      return (
        <>
          <Button variant="outline" onClick={() => setActiveStep("knowledge")}>Back</Button>
          <Button disabled={!testAnswer} onClick={() => setActiveStep("finish")} variant={testAnswer ? "default" : "outline"}>Next</Button>
        </>
      )
    }

    return (
      <>
        <Button variant="outline" onClick={() => setActiveStep("test")}>Back</Button>
        <Button onClick={closeSetup}>Done</Button>
      </>
    )
  }

  return (
    <>
      <Button disabled={disabled} onClick={() => setOpen(true)} size="sm" variant="outline">
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
            <DrawerDescription>Complete each step in order: create the bot, upload knowledge, then test it.</DrawerDescription>
          </DrawerHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
              <NewBotStepRail
                activeStep={activeStep}
                completedSteps={completedSteps}
                maxUnlockedStepIndex={maxUnlockedStepIndex}
                onSelect={selectStep}
              />
              {error && <AlertCallout title="Request failed" description={error} variant="destructive" />}
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

const newBotSteps: Array<{ key: NewBotStepKey; title: string; description: string }> = [
  { key: "create", title: "Setup", description: "Create the bot and add its first source documents." },
  { key: "test", title: "Test", description: "Ask a representative visitor question before using it." },
  { key: "finish", title: "Finish", description: "Review the setup and return to the content page." },
]

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
          const isActive = step.key === "create" ? activeStep === "create" || activeStep === "knowledge" : activeStep === step.key
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
                  isComplete ? "border-transparent bg-primary text-primary-foreground" : "border-border bg-background"
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

function CapabilityPicker({ disabled = false, value, onChange }: { disabled?: boolean; value: string[]; onChange: (value: string[]) => void }) {
  return (
    <Field>
      <FieldLabel>Capabilities</FieldLabel>
      <ToggleGroup
        className="grid w-full grid-cols-2 gap-2"
        disabled={disabled}
        multiple
        value={value}
        variant="outline"
        onValueChange={onChange}
      >
        {capabilityOptions.map((option) => {
          const selected = value.includes(option.value)
          return (
            <ToggleGroupItem
              aria-label={option.label}
              className="h-10 min-w-0 justify-start gap-2 rounded-full px-3"
              disabled={disabled}
              key={option.value}
              value={option.value}
            >
              <span className="flex size-4 shrink-0 items-center justify-center rounded-full border border-border">
                {selected && <Check />}
              </span>
              <span className="truncate">{option.label}</span>
            </ToggleGroupItem>
          )
        })}
      </ToggleGroup>
    </Field>
  )
}

const capabilityOptions = [
  { value: "faq", label: "FAQ answers" },
  { value: "leadCapture", label: "Lead capture" },
  { value: "appointmentBooking", label: "Appointment booking" },
  { value: "propertyRecommendations", label: "Property recommendations" },
]

function GettingStarted({ onCreated }: { onCreated: (project: Project, chatbot: Chatbot) => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Create project</CardTitle>
        <CardAction><CreateWorkspaceButton onCreated={onCreated} /></CardAction>
      </CardHeader>
    </Card>
  )
}

function ProjectNeedsChatbot({ onBackToProjects, onCreated, project }: { project: Project; onBackToProjects: () => void; onCreated: (chatbot: Chatbot) => void }) {
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
        <Button variant="outline" onClick={onBackToProjects}>Back to projects</Button>
      </CardFooter>
    </Card>
  )
}

function ContentView({
  chatbots,
  chatbotId,
  onChatbotSelected,
  onChatbotCreated,
  onChatbotDeleted,
  onChatbotUpdated,
  project,
}: {
  chatbots: Chatbot[]
  chatbotId: string
  onChatbotSelected: (chatbotId: string) => void
  onChatbotCreated: (chatbot: Chatbot) => void
  onChatbotDeleted: (chatbotId: string) => void
  onChatbotUpdated: (chatbot: Chatbot) => void
  project: Project | null
}) {
  const [items, setItems] = useState<ContentItem[]>([])
  const [sources, setSources] = useState<KnowledgeSource[]>([])
  const [contentByChatbotId, setContentByChatbotId] = useState<Record<string, ContentItem[]>>({})
  const [query, setQuery] = useState("")
  const [searchExpanded, setSearchExpanded] = useState(false)
  const [statusFilter, setStatusFilter] = useState("all")
  const [, setMessage] = useState("")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailItemId, setDetailItemId] = useState<string | null>(null)
  const [detailTestMessage, setDetailTestMessage] = useState("What should this chatbot answer?")
  const [detailAnswer, setDetailAnswer] = useState<ChatAnswer | null>(null)
  const [detailTesting, setDetailTesting] = useState(false)
  const [confirmingChatbotAction, setConfirmingChatbotAction] = useState<{ type: "archive" | "unarchive" | "delete"; chatbot: Chatbot } | null>(null)
  const [form, setForm] = useState({ title: "", body: "", contentType: "general" })
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const searchOpen = searchExpanded || query.length > 0

  const selectedChatbot = chatbots.find((chatbot) => chatbot.id === chatbotId) ?? null
  const selectedCapabilities = selectedChatbot ? getSelectedCapabilityLabels(selectedChatbot.capabilities) : []
  const selectedItems = contentByChatbotId[chatbotId] ?? items
  const visibleChatbots = chatbots.filter((chatbot) => {
    const chatbotItems = chatbot.id === chatbotId ? selectedItems : contentByChatbotId[chatbot.id] ?? []
    const capabilities = getSelectedCapabilityLabels(chatbot.capabilities)
    const searchText = `${chatbot.name} ${chatbot.purpose} ${capabilities.join(" ")} ${chatbotItems.map((item) => `${item.title} ${item.body}`).join(" ")}`
    const matchesQuery = !query.trim() || searchText.toLowerCase().includes(query.trim().toLowerCase())
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "published" && chatbotItems.some((item) => item.status === "published")) ||
      (statusFilter === "draft" && chatbotItems.some((item) => item.status !== "published"))
    return matchesQuery && matchesStatus
  })

  async function refreshContent() {
    const response = await api<{ items: ContentItem[] }>(`/admin/chatbots/${chatbotId}/content`)
    setItems(response.items)
    setContentByChatbotId((current) => ({ ...current, [chatbotId]: response.items }))
  }

  async function refreshKnowledge() {
    const response = await api<{ items: KnowledgeSource[] }>(`/admin/chatbots/${chatbotId}/knowledge`)
    setSources(response.items)
  }

  async function refreshAll() {
    await Promise.all([refreshContent(), refreshKnowledge()])
  }

  useEffect(() => {
    let cancelled = false
    void Promise.all([
      api<{ items: ContentItem[] }>(`/admin/chatbots/${chatbotId}/content`),
      api<{ items: KnowledgeSource[] }>(`/admin/chatbots/${chatbotId}/knowledge`),
    ])
      .then(([contentResponse, knowledgeResponse]) => {
        if (cancelled) return
        setDetailItemId(null)
        setDetailAnswer(null)
        setEditingId(null)
        setEditorOpen(false)
        setItems(contentResponse.items)
        setSources(knowledgeResponse.items)
        setContentByChatbotId((current) => ({ ...current, [chatbotId]: contentResponse.items }))
      })
      .catch((apiError) => {
        if (!cancelled) setError(getErrorMessage(apiError))
      })
    return () => {
      cancelled = true
    }
  }, [chatbotId])

  useEffect(() => {
    let cancelled = false
    if (chatbots.length === 0) {
      return () => {
        cancelled = true
      }
    }
    void Promise.all(
      chatbots.map(async (chatbot) => {
        const response = await api<{ items: ContentItem[] }>(`/admin/chatbots/${chatbot.id}/content`)
        return [chatbot.id, response.items] as const
      }),
    )
      .then((entries) => {
        if (cancelled) return
        setContentByChatbotId(Object.fromEntries(entries))
      })
      .catch((apiError) => {
        if (!cancelled) setError(getErrorMessage(apiError))
      })
    return () => {
      cancelled = true
    }
  }, [chatbots])

  useEffect(() => {
    if (!searchExpanded) return
    searchInputRef.current?.focus()
  }, [searchExpanded])

  function startNewDraft() {
    setEditingId(null)
    setMessage("")
    setError("")
    setForm({ title: "", body: "", contentType: "general" })
    setEditorOpen(true)
  }

  function edit(item: ContentItem) {
    setEditingId(item.id)
    setDetailItemId(null)
    setMessage("")
    setError("")
    setForm({ title: item.title, body: item.body, contentType: item.contentType })
    setEditorOpen(true)
  }

  function openChatbotDetails(chatbot: Chatbot, item?: ContentItem) {
    onChatbotSelected(chatbot.id)
    setDetailItemId(item?.id ?? null)
    setDetailOpen(true)
    setDetailAnswer(null)
    setDetailTestMessage(item?.title ?? `What can ${chatbot.name} help with?`)
  }

  function closeEditor() {
    setEditorOpen(false)
    setEditingId(null)
    setForm({ title: "", body: "", contentType: "general" })
  }

  async function archiveChatbot(chatbot: Chatbot) {
    setSaving(true)
    setError("")
    try {
      const response = await api<{ chatbot: Chatbot }>(`/admin/chatbots/${chatbot.id}/archive`, { method: "POST" })
      onChatbotUpdated(response.chatbot)
      onChatbotSelected(response.chatbot.id)
      setDetailOpen(false)
      setConfirmingChatbotAction(null)
    } catch (apiError) {
      setError(getErrorMessage(apiError))
    } finally {
      setSaving(false)
    }
  }

  async function unarchiveChatbot(chatbot: Chatbot) {
    setSaving(true)
    setError("")
    try {
      const response = await api<{ chatbot: Chatbot }>(`/admin/chatbots/${chatbot.id}/unarchive`, { method: "POST" })
      onChatbotUpdated(response.chatbot)
      onChatbotSelected(response.chatbot.id)
      setConfirmingChatbotAction(null)
    } catch (apiError) {
      setError(getErrorMessage(apiError))
    } finally {
      setSaving(false)
    }
  }

  async function deleteChatbot(chatbot: Chatbot) {
    setSaving(true)
    setError("")
    try {
      await api<{ chatbot: Chatbot }>(`/admin/chatbots/${chatbot.id}`, { method: "DELETE" })
      setDetailOpen(false)
      setConfirmingChatbotAction(null)
      onChatbotDeleted(chatbot.id)
    } catch (apiError) {
      setError(getErrorMessage(apiError))
    } finally {
      setSaving(false)
    }
  }

  async function saveContent() {
    setSaving(true)
    setError("")
    try {
      const path = editingId ? `/admin/chatbots/${chatbotId}/content/${editingId}` : `/admin/chatbots/${chatbotId}/content`
      const response = await api<{ item: ContentItem }>(path, {
        method: editingId ? "PATCH" : "POST",
        body: form,
      })
      setMessage(`${editingId ? "Draft updated" : "Draft saved"}: ${response.item.title}`)
      closeEditor()
      await refreshContent()
    } catch (apiError) {
      setError(getErrorMessage(apiError))
    } finally {
      setSaving(false)
    }
  }

  async function publish(id: string, afterPublish?: "details", targetChatbotId = chatbotId) {
    setSaving(true)
    setError("")
    try {
      const response = await api<{ chunkCount: number }>(`/admin/chatbots/${targetChatbotId}/content/${id}/publish`, { method: "POST" })
      setMessage(`Published: ${response.chunkCount} chunk(s) indexed.`)
      if (targetChatbotId === chatbotId) {
        await refreshAll()
      } else {
        const contentResponse = await api<{ items: ContentItem[] }>(`/admin/chatbots/${targetChatbotId}/content`)
        setContentByChatbotId((current) => ({ ...current, [targetChatbotId]: contentResponse.items }))
      }
      if (afterPublish === "details") setDetailItemId(id)
    } catch (apiError) {
      setError(getErrorMessage(apiError))
    } finally {
      setSaving(false)
    }
  }

  async function deleteContent(item: ContentItem) {
    setSaving(true)
    setError("")
    try {
      await api<{ item: ContentItem }>(`/admin/chatbots/${chatbotId}/content/${item.id}`, { method: "DELETE" })
      if (detailItemId === item.id) setDetailItemId(null)
      if (editingId === item.id) closeEditor()
      setMessage(`Deleted: ${item.title}`)
      await refreshAll()
    } catch (apiError) {
      setError(getErrorMessage(apiError))
    } finally {
      setSaving(false)
    }
  }

  async function uploadDocuments(files: FileList | null) {
    if (!files?.length) return
    setSaving(true)
    setError("")
    setMessage("")
    let uploaded = 0
    try {
      for (const file of Array.from(files)) {
        const body = (await file.text()).trim()
        if (!body) continue
        const title = cleanFileTitle(file.name)
        await api<{ item: ContentItem }>(`/admin/chatbots/${chatbotId}/content`, {
          method: "POST",
          body: {
            title,
            body: body.slice(0, 50000),
            contentType: inferContentType(file.name),
          },
        })
        uploaded += 1
      }
      setMessage(uploaded ? `${uploaded} document draft${uploaded === 1 ? "" : "s"} uploaded.` : "No readable document text found.")
      await refreshContent()
    } catch (apiError) {
      setError(getErrorMessage(apiError))
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ""
      setSaving(false)
    }
  }

  async function testFromDetails() {
    if (!detailTestMessage.trim()) return
    setDetailTesting(true)
    setError("")
    try {
      const response = await api<ChatAnswer>(`/admin/chatbots/${chatbotId}/test-message`, { method: "POST", body: { message: detailTestMessage } })
      setDetailAnswer(response)
    } catch (apiError) {
      setError(getErrorMessage(apiError))
    } finally {
      setDetailTesting(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-5">
      <div className="flex shrink-0 items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="truncate font-heading text-base font-medium">{project?.name ?? "Project"}</h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button onClick={startNewDraft}>
            <FilePlus2 data-icon="inline-start" />
            Add answer
          </Button>
          <Button variant="outline" disabled={saving} onClick={() => fileInputRef.current?.click()}>
            <Upload data-icon="inline-start" />
            Upload docs
          </Button>
        </div>
        <input
          ref={fileInputRef}
          className="hidden"
          type="file"
          multiple
          accept=".txt,.md,.markdown,.csv,.json,.html,.htm"
          onChange={(event) => void uploadDocuments(event.currentTarget.files)}
        />
      </div>

      <div className="min-h-0 flex-1">
        <Card className="h-full min-h-0 shadow-none">
          <CardHeader className="shrink-0">
            <CardTitle>Content</CardTitle>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center">
              <Tabs className="shrink-0 data-horizontal:flex-row sm:w-80" value={statusFilter} onValueChange={(value) => setStatusFilter(value ?? "all")}>
                <TabsList className="w-full" variant="default">
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="draft">Drafts</TabsTrigger>
                  <TabsTrigger value="published">Published</TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
                <div className={cn("transition-[width] duration-200 ease-out", searchOpen ? "w-full sm:w-80" : "w-fit")}>
                  {searchOpen ? (
                    <Input
                      aria-label="Search content"
                      onBlur={() => {
                        if (!query) setSearchExpanded(false)
                      }}
                      onChange={(event) => setQuery(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") {
                          setQuery("")
                          setSearchExpanded(false)
                        }
                      }}
                      placeholder="Search content"
                      ref={searchInputRef}
                      value={query}
                    />
                  ) : (
                    <Button className="rounded-full" onClick={() => setSearchExpanded(true)} size="sm" variant="outline">
                      <Search data-icon="inline-start" />
                      Search
                    </Button>
                  )}
                </div>
                <NewBotSetupButton
                  disabled={!project || project.status === "archived"}
                  onCreated={(chatbot) => {
                    onChatbotCreated(chatbot)
                  }}
                  onSetupChanged={(targetChatbotId) => {
                    if (targetChatbotId === chatbotId) void refreshAll()
                  }}
                  projectId={project?.id ?? ""}
                />
              </div>
            </div>
            {error && <AlertCallout title="Request failed" description={error} variant="destructive" />}
            {!selectedChatbot && (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>No chatbot selected</EmptyTitle>
                </EmptyHeader>
                <EmptyContent />
              </Empty>
            )}
            <div className="grid min-h-0 flex-1 content-start gap-3 overflow-y-auto pr-1 lg:grid-cols-2 2xl:grid-cols-3">
              {chatbots.length > 0 && visibleChatbots.length === 0 && <EmptyState title="No matching chatbot" body="Clear search or switch status." />}
              {visibleChatbots.map((chatbot) => {
                const chatbotItems = chatbot.id === chatbotId ? selectedItems : contentByChatbotId[chatbot.id] ?? []
                const chatbotPublishedItems = chatbotItems.filter((item) => item.status === "published")
                const chatbotDraftItems = chatbotItems.filter((item) => item.status !== "published")
                const chatbotCapabilities = getSelectedCapabilityLabels(chatbot.capabilities)
                const isArchived = chatbot.status === "archived"
                const isSelected = chatbot.id === chatbotId
                return (
                  <Card key={chatbot.id} className={cn("border", isSelected && "border-primary")} size="sm">
                    <CardHeader>
                      <CardTitle className="line-clamp-2">{chatbot.name}</CardTitle>
                      <CardDescription className="line-clamp-2">{chatbot.purpose}</CardDescription>
                      <CardAction className="flex items-center gap-1">
                        <Badge variant={chatbotPublishedItems.length > 0 ? "secondary" : "outline"}>{chatbot.status}</Badge>
                        <DropdownMenu>
                          <DropdownMenuTrigger render={<Button aria-label={`${chatbot.name} actions`} size="icon-sm" variant="ghost" />}>
                            <MoreHorizontal data-icon="inline-start" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuGroup>
                              <DropdownMenuItem onClick={() => openChatbotDetails(chatbot)}>
                                <SendHorizontal data-icon="inline-start" />
                                Test chat
                              </DropdownMenuItem>
                            </DropdownMenuGroup>
                            {chatbotDraftItems.length > 0 && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuGroup>
                                  <DropdownMenuItem disabled={saving} onClick={() => publish(chatbotDraftItems[0].id, undefined, chatbot.id)}>
                                    <CheckCircle2 data-icon="inline-start" />
                                    Publish first draft
                                  </DropdownMenuItem>
                                </DropdownMenuGroup>
                              </>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuGroup>
                              {isArchived ? (
                                <DropdownMenuItem disabled={saving} onClick={() => setConfirmingChatbotAction({ type: "unarchive", chatbot })}>
                                  <ArchiveRestore data-icon="inline-start" />
                                  Unarchive chatbot
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem disabled={saving} onClick={() => setConfirmingChatbotAction({ type: "archive", chatbot })}>
                                  <Archive data-icon="inline-start" />
                                  Archive chatbot
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuGroup>
                            <DropdownMenuSeparator />
                            <DropdownMenuGroup>
                              <DropdownMenuItem
                                disabled={!isArchived || saving}
                                variant="destructive"
                                onClick={() => setConfirmingChatbotAction({ type: "delete", chatbot })}
                              >
                                <Trash2 data-icon="inline-start" />
                                Delete chatbot
                              </DropdownMenuItem>
                            </DropdownMenuGroup>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </CardAction>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {chatbotCapabilities.length > 0 ? (
                          chatbotCapabilities.map((capability) => (
                            <Badge key={capability} variant="outline">
                              <Check data-icon="inline-start" />
                              {capability}
                            </Badge>
                          ))
                        ) : (
                          <Badge variant="outline">No capabilities selected</Badge>
                        )}
                      </div>
                      <div className="mt-3 flex flex-col gap-1 text-sm text-muted-foreground">
                        <div>{chatbotItems.length} source document{chatbotItems.length === 1 ? "" : "s"} attached.</div>
                        <div>{chatbotPublishedItems.length} published, {chatbotDraftItems.length} draft.</div>
                      </div>
                    </CardContent>
                    <Separator />
                    <CardFooter>
                      <Button className="w-full" size="sm" variant="outline" onClick={() => openChatbotDetails(chatbot)}>Details</Button>
                    </CardFooter>
                  </Card>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={Boolean(confirmingChatbotAction)} onOpenChange={(open) => { if (!open) setConfirmingChatbotAction(null) }}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmingChatbotAction?.type === "delete"
                ? "Delete chatbot?"
                : confirmingChatbotAction?.type === "unarchive"
                ? "Unarchive chatbot?"
                : "Archive chatbot?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmingChatbotAction?.type === "delete"
                ? `This permanently deletes "${confirmingChatbotAction.chatbot.name}" and its source documents. Chatbots must be archived before deletion.`
                : confirmingChatbotAction?.type === "unarchive"
                ? `Unarchive "${confirmingChatbotAction.chatbot.name}" to manage content and use it again.`
                : `Archive "${confirmingChatbotAction?.chatbot.name ?? "this chatbot"}" before deletion. You can unarchive it later.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {confirmingChatbotAction?.type === "delete" ? (
              <AlertDialogAction
                disabled={saving || confirmingChatbotAction.chatbot.status !== "archived"}
                variant="destructive"
                onClick={() => void deleteChatbot(confirmingChatbotAction.chatbot)}
              >
                Delete chatbot
              </AlertDialogAction>
            ) : confirmingChatbotAction?.type === "unarchive" ? (
              <AlertDialogAction disabled={saving} onClick={() => void unarchiveChatbot(confirmingChatbotAction.chatbot)}>
                Unarchive chatbot
              </AlertDialogAction>
            ) : (
              <AlertDialogAction disabled={saving || !confirmingChatbotAction} onClick={() => { if (confirmingChatbotAction) void archiveChatbot(confirmingChatbotAction.chatbot) }}>
                Archive chatbot
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Drawer direction="right" open={detailOpen} onOpenChange={(open) => { setDetailOpen(open); if (!open) setDetailItemId(null) }}>
        <DrawerContent className="data-[vaul-drawer-direction=right]:w-[min(980px,100vw)] data-[vaul-drawer-direction=right]:sm:max-w-none">
          <DrawerHeader>
            <DrawerTitle>{selectedChatbot?.name ?? "Chatbot details"}</DrawerTitle>
            <DrawerDescription className="sr-only">Chatbot details, content structure, and chatbot test.</DrawerDescription>
          </DrawerHeader>
          {selectedChatbot && (
            <div className="grid min-h-0 flex-1 gap-5 overflow-hidden px-4 pb-4 lg:grid-cols-2">
              <div className="flex min-h-0 flex-col gap-4 overflow-y-auto pr-1">
                <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/60 p-4">
                  <div className="font-heading text-base font-medium">Chatbot information</div>
                  <FieldGroup>
                    <Field>
                      <FieldLabel>Name</FieldLabel>
                      <Input readOnly value={selectedChatbot.name} />
                    </Field>
                    <Field>
                      <FieldLabel>Purpose</FieldLabel>
                      <Textarea readOnly className="min-h-24" value={selectedChatbot.purpose} />
                    </Field>
                    <Field>
                      <FieldLabel>Capabilities</FieldLabel>
                      <div className="grid grid-cols-2 gap-2">
                        {selectedCapabilities.length > 0 ? (
                          selectedCapabilities.map((capability) => (
                            <Badge key={capability} className="justify-start" variant="outline">
                              <Check data-icon="inline-start" />
                              {capability}
                            </Badge>
                          ))
                        ) : (
                          <Badge className="justify-start" variant="outline">No capabilities selected</Badge>
                        )}
                      </div>
                    </Field>
                  </FieldGroup>
                </div>

                <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/60 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-heading text-base font-medium">Content structure</div>
                    <Button size="sm" variant="outline" disabled={saving} onClick={() => fileInputRef.current?.click()}>
                      <Upload data-icon="inline-start" />
                      Upload docs
                    </Button>
                  </div>
                  <div className="flex flex-col gap-2">
                    {items.length === 0 && <EmptyState title="No source documents yet" body="Upload docs or add an approved answer to give this bot knowledge." />}
                    {items.map((item) => {
                      const sourceHost = getContentSourceHost(item.body)
                      const displayTitle = getContentDisplayTitle(item, sourceHost)
                      const itemSources = sources.filter((source) => source.contentItemId === item.id || (!source.contentItemId && source.title === item.title))
                      return (
                      <div key={item.id} className={cn("rounded-2xl border border-border/60 px-4 py-3", detailItemId === item.id && "bg-muted")}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate font-medium">{displayTitle}</div>
                            <div className="line-clamp-2 text-sm text-muted-foreground">{getContentSummary(item.body)}</div>
                          </div>
                          <Badge variant={item.status === "published" ? "secondary" : "outline"}>{item.status}</Badge>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Badge variant="outline">{contentTypeOptions.find((option) => option.value === item.contentType)?.label ?? item.contentType}</Badge>
                          {sourceHost && <Badge variant="outline">{sourceHost}</Badge>}
                          {itemSources.length > 0 && <Badge variant="outline">{itemSources.reduce((total, source) => total + source.chunkCount, 0)} chunks</Badge>}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => edit(item)}>Edit</Button>
                          <Button size="sm" disabled={item.status === "published" || saving} onClick={() => publish(item.id)}>
                            <CheckCircle2 data-icon="inline-start" />
                            Publish
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger render={<Button disabled={saving} size="sm" variant="outline" />}>
                              <Trash2 data-icon="inline-start" />
                              Delete
                            </AlertDialogTrigger>
                            <AlertDialogContent size="sm">
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete content?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This removes "{item.title}" from the content library and from chatbot knowledge.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction disabled={saving} variant="destructive" onClick={() => void deleteContent(item)}>
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    )})}
                  </div>
                </div>
              </div>

              <div className="flex min-h-0 flex-col gap-4 overflow-y-auto pr-1">
                <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/60 p-4">
                  <div className="font-heading text-base font-medium">Test chatbot</div>
                  <Textarea className="min-h-24" value={detailTestMessage} onChange={(event) => setDetailTestMessage(event.target.value)} />
                  <Button disabled={!detailTestMessage.trim() || detailTesting} onClick={testFromDetails}>
                    <SendHorizontal data-icon="inline-start" />
                    {detailTesting ? "Testing..." : "Ask"}
                  </Button>
                  {detailAnswer && (
                    <div className="rounded-2xl border border-border/60 px-4 py-3">
                      <div className="whitespace-pre-wrap text-sm">{detailAnswer.answer}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </DrawerContent>
      </Drawer>

      <Drawer direction="right" open={editorOpen} onOpenChange={(open) => { if (open) setEditorOpen(true); else closeEditor() }}>
        <DrawerContent className="data-[vaul-drawer-direction=right]:w-[min(520px,100vw)] data-[vaul-drawer-direction=right]:sm:max-w-none">
          <DrawerHeader>
            <DrawerTitle>{editingId ? "Edit draft" : "New draft"}</DrawerTitle>
            <DrawerDescription>Only verified copy should be published to chatbot knowledge.</DrawerDescription>
          </DrawerHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4">
            <FieldGroup>
              <Field>
                <FieldLabel>Title</FieldLabel>
                <Input placeholder="Example: Marina Heights pet policy" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
              </Field>
              <Field>
                <FieldLabel>Information type</FieldLabel>
                <Select items={contentTypeOptions} value={form.contentType} onValueChange={(value) => setForm((current) => ({ ...current, contentType: String(value) }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {contentTypeOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Approved answer</FieldLabel>
                <Textarea className="min-h-60" placeholder="Write the exact answer the chatbot can reuse..." value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} />
              </Field>
            </FieldGroup>
          </div>
          <DrawerFooter>
            <div className="flex flex-wrap gap-2">
              <Button disabled={!form.title || !form.body || saving} onClick={saveContent}>{editingId ? "Update" : "Save draft"}</Button>
              <Button variant="outline" onClick={() => setForm(sampleContent)}>Use sample</Button>
              <Button variant="ghost" onClick={closeEditor}>Cancel</Button>
            </div>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  )
}

function ConnectView({ chatbotId }: { chatbotId: string }) {
  const [connectors, setConnectors] = useState<Connector[]>([])
  const [deployment, setDeployment] = useState<Deployment | null>(null)
  const [allowedDomainsText, setAllowedDomainsText] = useState("")
  const [websiteUrl, setWebsiteUrl] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [savingDomains, setSavingDomains] = useState(false)
  const [updatingConnector, setUpdatingConnector] = useState("")
  const [verifying, setVerifying] = useState(false)

  useEffect(() => {
    let cancelled = false
    void api<{ connectors: Connector[]; deployment: Deployment }>(`/admin/chatbots/${chatbotId}/connectors`)
      .then((response) => {
        if (cancelled) return
        setConnectors(response.connectors)
        setDeployment(response.deployment)
        setAllowedDomainsText(response.deployment.allowedDomains.join(", "))
        setWebsiteUrl(response.deployment.allowedDomains[0] ? `https://${response.deployment.allowedDomains[0]}` : "")
      })
      .catch((apiError) => {
        if (!cancelled) setError(getErrorMessage(apiError))
      })
    return () => {
      cancelled = true
    }
  }, [chatbotId])

  async function copySnippet() {
    if (!deployment) return
    await navigator.clipboard.writeText(deployment.installSnippet)
    setMessage("Website embed snippet copied.")
  }

  async function saveAllowedDomains() {
    setSavingDomains(true)
    setError("")
    try {
      const allowedDomains = allowedDomainsText
        .split(/[\n,]/)
        .map((domain) => domain.trim())
        .filter(Boolean)
      const response = await api<{ deployment: Deployment }>(`/admin/chatbots/${chatbotId}/connectors/website`, {
        method: "PATCH",
        body: { allowedDomains },
      })
      setDeployment(response.deployment)
      setAllowedDomainsText(response.deployment.allowedDomains.join(", "))
      setWebsiteUrl(response.deployment.allowedDomains[0] ? `https://${response.deployment.allowedDomains[0]}` : websiteUrl)
      setMessage("Allowed website domains saved.")
    } catch (apiError) {
      setError(getErrorMessage(apiError))
    } finally {
      setSavingDomains(false)
    }
  }

  async function verifyInstall() {
    if (!deployment || !websiteUrl) return
    setVerifying(true)
    setError("")
    try {
      const response = await api<{ verified: boolean; deployment: Deployment }>(`/admin/chatbots/${chatbotId}/connectors/website/verify`, {
        method: "POST",
        body: { websiteUrl },
      })
      setDeployment(response.deployment)
      setMessage(response.verified ? "Website widget install verified." : "Snippet was not found on that page yet.")
    } catch (apiError) {
      setError(getErrorMessage(apiError))
    } finally {
      setVerifying(false)
    }
  }

  async function updateConnectorStatus(channel: Connector["channel"], status: string) {
    setUpdatingConnector(channel)
    setError("")
    try {
      const response = await api<{ connector: Connector }>(`/admin/chatbots/${chatbotId}/connectors/${channel}/status`, {
        method: "PATCH",
        body: { status },
      })
      setConnectors((current) => current.map((connector) => connector.id === response.connector.id ? response.connector : connector))
      setMessage(`${response.connector.displayName} is ${response.connector.status.replace(/_/g, " ")}.`)
    } catch (apiError) {
      setError(getErrorMessage(apiError))
    } finally {
      setUpdatingConnector("")
    }
  }

  const websiteConnector = connectors.find((connector) => connector.channel === "website")
  const domainsConfigured = Boolean(deployment?.allowedDomains.length)

  return (
    <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
      <Card>
        <CardHeader>
          <CardTitle>Website connector</CardTitle>
          <CardDescription>Install this snippet on the business website to load the chatbot widget.</CardDescription>
          <CardAction><Badge variant={websiteConnector?.status === "active" ? "default" : "outline"}>{websiteConnector?.status.replace(/_/g, " ") ?? "Website first"}</Badge></CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {error && <AlertCallout title="Request failed" description={error} variant="destructive" />}
          {message && <AlertCallout title="Done" description={message} />}
          {!domainsConfigured && (
            <AlertCallout
              title="Website domain required"
              description="Add at least one allowed domain before installing the widget. Public chat stays blocked until this is saved."
              variant="destructive"
            />
          )}
          <FieldGroup>
            <Field>
              <FieldLabel>Public key</FieldLabel>
              <Input readOnly value={deployment?.publicKey ?? ""} />
            </Field>
            <Field>
              <FieldLabel>Allowed website domains</FieldLabel>
              <Textarea
                className="min-h-20"
                placeholder="business.example, www.business.example"
                value={allowedDomainsText}
                onChange={(event) => setAllowedDomainsText(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel>Install snippet</FieldLabel>
              <Textarea readOnly className="min-h-28 font-mono text-xs" value={deployment?.installSnippet ?? ""} />
            </Field>
            <Field>
              <FieldLabel>Website URL to verify</FieldLabel>
              <Input placeholder="https://business.example" value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} />
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter className="flex-wrap gap-2">
          <Button disabled={!deployment} onClick={copySnippet}>
            <Clipboard data-icon="inline-start" />
            Copy snippet
          </Button>
          <Button disabled={!deployment || savingDomains} variant="outline" onClick={saveAllowedDomains}>{savingDomains ? "Saving..." : "Save domains"}</Button>
          <Button disabled={!deployment || !domainsConfigured || !websiteUrl || verifying} variant="outline" onClick={verifyInstall}>{verifying ? "Verifying..." : "Verify install"}</Button>
          {websiteConnector?.status === "active" ? (
            <Button disabled={updatingConnector === "website"} variant="outline" onClick={() => updateConnectorStatus("website", "paused")}>
              {updatingConnector === "website" ? "Updating..." : "Pause widget"}
            </Button>
          ) : (
            <Button disabled={updatingConnector === "website"} variant="outline" onClick={() => updateConnectorStatus("website", "active")}>
              {updatingConnector === "website" ? "Updating..." : "Activate widget"}
            </Button>
          )}
        </CardFooter>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Channel connectors</CardTitle>
          <CardDescription>Website is ready. WhatsApp and Instagram can be plugged in later for the same chatbot.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {connectors.map((connector) => (
            <AspectRatio key={connector.id} ratio={7 / 3} className="min-h-32">
              <Card size="sm" className="h-full shadow-none">
                <CardHeader>
                  <CardTitle>{connector.displayName}</CardTitle>
                  <CardDescription>{channelDescription(connector.channel)}</CardDescription>
                  <CardAction><Badge variant={connector.status === "active" ? "default" : "outline"}>{connector.status.replace(/_/g, " ")}</Badge></CardAction>
                </CardHeader>
                <CardContent className="flex gap-2">
                  {connector.channel !== "website" && (
                    <Button
                      disabled={updatingConnector === connector.channel}
                      size="sm"
                      variant="outline"
                      onClick={() => updateConnectorStatus(connector.channel, connector.status === "paused" ? "needs_credentials" : "paused")}
                    >
                      {connector.status === "paused" ? "Resume setup" : "Pause"}
                    </Button>
                  )}
                </CardContent>
              </Card>
            </AspectRatio>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function EmptyState(props: { title: string; body?: string }) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>{props.title}</EmptyTitle>
        {props.body && <EmptyDescription>{props.body}</EmptyDescription>}
      </EmptyHeader>
      <EmptyContent />
    </Empty>
  )
}

function AlertCallout(props: { title: string; description: string; variant?: "default" | "destructive" }) {
  return (
    <Alert variant={props.variant ?? "default"}>
      <AlertTitle>{props.title}</AlertTitle>
      <AlertDescription>{props.description}</AlertDescription>
    </Alert>
  )
}

class ApiError extends Error {
  readonly code: string
  readonly status: number

  constructor(message: string, code: string, status: number) {
    super(message)
    this.name = "ApiError"
    this.code = code
    this.status = status
  }
}

async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = {}
  const adminApiKey = readAdminApiKey()
  if (adminApiKey) headers["x-khanect-admin-api-key"] = adminApiKey
  if (options.body) headers["content-type"] = "application/json"

  const response = await fetch(`${apiBase}${path}`, {
    method: options.method ?? "GET",
    headers: Object.keys(headers).length > 0 ? headers : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  const text = await response.text()
  const parsed = text ? tryParseJson(text) : null
  if (!response.ok) {
    const apiError = parsed && typeof parsed === "object" && "error" in parsed ? parseApiError(parsed.error, response.status) : new ApiError(`API ${response.status}`, "REQUEST_ERROR", response.status)
    if (apiError.code === "ADMIN_AUTH_REQUIRED" && typeof window !== "undefined") {
      window.localStorage.removeItem(adminApiKeyStorageKey)
      window.dispatchEvent(new CustomEvent("khanect-admin-auth-required"))
    }
    throw apiError
  }
  return parsed as T
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function getApiErrorMessage(error: unknown) {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message
  return "Request failed"
}

function parseApiError(error: unknown, status: number) {
  const message = getApiErrorMessage(error)
  const code = error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : "REQUEST_ERROR"
  return new ApiError(message, code, status)
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Check API and try again."
}

function isAdminAuthError(error: unknown) {
  return error instanceof ApiError && error.code === "ADMIN_AUTH_REQUIRED"
}

function readAdminApiKey() {
  if (typeof window === "undefined") return ""
  return window.localStorage.getItem(adminApiKeyStorageKey) ?? ""
}

function cleanFileTitle(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim() || "Uploaded document"
}

function inferContentType(fileName: string) {
  const name = fileName.toLowerCase()
  if (name.endsWith(".csv") || name.endsWith(".json")) return "property"
  if (name.includes("policy") || name.includes("rule")) return "policy"
  if (name.includes("area") || name.includes("guide")) return "area"
  if (name.includes("project")) return "project"
  return "general"
}

function getContentDisplayTitle(item: ContentItem, sourceHost: string | null) {
  if (!isGenericDocumentTitle(item.title)) return item.title
  return sourceHost ? `Source document from ${sourceHost}` : "Uploaded source document"
}

function getContentSummary(body: string) {
  const meaningfulLine = body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !isSourceHeading(line) && !isBareUrl(line))

  return meaningfulLine ? truncateText(cleanSummaryLine(meaningfulLine), 140) : "Imported document draft. Open details to review and refine the answer."
}

function getContentSourceHost(body: string) {
  const sourceUrl = body.match(/https?:\/\/[^\s)>,]+/i)?.[0]
  if (!sourceUrl) return null
  try {
    return new URL(sourceUrl).hostname.replace(/^www\./, "")
  } catch {
    return null
  }
}

function isGenericDocumentTitle(title: string) {
  return /^doc\d+$/i.test(title.trim()) || /^document\s*\d+$/i.test(title.trim())
}

function isSourceHeading(line: string) {
  return /^#?\s*doc\d+$/i.test(line) || /^#?\s*doc\d+\s*>\s*source:/i.test(line) || /^>?\s*source:/i.test(line)
}

function isBareUrl(line: string) {
  return /^https?:\/\/\S+$/i.test(line)
}

function cleanSummaryLine(line: string) {
  return line.replace(/^>\s*/, "")
}

function truncateText(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value
}

function pageFromPath(pathname: string): Page {
  if (pathname.includes("/projects")) return "projects"
  if (pathname.includes("/settings")) return "settings"
  if (pathname.includes("/knowledge") || pathname.includes("/rag")) return "content"
  if (pathname.includes("/connect")) return "connect"
  return "content"
}

function capabilityPayload(capabilities: string[]) {
  return {
    faq: capabilities.includes("faq"),
    leadCapture: capabilities.includes("leadCapture"),
    appointmentBooking: capabilities.includes("appointmentBooking"),
    propertyRecommendations: capabilities.includes("propertyRecommendations"),
  }
}

function getSelectedCapabilityLabels(capabilities: ChatbotCapabilities) {
  return capabilityOptions
    .filter((option) => Boolean(capabilities[option.value as keyof ChatbotCapabilities]))
    .map((option) => option.label)
}

function channelDescription(channel: Connector["channel"]) {
  if (channel === "website") return "Embeddable website widget for the selected chatbot."
  if (channel === "whatsapp") return "Meta WhatsApp Business connector placeholder."
  return "Instagram DM connector placeholder."
}
