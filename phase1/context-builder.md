# Phase 1A Context Builder

Task: context only for Phase 1A candidate scope. Requested output file is only file written. No product/source files edited.

## Scope boundary

Candidate Phase 1A: admin shell + content entry + real pgvector-backed RAG tables + chat lab skeleton.

Locked product directive:
- Web app centered on RAG/chatbot, not generic CMS. `17_DECISIONS_LOCK.md:48-53`
- Omni-channel via internal EGI pipeline: website chat, WhatsApp, Instagram DM normalized into one channel model. `17_DECISIONS_LOCK.md:49-52`, `04_AI_RAG_RD.md:41-49`
- Admin/test chatbot UI required before live channels. `17_DECISIONS_LOCK.md:51`
- Vectors live in Postgres/pgvector. `04_AI_RAG_RD.md:25-30`, `schema.sql:4,213-228`

Do not widen Phase 1A into uploads, scheduler, Twenty live sync, WhatsApp/Instagram live send, analytics dashboard, social publishing, Map UI, or production LLM integration.

## Current code entry points and Phase 0 patterns

Root/workspace:
- `package.json:5-14` scripts: Turbo `build/dev/lint/format/test/typecheck`, `db:generate`, `check:openapi`, `check:compose`.
- `package.json:23-26`: pnpm 10.33.4, Node `>=24`.
- Workspaces present: `apps/api`, `apps/web`, `apps/worker`, `packages/config`, `packages/core`, `packages/db`, `packages/ui`.

API:
- `apps/api/src/app.ts:25-57` exports `buildApi(options)` app factory. Keep route registration here. Current routes registered under `/api/v1`.
- `apps/api/src/app.ts:27-32` Fastify request IDs use `x-request-id` or `randomUUID()`.
- `apps/api/src/app.ts:35-48` central error handler returns `{ error: { code, message }, requestId }`.
- `apps/api/src/app.ts:50-53` registers health and ClamAV dependency routes with `/api/v1` prefix.
- `apps/api/src/app.ts:59-91` production static serving from `apps/web/dist`; API 404 for `/api/*`; SPA fallback `index.html`.
- `apps/api/test/health.test.ts:5-63` uses Fastify injection pattern. Copy for new route tests.

Config:
- `packages/config/src/index.ts:24-90` validates env via Zod. AI defaults already include `EMBEDDING_MODEL=BAAI/bge-m3`, `LLM_PROVIDER=ollama`, `LLM_BASE_URL`, `LOCAL_AI_ENABLED` at `lines 71-76`.
- `packages/config/src/index.ts:134-160` exposes Meta and AI config. Use this for chat lab stub behavior and future adapters.
- Production guard exists for Better Auth/Meta/Google secrets at `packages/config/src/index.ts:187-231`.

Core/domain:
- `packages/core/src/index.ts:1-11` shared UUID v7 utility. Use `createUuidV7()` for IDs until DB UUID v7 default approved/available.
- `packages/core/src/index.ts:13-68` channel adapter types: website/WhatsApp/Instagram DM identity/inbound/outbound/webhook abstractions.
- `packages/core/src/index.ts:70-81` EGI pipeline input/result types.
- `packages/core/src/index.ts:83-114` lead scoring + handoff types already align with RAG doc.
- `packages/core/src/index.ts:116-143` audit/auth context stubs. Phase 1A can add admin guard stubs here or API-local middleware, but Better Auth real integration decision still needed.

DB:
- `packages/db/src/schema.ts:1-8` only `schema_metadata`; comment says Phase 0 marker only, real RD schema not translated yet.
- `packages/db/src/index.ts` provides `createPgPool`, `createPgPoolFromConfig`, `createDbClient`, `closePgPool` using Drizzle + `pg`.
- `packages/db/migrations/0000_aberrant_khan.sql` only creates `schema_metadata`.
- Locked rule: Drizzle + `pg`, generate migrations with `drizzle-kit generate`, commit/review SQL, no production `push`. `17_DECISIONS_LOCK.md:84-92`.

Worker:
- `apps/worker/src/runtime.ts:4` placeholder queue name `phase0.foundation`.
- `apps/worker/src/runtime.ts:16-27` Redis URL parsing helper.
- `apps/worker/src/runtime.ts:29-62` BullMQ Worker skeleton with safe startup/error/close. Phase 1A should add queues for RAG indexing jobs but can keep processors stubbed.

