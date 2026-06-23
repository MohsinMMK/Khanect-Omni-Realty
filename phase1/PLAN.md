# Phase 1A Plan: Admin RAG Chat Lab

> **Historical artifact.** Phase 1A APIs are implemented; the web UI now uses the production platform routes. See [`phase1/README.md`](./README.md), [`README.md`](../README.md), and [`AGENTS.md`](../AGENTS.md).

## Locked choices

- Plan first; no Phase 1A code yet.
- Embeddings: deterministic local stub now, real BGE-M3 later.
- Auth: admin stub only, explicit non-production boundary.
- DB scope: content + RAG + chat only.
- Product center: RAG chatbot/admin lab, not generic CMS.

## Goal

Build first useful product loop:

```text
Admin enters approved content -> system chunks/indexes into Postgres/pgvector -> admin tests chatbot -> answer shows sources/fallback
```

No live WhatsApp, Instagram, Twenty sync, uploads, scheduler, analytics, or production LLM in Phase 1A.

## Phase 1A deliverables

### 1. Database migration

Add real Phase 1A schema in `packages/db`.

Tables:

1. `tenant`
   - `id uuid primary key`
   - `name text`
   - `domain text`
   - timestamps

2. `admin_user_stub`
   - dev/admin stub only
   - `id uuid primary key`
   - `tenant_id uuid`
   - `email text`
   - `roles text[]` or jsonb
   - no production auth claim

3. `content_item`
   - generic source table for Phase 1A
   - `content_type`: `project | property | faq | area | policy | general`
   - `title`, `slug`, `body`, `status`
   - `metadata jsonb`
   - `published_version_id uuid null`
   - tenant + timestamps

4. `content_version`
   - immutable snapshot per publish
   - `entity_type`, `entity_id`, `version_number`, `state`
   - `snapshot_json jsonb`
   - `published_at`

5. `rag_document`
   - one per published content version
   - source type/id/version
   - title/language/status/indexed_at

6. `rag_chunk`
   - `content text`
   - `metadata jsonb`
   - `embedding vector(1024)`
   - `embedding_model = stub/hash-v1`
   - `embedding_dimension = 1024`
   - `source_version_id`

7. `channel_conversation`
   - used by admin chat lab now
   - channel stored as `website` with `action_trace.lab = true`, or `admin_lab` if schema permits text
   - tenant, status, last intent/message timestamps

8. `channel_message`
   - stores prompts/replies
   - `direction`, `message_type`, `content`, `source_ids`, `action_trace`

9. `audit_log`
   - admin content publish/reindex/test events

