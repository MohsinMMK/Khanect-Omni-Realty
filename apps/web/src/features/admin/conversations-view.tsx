import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@workspace/ui/components/drawer"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@workspace/ui/components/empty"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@workspace/ui/components/input-group"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@workspace/ui/components/item"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@workspace/ui/components/pagination"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import { Separator } from "@workspace/ui/components/separator"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Spinner } from "@workspace/ui/components/spinner"
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip"
import { Globe2, MessageCircle, MessagesSquare, RefreshCw, Search } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { api, getErrorMessage } from "@/lib/api"
import { channelLabel } from "@/lib/channels"
import { AlertCallout } from "./components"
import type { ConversationSummary } from "./types"

const pageSize = 8

function formatTimestamp(value: string | null) {
  if (!value) return "—"
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

function ChannelIcon({ channel }: { channel: ConversationSummary["channel"] }) {
  if (channel === "website") return <Globe2 />
  if (channel === "whatsapp") return <MessageCircle />
  return <MessagesSquare />
}

export function ConversationsView({ chatbotId }: { chatbotId: string }) {
  const [items, setItems] = useState<ConversationSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")
  const [channelFilter, setChannelFilter] = useState("all")
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<ConversationSummary | null>(null)

  const loadConversations = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "initial") setLoading(true)
    else setRefreshing(true)
    setError("")
    try {
      const response = await api<{ items: ConversationSummary[] }>(`/admin/chatbots/${chatbotId}/conversations`)
      setItems(response.items)
      if (mode === "refresh") toast.success("Inbox refreshed")
    } catch (apiError) {
      setError(getErrorMessage(apiError))
    } finally {
      if (mode === "initial") setLoading(false)
      else setRefreshing(false)
    }
  }, [chatbotId])

  useEffect(() => {
    void loadConversations("initial")
  }, [loadConversations])

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return items.filter((item) => {
      const matchesChannel = channelFilter === "all" || item.channel === channelFilter
      if (!matchesChannel) return false
      if (!normalizedQuery) return true
      const haystack = [
        item.externalThreadId,
        item.lastUserMessage,
        item.lastAssistantMessage,
        channelLabel(item.channel),
        item.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return haystack.includes(normalizedQuery)
    })
  }, [channelFilter, items, query])

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize))
  const pagedItems = filteredItems.slice((page - 1) * pageSize, page * pageSize)

  useEffect(() => {
    setPage(1)
  }, [channelFilter, chatbotId, query])

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-base font-medium">Inbox</h2>
          <p className="text-sm text-muted-foreground">
            Recent visitor threads across website, WhatsApp, and Instagram for this chatbot.
          </p>
        </div>
        <Button disabled={loading || refreshing} size="sm" variant="outline" onClick={() => void loadConversations("refresh")}>
          {refreshing ? <Spinner data-icon="inline-start" /> : <RefreshCw data-icon="inline-start" />}
          Refresh
        </Button>
      </div>

      {error && <AlertCallout title="Request failed" description={error} variant="destructive" />}

      <Card>
        <CardHeader className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Conversations</CardTitle>
              <CardDescription>
                {loading ? "Loading threads…" : `${filteredItems.length} thread${filteredItems.length === 1 ? "" : "s"}`}
              </CardDescription>
            </div>
            <Tabs value={channelFilter} onValueChange={(value) => setChannelFilter(value ?? "all")}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="website">Website</TabsTrigger>
                <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
                <TabsTrigger value="instagram_dm">Instagram</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <InputGroup className="max-w-md">
            <InputGroupAddon align="inline-start">
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              aria-label="Search conversations"
              placeholder="Search visitor, message, or channel"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </InputGroup>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {loading && (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-16 w-full rounded-2xl" />
              ))}
            </div>
          )}

          {!loading && filteredItems.length === 0 && (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>No conversations yet</EmptyTitle>
                <EmptyDescription>
                  Threads appear after visitors message the website widget or a connected Meta channel.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}

          {!loading && filteredItems.length > 0 && (
            <ScrollArea className="max-h-[min(32rem,60vh)] pr-3">
              <ItemGroup>
                {pagedItems.map((conversation) => (
                  <Item
                    key={conversation.id}
                    className="cursor-pointer"
                    size="sm"
                    variant="outline"
                    onClick={() => setSelected(conversation)}
                  >
                    <ItemMedia variant="icon">
                      <ChannelIcon channel={conversation.channel} />
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle>
                        {conversation.lastUserMessage ?? "No visitor message yet"}
                      </ItemTitle>
                      <ItemDescription>
                        {conversation.lastAssistantMessage ?? "No assistant reply recorded yet"}
                      </ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Badge className="shrink-0" variant="outline" />
                          }
                        >
                          {channelLabel(conversation.channel)}
                        </TooltipTrigger>
                        <TooltipContent>{conversation.externalThreadId ?? "Anonymous visitor"}</TooltipContent>
                      </Tooltip>
                      <span className="text-xs text-muted-foreground">{formatTimestamp(conversation.lastMessageAt)}</span>
                    </ItemActions>
                  </Item>
                ))}
              </ItemGroup>
            </ScrollArea>
          )}
        </CardContent>

        {!loading && filteredItems.length > pageSize && (
          <CardFooter>
            <Pagination className="w-full justify-end">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(event) => {
                      event.preventDefault()
                      setPage((current) => Math.max(1, current - 1))
                    }}
                  />
                </PaginationItem>
                {Array.from({ length: totalPages }, (_, index) => {
                  const pageNumber = index + 1
                  return (
                    <PaginationItem key={pageNumber}>
                      <PaginationLink
                        href="#"
                        isActive={pageNumber === page}
                        onClick={(event) => {
                          event.preventDefault()
                          setPage(pageNumber)
                        }}
                      >
                        {pageNumber}
                      </PaginationLink>
                    </PaginationItem>
                  )
                })}
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(event) => {
                      event.preventDefault()
                      setPage((current) => Math.min(totalPages, current + 1))
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </CardFooter>
        )}
      </Card>

      <Drawer direction="right" open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null) }}>
        <DrawerContent className="data-[vaul-drawer-direction=right]:w-[min(520px,100vw)] data-[vaul-drawer-direction=right]:sm:max-w-none">
          <DrawerHeader>
            <DrawerTitle>Conversation thread</DrawerTitle>
            <DrawerDescription>
              {selected ? `${channelLabel(selected.channel)} · ${selected.messageCount} message${selected.messageCount === 1 ? "" : "s"}` : "Thread details"}
            </DrawerDescription>
          </DrawerHeader>
          {selected && (
            <ScrollArea className="min-h-0 flex-1 px-6 pb-4">
              <div className="flex flex-col gap-4 pr-3">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{channelLabel(selected.channel)}</Badge>
                  <Badge variant="secondary">{selected.status.replace(/_/g, " ")}</Badge>
                </div>
                <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
                  <div className="text-xs font-medium text-muted-foreground">Visitor ID</div>
                  <div className="mt-1 font-mono text-sm">{selected.externalThreadId ?? "—"}</div>
                </div>
                <Separator />
                <div className="flex flex-col gap-2">
                  <div className="text-xs font-medium text-muted-foreground">Last visitor message</div>
                  <p className="whitespace-pre-wrap text-sm">{selected.lastUserMessage ?? "—"}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="text-xs font-medium text-muted-foreground">Last assistant reply</div>
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">{selected.lastAssistantMessage ?? "—"}</p>
                </div>
                <div className="text-xs text-muted-foreground">
                  Updated {formatTimestamp(selected.lastMessageAt)}
                </div>
              </div>
            </ScrollArea>
          )}
          <DrawerFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  )
}