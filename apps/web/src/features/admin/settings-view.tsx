import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Calendar } from "@workspace/ui/components/calendar"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@workspace/ui/components/collapsible"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Textarea } from "@workspace/ui/components/textarea"
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group"
import { Building2, Bot, ChevronDown, Clipboard, Globe2, KeyRound, LayoutDashboard, Monitor, Moon, ShieldCheck, Sun } from "lucide-react"
import { Progress } from "@workspace/ui/components/progress"
import { useState } from "react"

import { useTheme } from "@/components/theme-provider"
import { adminApiKeyStorageKey, readAdminApiKey } from "@/lib/api"
import { EmbeddingSettingsPanel } from "./embedding-settings-panel"
import type { Chatbot, Page, Project, ThemePreference } from "./types"

export function SettingsView({
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
  const [adminKey, setAdminKey] = useState(() => readAdminApiKey())
  const [adminKeySaved, setAdminKeySaved] = useState(() => Boolean(readAdminApiKey()))
  const themeValue = theme as ThemePreference
  const totalChatbots = chatbots.length
  const activeChatbots = chatbots.filter((chatbot) => chatbot.status === "active").length
  const archivedChatbots = totalChatbots - activeChatbots
  const activeShare = totalChatbots > 0 ? Math.round((activeChatbots / totalChatbots) * 100) : 0

  function saveAdminKey() {
    const trimmed = adminKey.trim()
    if (trimmed) {
      window.localStorage.setItem(adminApiKeyStorageKey, trimmed)
      setAdminKeySaved(true)
    } else {
      window.localStorage.removeItem(adminApiKeyStorageKey)
      setAdminKeySaved(false)
    }
  }

  function clearAdminKey() {
    setAdminKey("")
    window.localStorage.removeItem(adminApiKeyStorageKey)
    setAdminKeySaved(false)
  }

  return (
    <div className="flex flex-col gap-5">
      <Card className="xl:col-span-2">
        <CardHeader>
          <CardTitle>Project AI keys</CardTitle>
          <CardDescription>
            LLM and embedding credentials are configured per project so each business keeps separate API keys. Open a project card menu and choose AI keys.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button variant="outline" onClick={() => onNavigate("projects")}>
            <LayoutDashboard data-icon="inline-start" />
            Go to projects
          </Button>
        </CardFooter>
      </Card>

      <EmbeddingSettingsPanel />

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="flex flex-col gap-5">
          <Collapsible defaultOpen>
            <Card>
              <CollapsibleTrigger className="w-full text-left">
                <CardHeader className="flex-row items-center justify-between">
                  <div>
                    <CardTitle>Themes</CardTitle>
                    <CardDescription>Choose how the admin workspace renders on this device.</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{themeValue}</Badge>
                    <ChevronDown className="size-4 text-muted-foreground" />
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
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
              </CollapsibleContent>
            </Card>
          </Collapsible>

          <Collapsible defaultOpen>
            <Card>
              <CollapsibleTrigger className="w-full text-left">
                <CardHeader className="flex-row items-center justify-between">
                  <div>
                    <CardTitle>Admin access</CardTitle>
                    <CardDescription>Local browser access for production admin requests.</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={adminKeySaved ? "secondary" : "outline"}>{adminKeySaved ? "Saved" : "Not saved"}</Badge>
                    <ChevronDown className="size-4 text-muted-foreground" />
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="settings-admin-api-key">Admin API key</FieldLabel>
                      <Input
                        autoComplete="off"
                        id="settings-admin-api-key"
                        placeholder="Production admin API key"
                        type="password"
                        value={adminKey}
                        onChange={(event) => setAdminKey(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") saveAdminKey()
                        }}
                      />
                      <FieldDescription>
                        Sent as <code className="text-xs">x-khanect-admin-api-key</code> on admin API requests. Not required in local dev when the API allows the dev stub.
                      </FieldDescription>
                    </Field>
                  </FieldGroup>
                </CardContent>
                <CardFooter className="gap-2">
                  <Button disabled={!adminKey.trim()} onClick={saveAdminKey}>
                    <KeyRound data-icon="inline-start" />
                    Save key
                  </Button>
                  <Button disabled={!adminKeySaved} variant="outline" onClick={clearAdminKey}>
                    Clear saved key
                  </Button>
                </CardFooter>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </div>

        <div className="flex flex-col gap-5">
          <Collapsible defaultOpen>
            <Card>
              <CollapsibleTrigger className="w-full text-left">
                <CardHeader className="flex-row items-center justify-between">
                  <div>
                    <CardTitle>Workspace</CardTitle>
                    <CardDescription>Current project and assistant configuration.</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={project?.status === "active" ? "secondary" : "outline"}>{project?.status ?? "No project"}</Badge>
                    <ChevronDown className="size-4 text-muted-foreground" />
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
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
              </CollapsibleContent>
            </Card>
          </Collapsible>

          <Collapsible defaultOpen>
            <Card>
              <CollapsibleTrigger className="w-full text-left">
                <CardHeader className="flex-row items-center justify-between">
                  <div>
                    <CardTitle>Assistant overview</CardTitle>
                    <CardDescription>Knowledge and runtime status for the selected chatbot.</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{activeChatbots}/{totalChatbots} active</Badge>
                    <ChevronDown className="size-4 text-muted-foreground" />
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="flex flex-col gap-4">
                  <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-muted/30 p-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Active assistants</span>
                      <Badge variant="secondary">{activeChatbots}</Badge>
                    </div>
                    <Progress value={activeShare} />
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Archived assistants</span>
                      <Badge variant="outline">{archivedChatbots}</Badge>
                    </div>
                  </div>
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
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {selectedChatbot?.capabilities.appointmentBooking && (
            <Card>
              <CardHeader>
                <CardTitle>Appointment preview</CardTitle>
                <CardDescription>Calendar UI for appointment booking capability (scheduling backend not wired yet).</CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center">
                <Calendar className="rounded-2xl border" mode="single" />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}