Use raw SQL where needed:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
embedding vector(1024)
```

HNSW index: defer unless simple and stable. Plain pgvector storage + basic vector search enough for Phase 1A.

### 2. API endpoints

Add route modules under `apps/api/src/routes/admin/*`.

Admin/session:
- `GET /api/v1/admin/me`
- returns stub user/tenant/roles

Content:
- `GET /api/v1/admin/content`
- `POST /api/v1/admin/content`
- `GET /api/v1/admin/content/:id`
- `PATCH /api/v1/admin/content/:id`
- `POST /api/v1/admin/content/:id/publish`

RAG:
- `GET /api/v1/admin/rag/documents`
- `GET /api/v1/admin/rag/documents/:id/chunks`
- `POST /api/v1/admin/rag/reindex`
- `POST /api/v1/admin/rag/search-test`

Chat lab:
- `POST /api/v1/admin/chat-lab/sessions`
- `GET /api/v1/admin/chat-lab/sessions`
- `GET /api/v1/admin/chat-lab/sessions/:id/messages`
- `POST /api/v1/admin/chat-lab/test-message`

Responses should include sources:

```json
{
  "answer": "...",
  "fallback": false,
  "sources": [{ "chunkId": "...", "title": "...", "excerpt": "..." }],
  "retrieval": { "topK": 5, "embeddingModel": "stub/hash-v1" },
  "leadScore": { "score": 0, "band": "cold", "reasonCodes": [] },
  "handoff": null
}
```

### 3. RAG service

Create API/shared service layer:

- deterministic chunker
- deterministic stub embedding
- vector serialization for pgvector
- document indexing from published `content_version`
- search by vector distance
- safe answer composer

Stub embedding rules:

- stable output for same text
- exactly 1024 floats
- normalized vector
- `embedding_model = stub/hash-v1`
- never call external AI

Answer composer:

- uses retrieved snippets only
- if no good source, return fallback
- no price/RERA/legal hallucinations
- always return source IDs

### 4. Worker queue

Extend worker skeleton:

- queue: `rag.index`
- job: `{ tenantId, contentItemId, contentVersionId }`
- processor indexes published content only
- draft content ignored/rejected

For Phase 1A, API publish can either:
- call indexing synchronously in tests/dev, and enqueue worker job too, or
- enqueue job and tests call service directly

Preferred: service reusable by API + worker; worker owns production indexing path.

### 5. Admin web UI

Replace starter app with simple admin shell.

Routes/views:

- `/admin`
  - counts: content items, documents, chunks, lab sessions

- `/admin/content`
  - list content
  - create/edit form
  - publish button

- `/admin/rag`
  - document list
  - chunk viewer
  - search-test form

- `/admin/chat-lab`
  - prompt input
  - answer panel
  - source chips
  - fallback/handoff/score display

Use existing shadcn/Button. App-local simple components okay.

No real auth login UI. Show dev stub identity in header.

### 6. OpenAPI updates

Update `Real Estate Web RD/api_contracts.openapi.yaml` for new Phase 1A endpoints/schemas.

Extend `scripts/check-openapi.mjs` to assert key paths exist:

- `/admin/me`
- `/admin/content`
- `/admin/rag/documents`
- `/admin/chat-lab/test-message`

### 7. Dev scripts small cleanup

Add scripts if implementing Phase 1A:

- `dev:deps`: start Postgres/Redis only
- `dev:stop`: stop tracked local dev pids + deps
- `dev:logs`: tail `.dev-logs/*`

ClamAV arm64 issue: defer to Phase 1B/devops. Keep API health route; document container mismatch.

## Validation contract

Run after implementation:

```text
pnpm install --frozen-lockfile
pnpm db:generate
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm check:openapi
pnpm check:compose
git diff --check
git diff --cached --name-only
```

DB smoke with Docker Postgres:

```text
docker compose -f docker-compose.phase0.yml up -d postgres redis
apply migration
verify vector extension exists
insert published content
index chunks
run vector search
```

API tests:

- admin me returns stub tenant/user
- create content
- publish content creates `content_version`
- published content indexes into `rag_document` + `rag_chunk`
- draft content not indexed
- search-test returns sources
- chat-lab with source returns grounded answer
- chat-lab with no source returns fallback

Web smoke:

- `/admin` renders
- `/admin/content` renders
- `/admin/rag` renders
- `/admin/chat-lab` renders
- Browser can submit prompt and see answer/source when API running

## Non-goals

Do not build:

- live WhatsApp/Instagram
- website public chatbot widget
- Twenty CRM sync
- Better Auth real login
- upload/media manager
- map UI
- booking/scheduler
- analytics dashboard
- social publishing
- real BGE-M3 or LLM integration

## Risks

- Current Phase 0 diff is not committed. Best to commit before Phase 1A code.
- OpenAPI lacks new admin content/RAG endpoints now; must patch during implementation.
- Drizzle pgvector support may need raw SQL and manual type handling.
- Stub embeddings are not semantically good; UI must label them as stub.
- Admin auth stub must never look production-ready.

## Recommended implementation order

1. Commit Phase 0 baseline.
2. Add DB schema + migration.
3. Add RAG service + deterministic embedding tests.
4. Add API admin routes + injection tests.
5. Add worker `rag.index` queue + tests.
6. Add admin UI views.
7. Update OpenAPI/check script.
8. Run full validation.
9. Run reviewer pass.

## Worker prompt when approved

Implement Phase 1A only: admin shell, content entry, pgvector RAG tables/indexing, and chat lab skeleton. Use deterministic `stub/hash-v1` embeddings, admin auth stub, and content+RAG+chat DB scope. Preserve Phase 0 architecture. Do not implement live channels, Twenty sync, uploads, booking, analytics, social publishing, production auth, or real LLM/embedding service. Run validation contract and report changed files, commands, results, risks, and unapproved decisions.
