import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@workspace/ui/components/combobox"
import { cn } from "@workspace/ui/lib/utils"

import { navItems } from "./constants"
import type { Chatbot, Page, Project } from "./types"

type PickerOption = { id: string; label: string }
const pageLabels: Record<Page, string> = {
  projects: "Projects",
  content: "Workspace",
  connect: "Connect",
  conversations: "Inbox",
  settings: "Settings",
}

function toPickerOptions<T extends { id: string; name: string }>(
  items: T[]
): PickerOption[] {
  return items.map((item) => ({ id: item.id, label: item.name }))
}

function WorkspaceCombobox({
  className,
  disabled,
  items,
  onValueChange,
  placeholder,
  value,
}: {
  className?: string
  disabled?: boolean
  items: PickerOption[]
  onValueChange: (id: string) => void
  placeholder: string
  value: string
}) {
  const selected = items.find((item) => item.id === value) ?? null

  return (
    <Combobox
      disabled={disabled || items.length === 0}
      isItemEqualToValue={(a, b) => a.id === b.id}
      itemToStringValue={(item) => item.label}
      items={items}
      value={selected}
      onValueChange={(next) => {
        if (next) onValueChange(next.id)
      }}
    >
      <ComboboxInput
        className={cn("w-44", className)}
        placeholder={placeholder}
      />
      <ComboboxContent>
        <ComboboxEmpty>No matches.</ComboboxEmpty>
        <ComboboxList>
          {(item) => (
            <ComboboxItem key={item.id} value={item}>
              {item.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

export function WorkspaceToolbar({
  chatbots,
  loading,
  onChatbotChange,
  onProjectChange,
  page,
  projects,
  selectedChatbotId,
  selectedProjectId,
}: {
  chatbots: Chatbot[]
  loading: boolean
  onChatbotChange: (id: string) => void
  onProjectChange: (id: string) => void
  page: Page
  projects: Project[]
  selectedChatbotId: string
  selectedProjectId: string
}) {
  const pageLabel =
    navItems.find((item) => item.key === page)?.label ?? pageLabels[page]
  const selectedProject =
    projects.find((project) => project.id === selectedProjectId) ?? null
  const selectedChatbot =
    chatbots.find((chatbot) => chatbot.id === selectedChatbotId) ?? null
  const showChatbotPicker =
    page === "content" || page === "connect" || page === "conversations"
  const projectOptions = toPickerOptions(projects)
  const chatbotOptions = toPickerOptions(chatbots)

  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
      <Breadcrumb className="min-w-0">
        <BreadcrumbList>
          <BreadcrumbItem>
            <span className="text-muted-foreground">Admin</span>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            {page === "settings" ? (
              <BreadcrumbPage>Settings</BreadcrumbPage>
            ) : (
              <span className="text-muted-foreground">{pageLabel}</span>
            )}
          </BreadcrumbItem>
          {selectedProject && page !== "projects" && page !== "settings" && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {showChatbotPicker && selectedChatbot ? (
                  <span className="truncate text-muted-foreground">
                    {selectedProject.name}
                  </span>
                ) : (
                  <BreadcrumbPage>{selectedProject.name}</BreadcrumbPage>
                )}
              </BreadcrumbItem>
            </>
          )}
          {showChatbotPicker && selectedChatbot && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{selectedChatbot.name}</BreadcrumbPage>
              </BreadcrumbItem>
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-wrap items-center gap-2">
        <WorkspaceCombobox
          disabled={loading}
          items={projectOptions}
          placeholder="Select project"
          value={selectedProjectId}
          onValueChange={onProjectChange}
        />
        {showChatbotPicker && (
          <WorkspaceCombobox
            disabled={loading || !selectedProjectId}
            items={chatbotOptions}
            placeholder="Select chatbot"
            value={selectedChatbotId}
            onValueChange={onChatbotChange}
          />
        )}
      </div>
    </div>
  )
}