Web:
- `apps/web/src/App.tsx:1-19` still starter shell. Replace with route-aware app shell or simple state router.
- `apps/web/src/main.tsx` wraps `App` in `ThemeProvider` and imports `@workspace/ui/globals.css`.
- `packages/ui/src/components/button.tsx` exported shared Button; no layout/forms/table components yet.

Docker/dev:
- `docker-compose.phase0.yml:21-34` uses `pgvector/pgvector:pg16`, Redis, ClamAV.
- `docker-compose.phase0.yml:36-64` app and worker use same image, different commands. Preserve.

## Phase 1A DB migrations/tables only

Implement minimum product tables needed for admin content entry, real pgvector storage, chat lab skeleton, and audit. Use Drizzle schema as source plus raw SQL for pgvector extension/type/index where needed.

Must include from RD:
- Tenant ID on business tables even single-tenant. `09_DATA_MODEL_API_RD.md:32-34`
- UUID v7 IDs in `uuid` columns. `17_DECISIONS_LOCK.md:70-75`, `schema.sql:1-3`
- pgvector extension and `vector(1024)`. `schema.sql:4,222`; `04_AI_RAG_RD.md:25-30`

Phase 1A table set:
1. `tenant`
   - `id uuid pk`, `name`, `domain`, `created_at`.
   - Needed as root FK for all business rows. `schema.sql:6-11`.

2. Minimal admin/auth support
   - User decision needed: real Better Auth tables now vs admin stub.
   - If real auth approved: add Better Auth required tables plus `app_user`, `role`, `user_role` from `09_DATA_MODEL_API_RD.md:7-12`.
   - If not approved: add only `app_user`/`role`/`user_role` minimal for admin guards, no public auth promise.

3. `project`
   - Fields from `schema.sql:13-32`: tenant, name, slug, status, city/locality/address, lat/lng/provider, RERA, `published_version_id`, timestamps.
   - Phase 1A content entry target: project page source for RAG.

4. `property_listing`
   - Fields from `schema.sql:34-53`: tenant, optional project FK, title, slug, config, price display/min/max, availability, geo, `published_version_id`, timestamps.
   - Add description fields either as structured columns or stored in `content_version.snapshot_json`. Keep pricing cautious.

5. `faq`
   - RD lists core table `09_DATA_MODEL_API_RD.md:17` and RAG source `04_AI_RAG_RD.md:55-63`.
   - Recommended columns: `id`, `tenant_id`, `question`, `answer`, `category`, `status`, `published_version_id`, `created_at`, `updated_at`.

6. `content_version`
   - Fields from `schema.sql:76-89`: entity type/id, version_number, state, snapshot_json, summary, created/published metadata.
   - Phase 1A publish action should create `state='published'` version and update entity `published_version_id`.

7. `rag_document`
   - Fields from `schema.sql:201-211`: source_type, source_id, source_version_id, title, language, published_at.
   - Add optional `source_url`, `is_active`, `indexed_at` if useful. Active version needed to prevent stale/draft answers. `04_AI_RAG_RD.md:117-119,154-159`.

8. `rag_chunk`
   - Fields from `schema.sql:213-228`: tenant, document, property/project, section, content, metadata, `embedding vector(1024)`, HNSW index, tenant project/property indexes.
   - Must record metadata: `embedding_model`, `embedding_dimension`, `chunk_version`, `source_version_id` per `04_AI_RAG_RD.md:27-30,92-107`.
   - Use raw SQL for `CREATE EXTENSION IF NOT EXISTS vector`, `vector(1024)`, HNSW index. `17_DECISIONS_LOCK.md:91-92`.
   - Consider delay HNSW until content exists? Docs say production after enough content. Phase 1A can create HNSW now in dev migration if accepted, or add plain storage + TODO. Decision needed.

9. `channel_conversation`
   - Fields from `schema.sql:91-107`: tenant, channel, external thread/session, lead/property/project, status, handoff_status, intent, last_message_at, timestamps, unique external thread.
   - Chat lab can use `channel='website'` or introduce `channel='admin_lab'`? User decision. To avoid widening channel enum, use website + metadata flag for lab.

