# Decisions Lock

Date: 21 June 2026
Status: active pre-coding baseline

This file records decisions that coding agents must treat as locked unless the owner explicitly reopens them. If another document conflicts with this file, this file wins and the conflicting document must be patched before coding continues.

## Locked decisions

### D1: Frontend framework

- Use Vite + React for V1 frontend.
- Do not target Next.js App Router for V1.
- Build frontend as static assets served by Fastify from the `app` container in production.
- All privileged operations go through Fastify API routes; frontend never connects directly to Postgres, Redis, Twenty, Google, Meta, embedder, or LLM services.

### D2: Backend API framework

- Use Fastify 5 on Node.js 24 LTS for the V1 API.
- Reason: June 2026 research shows Fastify remains the strongest production default for long-running Node.js APIs when the priorities are throughput, low overhead, schema validation, plugin maturity, structured logging, and Docker/VPS operations.
- Hono remains a good cross-runtime/edge option but is not chosen for this Node-only VPS API.
- Elysia remains Bun-first and is not chosen because V1 standardizes on Node 24 LTS.
- Express remains viable but is not chosen because Fastify gives better performance and stronger built-in validation architecture.
- NestJS is not chosen for V1 because the product needs a lean API and worker, not a heavyweight enterprise framework.

### D3: Runtime split

- `app`: one custom app image. Fastify serves `/api/v1/*` plus the built Vite React public site, admin UI, and chatbot UI static assets.
- `worker`: same custom app image, different command, running Node/BullMQ background jobs for CRM sync, RAG indexing, Google/Gmail, Meta publishing, analytics rollups, uploads, and backups.
- `postgres`: one PostgreSQL server with separate app and Twenty databases/schemas as required by official deployment.
- `redis`: BullMQ, rate-limit state, cache/session support where needed, and Twenty dependency.
- `twenty-server`/`twenty-worker`: official upstream Twenty containers.

V1 is one custom product web app and one custom app image. It is not a Twenty fork and not a separate frontend/API deployment in production. The worker runs from the same image to keep VPS operations simple.

### D4: Twenty integration mode

- Use upstream self-hosted Twenty CRM as a separate service/dependency.
- Do not fork Twenty, edit Twenty source code, or merge Twenty UI into the custom web app for V1.
- Configure Twenty through its supported workspace UI/API: custom fields, optional custom objects, API keys, and webhooks where needed.
- Integrate through a typed app-side adapter and outbox jobs. Do not write directly to Twenty database tables.
- Treat Twenty CRM database as source of truth for CRM records after sync: People, Companies, Opportunities, Tasks, Notes, pipeline stages, and sales activity.
- Treat the app database as source of truth for website CMS, property content, bookings, chat/RAG, omni-channel conversations, lead scoring, analytics, consent/audit, upload metadata, and CRM sync state.
- Provide seamless app-to-CRM interaction through CRM-lite admin panels, sync status, CRM IDs, and deep links to `crm.clientdomain.com`; do not duplicate full CRM UI.

### D4a: Omni-channel chatbot and EGI channel framework

- The core product is an omni-channel real-estate AI chatbot plus CMS/CRM/social automation, not only a website chatbot.
- Supported channel targets are website chat, WhatsApp Business Platform, and Instagram Messaging/DM through official APIs and webhooks.
- Use an internal EGI channel framework: channel events enter one normalized message pipeline, grounded AI generates safe responses/actions from approved RAG content, and integrations execute approved actions such as links, lead capture, booking, CRM sync, and human handoff.
- The web app must include an admin/test chatbot UI so admins can test prompts, content, RAG source coverage, lead scoring, and handoff rules before enabling live channels.
- Store channel conversations, consent state, source IDs, lead score, handoff state, and action traces in the app database. Sync summaries and actionable sales tasks to Twenty.
- Human handoff is mandatory when confidence is low, user asks sensitive legal/financial questions, lead score is high, or the user requests a person.

### D5: Auth direction

- Use Better Auth with Fastify integration.
- Auth storage belongs to the app database.
- Admin roles and tenant checks are enforced in the Fastify API.
- Frontend uses the Better Auth client/session endpoints; no frontend-only auth decisions.

### D6: API contract direction

