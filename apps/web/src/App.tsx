import { Button } from "@workspace/ui/components/button"
import { useEffect, useState } from "react"

type Page = "admin" | "content" | "rag" | "chat-lab"
type ContentItem = { id: string; title: string; slug: string; body: string; status: string; contentType: string }
type RagDocument = { id: string; title: string; sourceType: string; status: string; chunkCount: number; indexedAt: string | null }
type RagChunk = { id: string; content: string; embeddingModel: string; embeddingDimension: number; chunkIndex: number }
type Source = { chunkId: string; title: string; excerpt: string; score: number }
type ChatAnswer = {
  answer: string
  fallback: boolean
  sources: Source[]
  sessionId: string
  retrieval: { topK: number; embeddingModel: string }
  leadScore: { score: number; band: string; reasonCodes: string[] }
  handoff: null | { reason?: string; priority?: string }
}
type AdminMe = { user: { email: string; roles: string[]; authMode: string; productionAuth: false }; warning: string }

const apiBase = import.meta.env.VITE_API_BASE_URL ?? "/api/v1"

export function App() {
  const [page, setPage] = useState<Page>(() => pageFromPath(window.location.pathname))
  const [admin, setAdmin] = useState<AdminMe | null>(null)

  useEffect(() => {
    void api<AdminMe>("/admin/me").then(setAdmin).catch(() => setAdmin(null))
  }, [])

  useEffect(() => {
    const syncPage = () => setPage(pageFromPath(window.location.pathname))
    window.addEventListener("popstate", syncPage)
    return () => window.removeEventListener("popstate", syncPage)
  }, [])

  function navigate(next: Page) {
    const path = next === "admin" ? "/admin" : `/admin/${next}`
    window.history.pushState(null, "", path)
    setPage(next)
  }

  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="border-b px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Khanect Omni Realty Admin Lab</h1>
            <p className="text-muted-foreground text-sm">Phase 1A: content → pgvector RAG → chatbot test loop</p>
          </div>
          <div className="rounded-md border px-3 py-2 text-xs">
            <div>{admin?.user.email ?? "dev admin stub"}</div>
            <div className="text-muted-foreground">No production login. Stub only.</div>
          </div>
        </div>
      </header>

      <div className="grid min-h-[calc(100svh-82px)] md:grid-cols-[220px_1fr]">
        <nav className="border-r p-4">
          {[
            ["admin", "Dashboard"],
            ["content", "Content"],
            ["rag", "RAG"],
            ["chat-lab", "Chat Lab"],
          ].map(([key, label]) => (
            <button
              className={`mb-2 block w-full rounded-md px-3 py-2 text-left text-sm ${page === key ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              key={key}
              onClick={() => navigate(key as Page)}
            >
              {label}
            </button>
          ))}
        </nav>
        <main className="p-6">
          {page === "admin" && <Dashboard />}
          {page === "content" && <ContentView />}
          {page === "rag" && <RagView />}
          {page === "chat-lab" && <ChatLabView />}
        </main>
      </div>
    </div>
  )
}

function Dashboard() {
  const [content, setContent] = useState<ContentItem[]>([])
  const [documents, setDocuments] = useState<RagDocument[]>([])
  const [sessions, setSessions] = useState<{ id: string }[]>([])

  useEffect(() => {
    void refresh()
    async function refresh() {
      const [contentResponse, documentResponse, sessionResponse] = await Promise.all([
        api<{ items: ContentItem[] }>("/admin/content"),
        api<{ items: RagDocument[] }>("/admin/rag/documents"),
        api<{ items: { id: string }[] }>("/admin/chat-lab/sessions"),
      ])
      setContent(contentResponse.items)
      setDocuments(documentResponse.items)
      setSessions(sessionResponse.items)
    }
  }, [])

  const published = content.filter((item) => item.status === "published").length
  const chunks = documents.reduce((sum, document) => sum + document.chunkCount, 0)

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Admin lab dashboard</h2>
      <div className="grid gap-3 md:grid-cols-4">
        <Stat label="Content items" value={content.length} />
        <Stat label="Published sources" value={published} />
        <Stat label="RAG chunks" value={chunks} />
        <Stat label="Lab sessions" value={sessions.length} />
      </div>
      <p className="text-muted-foreground text-sm">Use Content tab to create draft, publish it, then test search and chat with sources.</p>
    </section>
  )
}

function ContentView() {
  const [items, setItems] = useState<ContentItem[]>([])
  const [message, setMessage] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ title: "", slug: "", body: "", contentType: "general" })

  async function refresh() {
    const response = await api<{ items: ContentItem[] }>("/admin/content")
    setItems(response.items)
  }

  useEffect(() => {
    void api<{ items: ContentItem[] }>("/admin/content").then((response) => setItems(response.items))
  }, [])

  async function saveContent() {
    const response = editingId
      ? await api<{ item: ContentItem }>(`/admin/content/${editingId}`, { method: "PATCH", body: form })
      : await api<{ item: ContentItem }>("/admin/content", { method: "POST", body: form })
    setMessage(`${editingId ? "Draft updated" : "Draft saved"}: ${response.item.title}`)
    setEditingId(null)
    setForm({ title: "", slug: "", body: "", contentType: "general" })
    await refresh()
  }

  function edit(item: ContentItem) {
    setEditingId(item.id)
    setForm({ title: item.title, slug: item.slug, body: item.body, contentType: item.contentType })
    setMessage(item.status === "published" ? "Editing published content creates a draft; publish again before RAG uses changes." : "Editing draft content.")
  }

  async function publish(id: string) {
    const response = await api<{ chunkCount: number }>(`/admin/content/${id}/publish`, { method: "POST" })
    setMessage(`Published and indexed ${response.chunkCount} chunks with stub/hash-v1`)
    await refresh()
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[420px_1fr]">
      <div className="space-y-3 rounded-lg border p-4">
        <h2 className="font-semibold">Create admin-approved content</h2>
        <select className="w-full rounded-md border bg-background p-2" value={form.contentType} onChange={(event) => setForm({ ...form, contentType: event.target.value })}>
          {['project', 'property', 'faq', 'area', 'policy', 'general'].map((value) => <option key={value}>{value}</option>)}
        </select>
        <input className="w-full rounded-md border bg-background p-2" placeholder="Title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
        <input className="w-full rounded-md border bg-background p-2" placeholder="Slug optional" value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} />
        <textarea className="min-h-40 w-full rounded-md border bg-background p-2" placeholder="Approved body copy" value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} />
        <div className="flex gap-2">
          <Button disabled={!form.title || !form.body} onClick={saveContent}>{editingId ? "Update draft" : "Save draft"}</Button>
          {editingId && <Button variant="outline" onClick={() => { setEditingId(null); setForm({ title: "", slug: "", body: "", contentType: "general" }) }}>Cancel</Button>}
        </div>
        {message && <p className="text-sm text-green-600">{message}</p>}
      </div>
      <div className="space-y-3">
        <h2 className="font-semibold">Content list</h2>
        {items.map((item) => (
          <article className="rounded-lg border p-4" key={item.id}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-medium">{item.title}</h3>
                <p className="text-muted-foreground text-xs">{item.contentType} · {item.slug} · {item.status}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => edit(item)}>Edit</Button>
                <Button disabled={item.status === "published"} onClick={() => publish(item.id)}>Publish + index</Button>
              </div>
            </div>
            <p className="mt-3 line-clamp-3 text-sm">{item.body}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

function RagView() {
  const [documents, setDocuments] = useState<RagDocument[]>([])
  const [chunks, setChunks] = useState<RagChunk[]>([])
  const [query, setQuery] = useState("")
  const [sources, setSources] = useState<Source[]>([])

  async function refresh() {
    const response = await api<{ items: RagDocument[] }>("/admin/rag/documents")
    setDocuments(response.items)
  }

  useEffect(() => {
    void api<{ items: RagDocument[] }>("/admin/rag/documents").then((response) => setDocuments(response.items))
  }, [])

  async function showChunks(id: string) {
    const response = await api<{ items: RagChunk[] }>(`/admin/rag/documents/${id}/chunks`)
    setChunks(response.items)
  }

  async function reindex() {
    await api("/admin/rag/reindex", { method: "POST", body: {} })
    await refresh()
  }

  async function search() {
    const response = await api<{ sources: Source[] }>("/admin/rag/search-test", { method: "POST", body: { query, topK: 5 } })
    setSources(response.sources)
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">RAG documents and chunks</h2>
        <Button onClick={reindex}>Reindex published</Button>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          {documents.map((document) => (
            <button className="block w-full rounded-lg border p-4 text-left" key={document.id} onClick={() => showChunks(document.id)}>
              <div className="font-medium">{document.title}</div>
              <div className="text-muted-foreground text-xs">{document.sourceType} · {document.status} · {document.chunkCount} chunks · stub/hash-v1</div>
            </button>
          ))}
        </div>
        <div className="space-y-3 rounded-lg border p-4">
          <h3 className="font-medium">Chunk viewer</h3>
          {chunks.map((chunk) => (
            <div className="rounded-md bg-muted p-3 text-sm" key={chunk.id}>
              <div className="text-muted-foreground mb-1 text-xs">#{chunk.chunkIndex} · {chunk.embeddingModel} · {chunk.embeddingDimension}d</div>
              {chunk.content}
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-3 rounded-lg border p-4">
        <h3 className="font-medium">Search test</h3>
        <input className="w-full rounded-md border bg-background p-2" placeholder="Ask retrieval query" value={query} onChange={(event) => setQuery(event.target.value)} />
        <Button disabled={!query} onClick={search}>Search</Button>
        {sources.map((source) => <SourceCard key={source.chunkId} source={source} />)}
      </div>
    </section>
  )
}

function ChatLabView() {
  const [message, setMessage] = useState("")
  const [answer, setAnswer] = useState<ChatAnswer | null>(null)

  async function send() {
    const response = await api<ChatAnswer>("/admin/chat-lab/test-message", { method: "POST", body: { message } })
    setAnswer(response)
  }

  return (
    <section className="mx-auto max-w-3xl space-y-4">
      <h2 className="text-lg font-semibold">Chatbot lab</h2>
      <p className="text-muted-foreground text-sm">Safe composer uses retrieved snippets only. No external LLM or real channel send.</p>
      <textarea className="min-h-28 w-full rounded-md border bg-background p-3" placeholder="Ask approved-content question" value={message} onChange={(event) => setMessage(event.target.value)} />
      <Button disabled={!message} onClick={send}>Test message</Button>
      {answer && (
        <div className="space-y-3 rounded-lg border p-4">
          <div className={answer.fallback ? "text-amber-600" : "text-green-600"}>{answer.fallback ? "Fallback" : "Grounded answer"}</div>
          <pre className="whitespace-pre-wrap text-sm">{answer.answer}</pre>
          <div className="grid gap-2 text-xs md:grid-cols-3">
            <div className="rounded-md bg-muted p-2">Embedding: {answer.retrieval.embeddingModel}</div>
            <div className="rounded-md bg-muted p-2">Lead score: {answer.leadScore.band} ({answer.leadScore.score})</div>
            <div className="rounded-md bg-muted p-2">Handoff: {answer.handoff ? "required" : "none"}</div>
          </div>
          <div className="space-y-2">
            <h3 className="font-medium">Sources</h3>
            {answer.sources.length === 0 && <p className="text-muted-foreground text-sm">No approved source used.</p>}
            {answer.sources.map((source) => <SourceCard key={source.chunkId} source={source} />)}
          </div>
        </div>
      )}
    </section>
  )
}

function Stat(props: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="text-2xl font-semibold">{props.value}</div>
      <div className="text-muted-foreground text-sm">{props.label}</div>
    </div>
  )
}

function SourceCard({ source }: { source: Source }) {
  return (
    <div className="rounded-md bg-muted p-3 text-sm">
      <div className="font-medium">{source.title}</div>
      <div>{source.excerpt}</div>
      <div className="text-muted-foreground mt-1 text-xs">chunk {source.chunkId} · score {source.score}</div>
    </div>
  )
}

async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    method: options.method ?? "GET",
    headers: options.body ? { "content-type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  if (!response.ok) throw new Error(`API ${response.status}`)
  return response.json() as Promise<T>
}

function pageFromPath(pathname: string): Page {
  if (pathname.includes("/admin/content")) return "content"
  if (pathname.includes("/admin/rag")) return "rag"
  if (pathname.includes("/admin/chat-lab")) return "chat-lab"
  return "admin"
}