10. `channel_message`
   - Fields from `schema.sql:109-125`: conversation FK, channel, external ID, direction, type, content, source_ids, action_trace, timestamp.
   - Store lab prompts/replies, source IDs, fallback trace.

11. `lead_score_event` + `human_handoff` optional-minimal
   - RAG/chat lab wants lead scoring/handoff visibility. Tables in `schema.sql:157-183`.
   - Phase 1A can store computed stub score/handoff recommendation in `channel_message.action_trace` instead if scope must stay lean. Prefer add only if chat lab displays it.

12. `integration_outbox` optional
   - Needed if publish enqueues RAG indexing or worker jobs persistently. Fields `schema.sql:230-243`.
   - Alternative: BullMQ job enqueue only, lower DB surface. But RD standards say integrations use outbox jobs `09_DATA_MODEL_API_RD.md:108`; RAG indexing is internal, not external. Decision.

13. `audit_log`
   - Fields `schema.sql:257-268`.
   - Required for admin mutations. `17_DECISIONS_LOCK.md:67-68`, `09_DATA_MODEL_API_RD.md:106-107`.

Do not add in Phase 1A unless needed by approved UI: `media_asset` upload flow, bookings, analytics, CRM sync fields, live webhook delivery.

## API endpoints to add

Keep OpenAPI aligned. Existing OpenAPI lacks most admin content/RAG endpoints except chat + CRM/media; update `Real Estate Web RD/api_contracts.openapi.yaml` only if implementation approved despite this context task no-edit rule. Contract currently includes public `/chat/sessions` and `/chat/sessions/{id}/messages` at `api_contracts.openapi.yaml:102-136`, webhooks at `137-174`, and limited admin CRM/media at `213-260`.

Phase 1A recommended endpoints:

Admin shell/auth/session:
- `GET /api/v1/admin/me` -> admin session, tenant, roles. Stub or Better Auth-backed.
- `GET /api/v1/admin/dashboard` -> counts only: drafts, published sources, chunks, recent lab sessions.

Content entry:
- `GET /api/v1/admin/projects`
- `POST /api/v1/admin/projects`
- `GET /api/v1/admin/projects/:id`
- `PATCH /api/v1/admin/projects/:id`
- `POST /api/v1/admin/projects/:id/publish`
- Same minimal set for `properties` if property content entry approved: `GET/POST/PATCH/POST publish`.
- `GET /api/v1/admin/faqs`, `POST /api/v1/admin/faqs`, `PATCH /api/v1/admin/faqs/:id`, `POST /api/v1/admin/faqs/:id/publish`.

RAG admin:
- `GET /api/v1/admin/rag/documents` -> documents by source/version/status.
- `GET /api/v1/admin/rag/chunks?documentId=...` -> chunk viewer with metadata, no raw vector by default.
- `POST /api/v1/admin/rag/reindex` -> enqueue reindex for published sources. Already listed in RD admin endpoints `09_DATA_MODEL_API_RD.md:96-97`.
- `POST /api/v1/admin/rag/search-test` -> query + topK chunks using stub/deterministic embedding; for lab diagnostics.

Chat lab skeleton:
- `GET /api/v1/admin/chat-lab/sessions` and `POST /api/v1/admin/chat-lab/test-message` are locked/listed in RD `09_DATA_MODEL_API_RD.md:86-87`.
- Add `POST /api/v1/admin/chat-lab/sessions` for new lab session if not overloading listed endpoint.
- `GET /api/v1/admin/chat-lab/sessions/:id/messages` for transcript.
- Response for test-message should include `{ answer, fallback, sources, retrieval, leadScore, handoff, actionTrace }`. Keep answer stub grounded by retrieved chunks.

Public chat (optional skeleton only if approved):
- `POST /api/v1/chat/sessions` and `POST /api/v1/chat/sessions/:id/messages` already in OpenAPI `102-136`.
- Phase 1A can route to same stub RAG pipeline but should not claim production chatbot readiness.

Implementation standards:
- Admin APIs need auth/role/tenant/audit. `17_DECISIONS_LOCK.md:67-68`, `09_DATA_MODEL_API_RD.md:101-114`.
- Public mutations need validation/rate limit/bot/consent/idempotency where applicable. For Phase 1A, avoid public mutations beyond chat skeleton unless those protections exist.
- Heavy AI/reindex work must be enqueued; public requests must not synchronously depend on embedder/LLM. `09_DATA_MODEL_API_RD.md:44`.