- REST remains the V1 API style.
- OpenAPI 3.1 is the external contract.
- Fastify route schemas must stay aligned with `api_contracts.openapi.yaml`.
- Public mutations require validation, rate limits, bot checks where applicable, consent checks, and idempotency where applicable.
- Admin mutations require authenticated user, role check, tenant check, audit log, and idempotency where applicable.

### D7: ID format

- Use UUID v7 for all primary keys and public entity IDs.
- Store IDs in PostgreSQL `uuid` columns.
- Prefer PostgreSQL 18 UUID v7 generation when available; otherwise generate UUID v7 in the application with one shared utility.
- Do not mix ULID, UUID v4, and UUID v7 for business entities.

### D8: Test baseline

- Use Vitest for API, worker, validators, adapters, and shared package tests.
- Use Fastify injection/light-my-request style tests for API routes where possible.
- Use Playwright for browser E2E and launch smoke flows once UI routes exist.
- Phase 0 must include at least typecheck plus one passing API health test once `apps/api` exists.

### D9: Data access and migrations

- Use Drizzle ORM with `drizzle-orm/node-postgres` as the default API/worker data access layer.
- Use `pg` connection pooling underneath Drizzle.
- Use `drizzle-kit generate` to create SQL migration files from TypeScript schema changes.
- Commit generated SQL migrations and review them before applying.
- Do not use `drizzle-kit push` in production.
- Keep `schema.sql` as a planning/reference sketch until replaced by real migrations.
- Raw SQL is explicitly allowed for pgvector types/indexes, UUID v7 defaults, HNSW indexes, advisory locks, complex booking transactions, analytics rollups, and advanced RAG retrieval queries.

### D10: Maps and geocoding

- Use MapLibre GL JS as the frontend map renderer.
- Do not use public `tile.openstreetmap.org` or public Nominatim as production dependencies; OSM data is free, public OSM-operated services are best-effort and capacity-limited.
- Use a configurable paid or self-hosted OSM-derived tile/geocoding provider for production.
- Keep Google Maps as an optional client-approved provider only when Places/address accuracy justifies billing and vendor dependency.
- Store coordinates in the app database; do not geocode on every page load.

### D11: Uploads, media, and malware scanning

- V1 stores app uploads on the VPS filesystem under `/data/uploads`; do not add S3/MinIO unless local storage becomes a real bottleneck or the client approves object storage.
- Upload flow: Fastify multipart stream -> temporary private path -> size limit -> magic-byte/type validation -> ClamAV scan -> image/PDF validation -> Sharp image transforms -> final storage -> media metadata row.
- Never trust original filenames. Generate UUID v7 object names and store original filenames only as metadata.
- Allowed V1 uploads: JPG, PNG, WebP, AVIF images; PDF floor plans/brochures.
- Disallowed V1 uploads: SVG, HTML, JavaScript, archives, executables, Office macros, and video.
- Default limits: images 15 MB each, PDFs 25 MB each, max 20 files per property/project draft unless changed by owner.
- Strip image metadata from optimized public variants. Preserve originals only in private storage.
- Publish only clean scanned files. Suspicious files are deleted or quarantined and never become public.

### D12: Integration compliance constraints

- Google Gmail uses least-privilege `gmail.send` for V1 email send. Do not request full mailbox scopes in V1.
- Google Calendar uses the narrowest scope that supports creating/updating/cancelling app-created booking events. Calendar sync is not the transactional booking source of truth.
- Configure Google OAuth consent, verified domains, privacy policy, and separate test/prod projects before production.
- WhatsApp Business Platform integration requires official Cloud API/Business Management API setup, WABA/phone number ownership, webhooks, approved templates for business-initiated messages, and platform rate-limit/quality checks.
- Instagram Messaging/DM integration requires official Meta messaging APIs, business/professional account setup, webhook handling, and platform permission approval.
- Instagram/Meta publishing requires a professional account, Business Login/Facebook Login, content publishing permission, container creation, publish call, public media URL requirements where applicable, and app-side rate-limit checks.
- Enforce conservative Instagram publish caps and query platform publishing-limit endpoints where available.
- DPDP consent notice must be clear, standalone, purpose-specific, versioned, and stored before PII is persisted.
- RERA fields/warnings assist compliance but never certify legal compliance.
