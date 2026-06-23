import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@workspace/ui/components/command"
import { Kbd, KbdGroup } from "@workspace/ui/components/kbd"
import { FileText, Globe2, Inbox, LayoutDashboard, Settings } from "lucide-react"
import { useEffect, useState } from "react"

import { navItems } from "./constants"
import type { Page } from "./types"

const commandItems: Array<{ page: Page; label: string; icon: typeof FileText; shortcut: string }> = [
  { page: "projects", label: "Projects", icon: LayoutDashboard, shortcut: "P" },
  { page: "content", label: "Content", icon: FileText, shortcut: "C" },
  { page: "conversations", label: "Inbox", icon: Inbox, shortcut: "I" },
  { page: "connect", label: "Connect", icon: Globe2, shortcut: "N" },
  { page: "settings", label: "Settings", icon: Settings, shortcut: "S" },
]

export function AdminCommandPalette({
  onNavigate,
  open: controlledOpen,
  onOpenChange,
}: {
  onNavigate: (page: Page) => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setOpen(!open)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, setOpen])

  return (
    <>
      <CommandDialog open={open} onOpenChange={setOpen} title="Command palette" description="Jump to admin pages">
        <Command>
          <CommandInput placeholder="Search pages..." />
          <CommandList>
            <CommandEmpty>No pages found.</CommandEmpty>
            <CommandGroup heading="Navigate">
              {commandItems.map((item) => {
                const Icon = item.icon
                const nav = navItems.find((entry) => entry.key === item.page)
                return (
                  <CommandItem
                    key={item.page}
                    value={`${item.label} ${nav?.label ?? ""}`}
                    onSelect={() => {
                      onNavigate(item.page)
                      setOpen(false)
                    }}
                  >
                    <Icon />
                    {item.label}
                    <CommandShortcut>{item.shortcut}</CommandShortcut>
                  </CommandItem>
                )
              })}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Shortcuts">
              <CommandItem disabled value="open-palette">
                Open command palette
                <CommandShortcut>
                  <KbdGroup>
                    <Kbd>⌘</Kbd>
                    <Kbd>K</Kbd>
                  </KbdGroup>
                </CommandShortcut>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}