## Web/admin routes/components to add

Current web is starter only `apps/web/src/App.tsx:1-19`. Add light admin UX centered around content -> RAG -> chat lab.

Recommended routes (client-side, static Vite):
- `/admin` dashboard/home.
- `/admin/content` content source list with project/property/FAQ tabs.
- `/admin/content/projects/new`, `/admin/content/projects/:id`.
- `/admin/content/properties/new`, `/admin/content/properties/:id` if properties included.
- `/admin/content/faqs/new`, `/admin/content/faqs/:id`.
- `/admin/rag` document/index status.
- `/admin/rag/documents/:id` chunk/source viewer.
- `/admin/chat-lab` prompt tester and transcript.

Component set:
- `AdminLayout`: sidebar/topbar/status, nav to Content/RAG/Chat Lab.
- `ApiClient` helper using `VITE_API_BASE_URL`/relative `/api/v1`; no direct DB/Redis/LLM access per `17_DECISIONS_LOCK.md:15`.
- `ContentEditorForm`: title/slug/status/RERA/locality/description/FAQ fields; publish button.
- `PublishPanel`: shows draft/published version and `Reindex` action.
- `RagDocumentList`, `RagChunkViewer`: source IDs, sections, metadata, no vector dump.
- `ChatLab`: channel selector style (website/WhatsApp/Instagram preview), prompt input, answer/fallback, source chips, retrieval scores, lead score/handoff reason.
- `EmptyState/ErrorState/LoadingState` local components.

Avoid router dependency if scope tight: simple state-based route switch may pass Phase 1A. If adding React Router, update lockfile and validation. UI package only has Button now; either create app-local components or add minimal shared UI components.

## Safe stub embedding strategy options

Need real pgvector-backed tables now, but embedding service can be stubbed safely.

Option A — deterministic hash embedding (recommended Phase 1A)
- Create local function `embedTextStub(text): number[1024]` using stable seeded hashing/PRNG, normalize vector.
- Store vectors in `rag_chunk.embedding vector(1024)` and query with pgvector cosine distance.
- Pros: deterministic tests, no external service, real pgvector path exercised, no fake random nondeterminism.
- Cons: semantic relevance poor; label clearly `embedding_model='stub/hash-v1'`, not BAAI.

Option B — lexical-only retrieval + zero/null embedding
- Store chunks with null embedding; use SQL full-text/ILIKE ranking only.
- Pros: simplest.
- Cons: does not satisfy "vectors live in Postgres/pgvector" well; misses vector query path.

Option C — local BAAI/bge-m3 adapter interface stubbed off by default
- Define `EmbeddingAdapter` interface with configured model default from `packages/config/src/index.ts:71-76`; implementation throws/returns unavailable unless `LOCAL_AI_ENABLED`.
- Pair with Option A fallback.
- Pros: future-safe.
- Cons: more code; must not block requests on unavailable service.

Recommended: Option A + adapter interface. Store `embedding_model='stub/hash-v1'`, `embedding_dimension=1024`, `chunk_version='phase1a-v1'`. Add migration-compatible metadata fields. Make UI say "stub embeddings; semantic quality not production." Later switch to `BAAI/bge-m3` per `04_AI_RAG_RD.md:23-30`.

Chat answer stub:
- Retrieve top chunks, then answer by template only from chunk snippets.
- If no high-confidence chunk, return approved fallback wording from `04_AI_RAG_RD.md:185-189`.
- Never invent price/RERA/legal facts. `04_AI_RAG_RD.md:9-17,124-135,152-159`.

## Validation contract

