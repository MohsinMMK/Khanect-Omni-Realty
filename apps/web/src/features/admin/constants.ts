import { Globe2, Inbox, LayoutDashboard, type LucideIcon } from "lucide-react"

import type { NewBotStepKey, Page } from "./types"

export const contentTypeOptions = [
  { value: "faq", label: "FAQ / common question" },
  { value: "property", label: "Property details" },
  { value: "project", label: "Project / development" },
  { value: "area", label: "Area guide" },
  { value: "policy", label: "Policy / rules" },
  { value: "general", label: "General note" },
]

export const navItems: Array<{ key: Page; label: string; icon: LucideIcon }> = [
  { key: "projects", label: "Projects", icon: LayoutDashboard },
  { key: "conversations", label: "Inbox", icon: Inbox },
  { key: "connect", label: "Connect", icon: Globe2 },
]

export const sampleContent = {
  title: "Marina Heights pet policy",
  contentType: "faq",
  body: "Marina Heights allows cats and small dogs. Pet owners must register pets with building management before move-in. The tower is a five-minute walk from Dubai Marina tram.",
}

export const newBotSteps: Array<{
  key: NewBotStepKey
  title: string
  description: string
}> = [
  {
    key: "create",
    title: "Setup",
    description: "Create the bot and add its first source documents.",
  },
  {
    key: "test",
    title: "Test",
    description: "Ask a representative visitor question before using it.",
  },
  {
    key: "finish",
    title: "Finish",
    description: "Review the setup and return to the content page.",
  },
]
