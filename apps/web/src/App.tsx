import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Kbd, KbdGroup } from "@workspace/ui/components/kbd"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
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
  SidebarGroup,
  SidebarGroupContent,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@workspace/ui/components/sidebar"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group"
import { cn } from "@workspace/ui/lib/utils"
import {
  Building2,
  LogOut,
  Monitor,
  Moon,
  Palette,
  PanelLeft,
  Search,
  Settings as SettingsIcon,
  Sun,
} from "lucide-react"
import { type CSSProperties, useEffect, useState } from "react"

import { useTheme } from "@/components/theme-provider"
import { AdminCommandPalette } from "@/features/admin/admin-command-palette"
import { AlertCallout } from "@/features/admin/components"
import { ConnectView } from "@/features/admin/connect-view"
import { ConversationsView } from "@/features/admin/conversations-view"
import { ContentView } from "@/features/admin/content-view"
import { navItems } from "@/features/admin/constants"
import {
  GettingStarted,
  ProjectNeedsChatbot,
  ProjectsView,
} from "@/features/admin/projects-view"
import { SettingsView } from "@/features/admin/settings-view"
import type {
  Chatbot,
  Page,
  Project,
  ThemePreference,
} from "@/features/admin/types"
import { WorkspaceToolbar } from "@/features/admin/workspace-toolbar"
import { adminApiKeyStorageKey, api, getErrorMessage } from "@/lib/api"
import { pageFromPath } from "@/lib/routes"