Minimum commands after Phase 1A implementation:
- `pnpm install` if deps changed.
- `pnpm typecheck`
- `pnpm test`
- `pnpm --filter api test`
- `pnpm --filter worker test`
- `pnpm --filter web build`
- `pnpm --filter @workspace/db db:generate` after schema change, then inspect generated SQL.
- `pnpm check:openapi` after contract change.
- `pnpm check:compose`
- DB integration: start Postgres with `docker compose -f docker-compose.phase0.yml up -d postgres redis`; apply migration by project workflow; verify `CREATE EXTENSION vector`, `rag_chunk.embedding vector(1024)`, and a vector search query works.
- API injection tests: admin auth guard, content CRUD happy path, publish creates `content_version`, reindex creates `rag_document/rag_chunk`, chat lab fallback and sourced answer.
- Worker unit tests: reindex job chunks published content only; draft content not indexed.
- Web smoke: build succeeds; admin/content/rag/chat-lab render with mocked/fake API or dev API.
- `git diff --cached --name-only` must be empty unless user explicitly stages.

Launch-quality RAG eval from RD is not Phase 1A gate, but design must not block later test set: `04_AI_RAG_RD.md:210-230`.

## Risks and user decisions needed

Decisions needed before coding:
1. Auth depth: real Better Auth admin auth in Phase 1A, or admin stub with explicit non-production guard?
2. Content breadth: projects + FAQs only, or include property listings now?
3. HNSW index now or defer until enough content? Docs allow production HNSW after content exists `04_AI_RAG_RD.md:27-30`.
4. Admin lab channel value: store as `channel='website'` with `action_trace.lab=true`, or add enum/value `admin_lab`?
5. Seed tenant/admin: migration seed, script, or runtime bootstrap?
6. OpenAPI file edit approved? Implementation must align, but this task says no source/docs modifications besides output.
7. Stub embedding approved as `stub/hash-v1` until local BAAI adapter exists?

Key risks:
- Pgvector + Drizzle type support may need raw SQL; locked as allowed. `17_DECISIONS_LOCK.md:91-92`.
- OpenAPI currently lacks admin content/RAG endpoints; must update before/with implementation to satisfy D6. `17_DECISIONS_LOCK.md:62-68`.
- Better Auth tables unknown until package integration chosen; adding custom auth now may create rework.
- Real LLM/embedding service unavailable; any UI must label stub and not promise production accuracy.
- Publishing/indexing must not index drafts or unapproved sources. `04_AI_RAG_RD.md:65-71,117-119`.
- Price/RERA/legal hallucination risk; force fallback for sensitive missing data. `04_AI_RAG_RD.md:124-135,152-159`.
- `lead_score_band` docs conflict: schema/RD/OpenAPI use cold/warm/hot, core type includes urgent. Need normalize before DB/API.

## Compact worker meta-prompt if approved

Goal: Implement Phase 1A only: admin shell, content entry, pgvector RAG tables/indexing, and chat lab skeleton for Khanect Omni Realty. Keep app centered on RAG/chatbot. Do not implement live WhatsApp/Instagram, Twenty sync, uploads/media manager, bookings, analytics dashboard, social publishing, or production LLM.

Context/evidence:
- Existing Fastify app factory: `apps/api/src/app.ts:25-57`; register new routes under `/api/v1` there or via route modules.
- Existing Fastify injection test pattern: `apps/api/test/health.test.ts:5-63`.
- Existing DB schema is only marker: `packages/db/src/schema.ts:1-8`; add real Phase 1A schema plus generated migration.
- Existing UUID v7 helper: `packages/core/src/index.ts:1-11`; use for app-generated IDs.
- Existing EGI/channel/lead/handoff types: `packages/core/src/index.ts:13-114`.
- Locked decisions: Vite React, Fastify 5 Node 24, one app image, EGI omni-channel, Better Auth direction, REST/OpenAPI alignment, UUID v7, Drizzle+pg, raw SQL allowed for pgvector. `17_DECISIONS_LOCK.md:12-92`.
- RAG locks: `vector(1024)`, BAAI/bge-m3 target, metadata fields, source IDs, no draft indexing, safe fallback/prompt policy. `04_AI_RAG_RD.md:23-30,51-90,109-135,152-189`.
- Data/API table/endpoint source: `09_DATA_MODEL_API_RD.md:3-46,79-114` and `schema.sql:1-268`.

