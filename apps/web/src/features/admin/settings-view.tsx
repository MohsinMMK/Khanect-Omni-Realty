import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Textarea } from "@workspace/ui/components/textarea"
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group"
import { Building2, Bot, Clipboard, Globe2, KeyRound, LayoutDashboard, Monitor, Moon, ShieldCheck, Sun } from "lucide-react"
import { useState } from "react"

import { useTheme } from "@/components/theme-provider"
import { adminApiKeyStorageKey, readAdminApiKey } from "@/lib/api"
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