export function App() {
  const { theme, setTheme } = useTheme()
  const [page, setPage] = useState<Page>(() =>
    pageFromPath(window.location.pathname)
  )
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState("")
  const [chatbots, setChatbots] = useState<Chatbot[]>([])
  const [selectedChatbotId, setSelectedChatbotId] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [commandOpen, setCommandOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [brandToggleVisible, setBrandToggleVisible] = useState(false)

  const selectedProject =
    projects.find((project) => project.id === selectedProjectId) ?? null
  const selectedChatbot =
    chatbots.find((chatbot) => chatbot.id === selectedChatbotId) ?? null
  const contentChatbot = selectedChatbot ?? chatbots[0] ?? null

  useEffect(() => {
    let cancelled = false
    void api<{ items: Project[] }>("/admin/projects")
      .then((response) => {
        if (cancelled) return
        setError("")
        setProjects(response.items)
        setSelectedProjectId(
          (current) => current || response.items[0]?.id || ""
        )
      })
      .catch((apiError) => {
        if (!cancelled) setError(getErrorMessage(apiError))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!selectedProjectId) return
    let cancelled = false
    void api<{ items: Chatbot[] }>(
      `/admin/projects/${selectedProjectId}/chatbots`
    )
      .then((response) => {
        if (cancelled) return
        setError("")
        setChatbots(response.items)
        setSelectedChatbotId((current) =>
          response.items.some((chatbot) => chatbot.id === current)
            ? current
            : response.items[0]?.id || ""
        )
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
    if (
      page === "projects" &&
      !window.location.pathname.includes("/projects")
    ) {
      window.history.replaceState(null, "", "/admin/projects")
    }
  }, [page])

  function navigate(next: Page) {
    window.history.pushState(null, "", `/admin/${next}`)
    setPage(next)
  }

  function signOut() {
    window.localStorage.removeItem(adminApiKeyStorageKey)
    setProjects([])
    setChatbots([])
    setSelectedProjectId("")
    setSelectedChatbotId("")
    setError("")
  }

  return (
    <div className="flex h-svh flex-col overflow-hidden bg-background text-foreground [--app-header-height:5rem]">
      <AdminCommandPalette
        open={commandOpen}
        onNavigate={navigate}
        onOpenChange={setCommandOpen}
      />

      <header className="flex h-[var(--app-header-height)] shrink-0 items-center border-b bg-background px-4 py-3 sm:px-6">
        <div className="flex w-full min-w-0 items-center justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div
              className="relative flex size-9 shrink-0 items-center justify-center rounded-xl border bg-muted"
              onMouseEnter={() => setBrandToggleVisible(true)}
              onMouseLeave={() => setBrandToggleVisible(false)}
            >
              <button
                aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
                className={cn(
                  "absolute inset-0 z-10 flex size-9 items-center justify-center rounded-xl opacity-0 transition-opacity outline-none focus-visible:ring-3 focus-visible:ring-ring/30 [&_svg]:size-4 [&_svg]:shrink-0",
                  brandToggleVisible && "opacity-100"
                )}
                title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
                type="button"
                onBlur={() => setBrandToggleVisible(false)}
                onClick={() => setSidebarOpen((open) => !open)}
                onFocus={() => setBrandToggleVisible(true)}
              >
                <PanelLeft aria-hidden="true" />
              </button>
              <Building2
                aria-hidden="true"
                className={cn(
                  "transition-opacity",
                  brandToggleVisible && "opacity-0"
                )}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                Khanect Omni Realty
              </p>
              <WorkspaceToolbar
                chatbots={chatbots}
                loading={loading}
                page={page}
                projects={projects}
                selectedChatbotId={selectedChatbotId}
                selectedProjectId={selectedProjectId}
                onChatbotChange={setSelectedChatbotId}
                onProjectChange={setSelectedProjectId}
              />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    aria-label="Open command palette"
                    className="h-9 gap-2"
                    size="sm"
                    variant="outline"
                    onClick={() => setCommandOpen(true)}
                  />
                }
              >
                <Search data-icon="inline-start" />
                <span className="hidden text-muted-foreground sm:inline">
                  Search
                </span>
                <KbdGroup className="hidden sm:flex">
                  <Kbd>⌘</Kbd>
                  <Kbd>K</Kbd>
                </KbdGroup>
              </TooltipTrigger>
              <TooltipContent>Jump to any admin page</TooltipContent>
            </Tooltip>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    aria-label="Account menu"
                    className="shrink-0 rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
                    type="button"
                  />
                }
              >
                <Avatar size="default">
                  <AvatarFallback>KO</AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => navigate("settings")}>
                    <SettingsIcon data-icon="inline-start" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={signOut}>
                    <LogOut data-icon="inline-start" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="flex items-center gap-2">
                    <Palette data-icon="inline-start" />
                    Theme
                  </DropdownMenuLabel>
                  <ToggleGroup
                    className="grid w-full grid-cols-3 px-1 pb-1"
                    size="sm"
                    spacing={0}
                    value={[theme as ThemePreference]}
                    variant="outline"
                    onValueChange={(values) => {
                      const nextTheme = values[0] as ThemePreference | undefined
                      if (nextTheme) setTheme(nextTheme)
                    }}
                  >
                    <ToggleGroupItem className="min-w-0" value="system">
                      <Monitor data-icon="inline-start" />
                      <span>System</span>
                    </ToggleGroupItem>
                    <ToggleGroupItem className="min-w-0" value="light">
                      <Sun data-icon="inline-start" />
                      <span>Light</span>
                    </ToggleGroupItem>
                    <ToggleGroupItem className="min-w-0" value="dark">
                      <Moon data-icon="inline-start" />
                      <span>Dark</span>
                    </ToggleGroupItem>
                  </ToggleGroup>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <SidebarProvider
        className="min-h-0 flex-1"
        open={sidebarOpen}
        style={
          {
            "--sidebar": "var(--background)",
            "--sidebar-width-icon": "4rem",
          } as CSSProperties
        }
        onOpenChange={setSidebarOpen}
      >
        <Sidebar
          className="top-[var(--app-header-height)] h-[calc(100svh-var(--app-header-height))] border-border bg-background text-foreground"
          collapsible="icon"
        >
          <SidebarContent className="p-4 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:p-2">
            <SidebarGroup className="p-0">
              <SidebarGroupContent>
                <SidebarMenu>
                  {navItems.map(({ key, label, icon: Icon }) => (
                    <SidebarMenuItem
                      key={key}
                      className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center"
                    >
                      <SidebarMenuButton
                        className="group-data-[collapsible=icon]:size-10! group-data-[collapsible=icon]:p-2.5! group-data-[collapsible=icon]:[&_svg]:size-5"
                        isActive={page === key}
                        tooltip={label}
                        onClick={() => navigate(key)}
                      >
                        <Icon data-icon="inline-start" />
                        <span>{label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <SidebarInset className="min-h-0">
          <main
            className={cn(
              "min-h-0 flex-1 p-4 sm:p-6",
              page === "content" ? "overflow-hidden" : "overflow-y-auto"
            )}
          >
            <section
              className={cn(
                "flex w-full flex-col gap-5",
                page === "content" ? "h-full min-h-0" : "min-h-full"
              )}
            >
              {error && (
                <AlertCallout
                  title="Request failed"
                  description={error}
                  variant="destructive"
                />
              )}
              {loading && (
                <Card>
                  <CardHeader>
                    <CardTitle>Loading workspace</CardTitle>
                    <CardDescription>
                      Preparing projects and chatbots.
                    </CardDescription>
                  </CardHeader>
                </Card>
              )}
              {!loading && page === "settings" && (
                <SettingsView
                  chatbots={chatbots}
                  project={selectedProject}
                  selectedChatbot={selectedChatbot}
                  onNavigate={navigate}
                />
              )}
              {!loading &&
                !contentChatbot &&
                page !== "projects" &&
                page !== "settings" &&
                page !== "conversations" &&
                (selectedProject ? (
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
                  <GettingStarted
                    onCreated={(project, chatbot) => {
                      setProjects((current) => [project, ...current])
                      setChatbots([chatbot])
                      setSelectedProjectId(project.id)
                      setSelectedChatbotId(chatbot.id)
                      navigate("content")
                    }}
                  />
                ))}
              {!loading && page === "projects" && (
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
                    setProjects((current) =>
                      current.map((item) =>
                        item.id === project.id ? project : item
                      )
                    )
                  }}
                  onProjectAiKeysUpdated={(projectId, aiKeys) => {
                    setProjects((current) =>
                      current.map((item) =>
                        item.id === projectId ? { ...item, aiKeys } : item
                      )
                    )
                  }}
                  onProjectDeleted={(projectId) => {
                    const remainingProjects = projects.filter(
                      (project) => project.id !== projectId
                    )
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
              {!loading &&
                contentChatbot &&
                page !== "projects" &&
                page !== "settings" && (
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
                          const remainingChatbots = chatbots.filter(
                            (chatbot) => chatbot.id !== deletedChatbotId
                          )
                          setChatbots(remainingChatbots)
                          if (selectedChatbotId === deletedChatbotId)
                            setSelectedChatbotId(remainingChatbots[0]?.id ?? "")
                        }}
                        onChatbotUpdated={(chatbot) => {
                          setChatbots((current) =>
                            current.map((item) =>
                              item.id === chatbot.id ? chatbot : item
                            )
                          )
                        }}
                        project={selectedProject}
                      />
                    )}
                    {page === "conversations" && (
                      <ConversationsView chatbotId={contentChatbot.id} />
                    )}
                    {page === "connect" && (
                      <ConnectView chatbotId={contentChatbot.id} />
                    )}
                  </>
                )}
            </section>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </div>
  )
}
