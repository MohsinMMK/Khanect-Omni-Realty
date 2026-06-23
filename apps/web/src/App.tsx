import { Button } from "@workspace/ui/components/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
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
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group"
import { cn } from "@workspace/ui/lib/utils"
import {
  Building2,
  ChevronUp,
  CircleUserRound,
  Monitor,
  Moon,
  Palette,
  Settings as SettingsIcon,
  Sun,
} from "lucide-react"
import { useEffect, useState } from "react"

import { useTheme } from "@/components/theme-provider"
import { AdminAccessPanel } from "@/features/admin/admin-access-panel"
import { AlertCallout } from "@/features/admin/components"
import { ConnectView } from "@/features/admin/connect-view"
import { ContentView } from "@/features/admin/content-view"
import { navItems } from "@/features/admin/constants"
import { GettingStarted, ProjectNeedsChatbot, ProjectsView } from "@/features/admin/projects-view"
import { SettingsView } from "@/features/admin/settings-view"
import type { Chatbot, Page, Project, ThemePreference } from "@/features/admin/types"
import { api, getErrorMessage, isAdminAuthError } from "@/lib/api"
import { pageFromPath } from "@/lib/routes"

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