Success criteria:
- Admin UI has shell and routes for content entry, RAG document/chunk visibility, chat lab.
- API has validated admin endpoints for content CRUD/publish, RAG reindex/search-test, chat lab sessions/messages. Auth/role/tenant guard exists, even if approved Phase 1A stub.
- DB has Phase 1A tables only: tenant, minimal auth/admin tables, project/property/faq/content_version, rag_document/rag_chunk with pgvector, channel_conversation/channel_message, audit_log; optional minimal lead_score/handoff only if displayed.
- Worker can process/reindex published content into `rag_document`/`rag_chunk` with deterministic 1024-dim stub embeddings stored in pgvector.
- Chat lab retrieves chunks from Postgres and returns sourced answer or safe fallback. No hallucinated price/RERA/legal claims.
- OpenAPI updated/aligned for implemented endpoints.
- Tests cover route validation, publish->index path, no draft indexing, chat lab fallback/source response.

Hard constraints:
- No frontend direct access to Postgres/Redis/Twenty/Google/Meta/embedder/LLM.
- No Next.js, no Twenty fork/direct DB writes, no production `drizzle-kit push`, no UUID v4/ULID for business IDs.
- No live external credentials or synchronous dependency on LLM/embedder for public requests.
- Do not index drafts, internal sales notes, private lead conversations, unapproved social captions, or raw legal docs.
- Stub embeddings must be clearly labeled and deterministic.

Suggested approach:
1. Add DB schema in `packages/db/src/schema.ts`; use raw SQL migration for pgvector extension/vector/HNSW if needed; generate and review SQL.
2. Add repository/service layer for content publish, RAG document/chunk writes, deterministic embeddings, retrieval.
3. Add worker queue for RAG reindex using existing BullMQ runtime pattern.
4. Add Fastify route modules + injection tests for admin content/RAG/chat lab.
5. Replace starter web app with admin shell and minimal forms/views using existing UI Button plus app-local components.
6. Update OpenAPI contract and check script.
7. Run full validation contract and report residual risks.

Validation:
- Run commands listed in Validation Contract.
- Include DB vector smoke: insert chunk embedding and run cosine search.
- Include no-staged-files check.

Stop/escalation:
- Ask before choosing auth depth, content breadth, HNSW timing, admin lab channel enum, seed/bootstrap method, OpenAPI edit if unapproved, or changing locked decisions.
- Stop if Better Auth integration requires schema choices not approved.
- Stop if implementation would require live Meta/Twenty/Google/LLM credentials.

Resolved assumptions:
- Phase 1A can write requested output/context only now; future implementation can modify code after approval.
- Deterministic hash embeddings acceptable as safe stub if explicitly labeled.
- RAG/chatbot path outranks generic CMS polish.

## Acceptance report

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "Context-only handoff written to phase1/context-builder.md. Scope limited to Phase 1A planning: admin shell, content entry, pgvector RAG tables, chat lab skeleton. No product/source files edited."
    },
    {
      "id": "criterion-2",
      "status": "satisfied",
      "evidence": "Handoff includes current Phase 0 entry points with line references, locked RD evidence, Phase 1A table/API/UI recommendations, stub embedding options, validation contract, risks, user decisions, and compact worker meta-prompt."
    }
  ],
  "changedFiles": [
    "phase1/context-builder.md"
  ],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "find/read inspections across Real Estate Web RD, apps, packages, phase0",
      "result": "passed",
      "summary": "Reviewed requested docs plus Phase 0 API/web/worker/config/core/db patterns."
    },
    {
      "command": "nl -ba ... | sed ... for key docs and code files",
      "result": "passed",
      "summary": "Collected line-number evidence for locked decisions, RAG design, data/API design, OpenAPI, schema sketch, API app, tests, config, core, DB, worker, web, compose."
    },
    {
      "command": "git status --short && git diff --cached --name-only",
      "result": "passed",
      "summary": "No staged files. Working tree already contains Phase 0 changes/untracked files plus requested phase1/context-builder.md."
    }
  ],
  "validationOutput": [
    "No code tests run because task requested context build only and no source modifications.",
    "Requested output file created: phase1/context-builder.md"
  ],
  "residualRisks": [
    "Need user decisions on auth depth, content breadth, HNSW timing, admin lab channel value, seed/bootstrap method, OpenAPI edit approval, and stub embedding approval.",
    "OpenAPI currently lacks admin content/RAG endpoints needed by Phase 1A; must be updated if implementation approved.",
    "Better Auth integration details not researched live; implementation should verify current package API before coding."
  ],
  "noStagedFiles": true,
  "notes": "Only requested output file was written. Product/source files were not edited."
}
```
