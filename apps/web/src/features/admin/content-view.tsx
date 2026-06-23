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
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@workspace/ui/components/drawer"
import { Empty, EmptyContent, EmptyHeader, EmptyTitle } from "@workspace/ui/components/empty"
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { Textarea } from "@workspace/ui/components/textarea"
import { cn } from "@workspace/ui/lib/utils"
import {
  Archive,
  ArchiveRestore,
  CheckCircle2,
  FilePlus2,
  MoreHorizontal,
  Search,
  SendHorizontal,
  Trash2,
  Upload,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { api, getErrorMessage } from "@/lib/api"
import { capabilitiesToSelection, capabilityPayload, getSelectedCapabilityLabels } from "@/lib/capabilities"
import { cleanFileTitle, getContentDisplayTitle, getContentSourceHost, getContentSummary, inferContentType } from "@/lib/content-helpers"
import { AlertCallout, EmptyState } from "./components"
import { contentTypeOptions, sampleContent } from "./constants"
import { CapabilityPicker, NewBotSetupButton } from "./projects-view"
import type { ChatAnswer, Chatbot, ContentItem, KnowledgeSource, Project } from "./types"

const SKELETON_ROW_COUNT = 5

function ChatbotTableSkeleton() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Capabilities</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Drafts / Published</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: SKELETON_ROW_COUNT }).map((_, index) => (
          <TableRow key={index}>
            <TableCell><Skeleton className="h-5 w-36" /></TableCell>
            <TableCell><Skeleton className="h-5 w-48" /></TableCell>
            <TableCell><Skeleton className="h-5 w-20" /></TableCell>
            <TableCell><Skeleton className="h-5 w-28" /></TableCell>
            <TableCell className="text-right"><Skeleton className="ml-auto h-8 w-24" /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export function ContentView({
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailItemId, setDetailItemId] = useState<string | null>(null)
  const [detailTestMessage, setDetailTestMessage] = useState("What should this chatbot answer?")
  const [detailAnswer, setDetailAnswer] = useState<ChatAnswer | null>(null)
  const [detailTesting, setDetailTesting] = useState(false)
  const [detailForm, setDetailForm] = useState({ name: "", purpose: "", capabilities: [] as string[] })
  const [detailSaving, setDetailSaving] = useState(false)
  const [confirmingChatbotAction, setConfirmingChatbotAction] = useState<{ type: "archive" | "unarchive" | "delete"; chatbot: Chatbot } | null>(null)
  const [form, setForm] = useState({ title: "", body: "", contentType: "general" })
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const searchOpen = searchExpanded || query.length > 0

  const selectedChatbot = chatbots.find((chatbot) => chatbot.id === chatbotId) ?? null
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
    setLoading(true)
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
      .finally(() => {
        if (!cancelled) setLoading(false)
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
    setError("")
    setForm({ title: "", body: "", contentType: "general" })
    setEditorOpen(true)
  }

  function edit(item: ContentItem) {
    setEditingId(item.id)
    setDetailItemId(null)
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
    setDetailForm({
      name: chatbot.name,
      purpose: chatbot.purpose,
      capabilities: capabilitiesToSelection(chatbot.capabilities),
    })
  }

  const detailChatbot = chatbots.find((chatbot) => chatbot.id === chatbotId) ?? null
  const detailFormReady =
    detailForm.name.trim().length > 0 &&
    detailForm.purpose.trim().length > 0 &&
    detailForm.capabilities.length > 0
  const detailFormDirty =
    detailChatbot !== null &&
    (detailForm.name.trim() !== detailChatbot.name ||
      detailForm.purpose.trim() !== detailChatbot.purpose ||
      JSON.stringify([...detailForm.capabilities].sort()) !== JSON.stringify(capabilitiesToSelection(detailChatbot.capabilities).sort()))

  async function saveChatbotDetails() {
    if (!detailChatbot || !detailFormReady || detailChatbot.status === "archived") return
    setDetailSaving(true)
    setError("")
    try {
      const response = await api<{ chatbot: Chatbot }>(`/admin/chatbots/${detailChatbot.id}`, {
        method: "PATCH",
        body: {
          name: detailForm.name.trim(),
          purpose: detailForm.purpose.trim(),
          capabilities: capabilityPayload(detailForm.capabilities),
        },
      })
      onChatbotUpdated(response.chatbot)
      setDetailForm({
        name: response.chatbot.name,
        purpose: response.chatbot.purpose,
        capabilities: capabilitiesToSelection(response.chatbot.capabilities),
      })
      toast.success("Chatbot updated")
    } catch (apiError) {
      setError(getErrorMessage(apiError))
    } finally {
      setDetailSaving(false)
    }
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
      toast.success(`${editingId ? "Draft updated" : "Draft saved"}: ${response.item.title}`)
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
      toast.success(`Published: ${response.chunkCount} chunk(s) indexed.`)
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
      toast.success(`Deleted: ${item.title}`)
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
      if (uploaded) {
        toast.success(`${uploaded} document draft${uploaded === 1 ? "" : "s"} uploaded.`)
      } else {
        toast.error("No readable document text found.")
      }
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
            {!selectedChatbot && !loading && (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>No chatbot selected</EmptyTitle>
                </EmptyHeader>
                <EmptyContent />
              </Empty>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              {loading ? (
                <ChatbotTableSkeleton />
              ) : (
                <>
                  {chatbots.length > 0 && visibleChatbots.length === 0 && (
                    <EmptyState title="No matching chatbot" body="Clear search or switch status." />
                  )}
                  {visibleChatbots.length > 0 && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Capabilities</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Drafts / Published</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visibleChatbots.map((chatbot) => {
                          const chatbotItems = chatbot.id === chatbotId ? selectedItems : contentByChatbotId[chatbot.id] ?? []
                          const chatbotPublishedItems = chatbotItems.filter((item) => item.status === "published")
                          const chatbotDraftItems = chatbotItems.filter((item) => item.status !== "published")
                          const chatbotCapabilities = getSelectedCapabilityLabels(chatbot.capabilities)
                          const isArchived = chatbot.status === "archived"
                          const isSelected = chatbot.id === chatbotId
                          return (
                            <TableRow
                              key={chatbot.id}
                              className={cn(isSelected && "bg-muted/50")}
                              data-state={isSelected ? "selected" : undefined}
                            >
                              <TableCell>
                                <button
                                  className="text-left font-medium hover:underline"
                                  type="button"
                                  onClick={() => openChatbotDetails(chatbot)}
                                >
                                  {chatbot.name}
                                </button>
                                <div className="line-clamp-1 text-sm text-muted-foreground">{chatbot.purpose}</div>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {chatbotCapabilities.length > 0 ? (
                                    chatbotCapabilities.map((capability) => (
                                      <Badge key={capability} variant="outline">
                                        {capability}
                                      </Badge>
                                    ))
                                  ) : (
                                    <Badge variant="outline">None</Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant={chatbotPublishedItems.length > 0 ? "secondary" : "outline"}>{chatbot.status}</Badge>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm text-muted-foreground">
                                  {chatbotDraftItems.length} draft{chatbotDraftItems.length === 1 ? "" : "s"}, {chatbotPublishedItems.length} published
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button size="sm" variant="outline" onClick={() => openChatbotDetails(chatbot)}>
                                    <SendHorizontal data-icon="inline-start" />
                                    Test
                                  </Button>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger render={<Button aria-label={`${chatbot.name} actions`} size="icon-sm" variant="ghost" />}>
                                      <MoreHorizontal data-icon="inline-start" />
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuGroup>
                                        <DropdownMenuItem onClick={() => openChatbotDetails(chatbot)}>
                                          Details
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
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  )}
                </>
              )}
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
            <DrawerTitle>{detailForm.name.trim() || detailChatbot?.name || "Chatbot details"}</DrawerTitle>
            <DrawerDescription className="sr-only">Edit chatbot setup, manage content, and test responses.</DrawerDescription>
          </DrawerHeader>
          {detailChatbot && (
            <div className="grid min-h-0 flex-1 gap-5 overflow-hidden px-4 pb-4 lg:grid-cols-2">
              <div className="flex min-h-0 flex-col gap-4 overflow-y-auto pr-1">
                <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/60 p-4">
                  <div className="font-heading text-base font-medium">Chatbot setup</div>
                  <FieldGroup>
                    <Field data-disabled={detailChatbot.status === "archived"}>
                      <FieldLabel>Name</FieldLabel>
                      <Input
                        placeholder="Website assistant"
                        readOnly={detailChatbot.status === "archived"}
                        value={detailForm.name}
                        onChange={(event) => setDetailForm((current) => ({ ...current, name: event.target.value }))}
                      />
                    </Field>
                    <Field data-disabled={detailChatbot.status === "archived"}>
                      <FieldLabel>Purpose</FieldLabel>
                      <Textarea
                        readOnly={detailChatbot.status === "archived"}
                        className="min-h-24"
                        placeholder="Answer approved questions from website visitors"
                        value={detailForm.purpose}
                        onChange={(event) => setDetailForm((current) => ({ ...current, purpose: event.target.value }))}
                      />
                    </Field>
                    <CapabilityPicker
                      disabled={detailChatbot.status === "archived"}
                      value={detailForm.capabilities}
                      onChange={(capabilities) => setDetailForm((current) => ({ ...current, capabilities }))}
                    />
                  </FieldGroup>
                  {detailChatbot.status === "archived" && (
                    <p className="text-sm text-muted-foreground">Unarchive this chatbot to edit its setup.</p>
                  )}
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
          {detailChatbot && (
            <DrawerFooter className="flex-row items-center justify-between border-t">
              <Button variant="outline" onClick={() => setDetailOpen(false)}>Close</Button>
              <Button
                disabled={!detailFormReady || !detailFormDirty || detailSaving || detailChatbot.status === "archived"}
                onClick={() => void saveChatbotDetails()}
              >
                {detailSaving ? "Saving..." : "Save changes"}
              </Button>
            </DrawerFooter>
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