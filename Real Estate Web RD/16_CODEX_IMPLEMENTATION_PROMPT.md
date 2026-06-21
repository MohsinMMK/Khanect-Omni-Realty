# Codex Implementation Prompt

You are building V1 of a self-hosted Real-Estate Omni-Channel AI Web App for high-revenue real-estate businesses.

Before coding, read these docs in this order:

1. `17_DECISIONS_LOCK.md`
2. `01_PRD.md`
3. `02_TRD.md`
4. `03_ARCHITECTURE_RD.md`
5. `09_DATA_MODEL_API_RD.md`
6. `10_DEVOPS_VPS_RUNBOOK.md`
7. `11_SECURITY_COMPLIANCE_RD.md`
8. `13_ROADMAP_BACKLOG.md`

## Hard constraints

- Single VPS V1.
- Vite + React frontend for V1.
- Fastify 5 API on Node.js 24 LTS.
- Production uses one custom app image: Fastify serves `/api/*` plus built Vite assets from the `app` container.
- Node/BullMQ worker for background jobs uses the same custom app image with a different command.
- Twenty CRM only, as upstream self-hosted service on the same VPS. Do not fork Twenty, modify Twenty source, or merge Twenty UI into the custom app for V1. Use API/outbox/deep links for seamless interaction.
- Omni-channel chatbot target: website chat, WhatsApp Business Platform, and Instagram Messaging/DM through official APIs/webhooks and shared EGI pipeline.
- No monday CRM, HubSpot, Supabase, Firebase, Pinecone, Algolia, n8n, Zapier, Make, or third-party automation middleware.
- Google Workspace/Gmail OAuth only for email/calendar; no SMTP/IMAP/Microsoft in V1.
- PostgreSQL 18 + pgvector for relational + vector data.
- Local-first AI via BGE-M3 embeddings and Ollama/vLLM adapter.
- Vite frontend must never connect directly to Postgres, Redis, Twenty, Google, Meta, embedder, or LLM services. CRM-lite screens must go through Fastify API only.

## Phase 0 only: foundation task

Do not build full product features yet. Build only the foundation that later phases can safely use.

Scope:

- Confirm monorepo layout for `apps/web`, `apps/api`, `apps/worker`, and shared packages.
- Keep existing Vite/shadcn frontend setup.
- Add Fastify API service skeleton with health endpoint, request ID logging, and production static serving plan for built Vite assets.
- Add one Vitest/Fastify injection test for the API health endpoint once `apps/api` exists.
- Add worker skeleton with BullMQ connection placeholder.
- Add Drizzle + `pg` data layer scaffold and `drizzle-kit generate` migration workflow, but do not model the full product schema in Phase 0.
- Add MapLibre/provider configuration types and environment validation only; do not build maps UI in Phase 0.
- Add upload configuration/types and ClamAV health check path only; do not build full media manager in Phase 0.
- Add Docker Compose dev/prod skeleton alignment for `app`, `worker`, Postgres, Redis, upstream Twenty services, ClamAV, and backup. `app` and `worker` must use the same custom app image.
- Add environment variable validation.
- Add Better Auth integration plan or minimal auth skeleton using the locked Drizzle/Postgres direction.
- Add audit log interface/types, not full audit UI.
- Add channel adapter interfaces/types for website, WhatsApp, and Instagram DM, plus webhook verification placeholders. Do not require live credentials in Phase 0.
- Add lead scoring/handoff interfaces and placeholder schemas; do not build scoring UI in Phase 0.
- Add OpenAPI contract generation/check plan, or static contract validation.

## Stop conditions

Stop and ask before implementation if any of these are unresolved:

- Any code replaces locked Drizzle + `pg` data layer with Kysely, Prisma, TypeORM, or raw-only `node-postgres` without updating `17_DECISIONS_LOCK.md` first.
- Any code uses `drizzle-kit push` for production migrations.
- Any code tries to use ULID or UUID v4 instead of locked UUID v7 for business IDs.
- Any code adds another test runner instead of locked Vitest + Playwright baseline.
- Any code depends on public OSM tile servers or public Nominatim for production.
- Any code exposes uploaded files publicly before validation and ClamAV clean verdict.
- Any doc still says Next.js is V1 target.
- Any task requires real Twenty API credentials, Google OAuth credentials, Meta/WhatsApp/Instagram credentials, or production secrets.

## Explicit non-goals for Phase 0

Do not build:

- Property CMS CRUD.
- Full media manager.
- Map UI.
- Full RAG chatbot.
- Live WhatsApp/Instagram messaging.
- Full lead scoring/handoff UI.
- Full Twenty CRM sync beyond stubs/interfaces.
- Full CRM-lite UI beyond status/deep-link placeholders.
- Twenty source-code fork or custom Twenty UI build.
- Scheduler.
- Social publishing.
- AI image editing/generation.
- Analytics dashboard.
- Voice.
- Payments.
- Multi-tenant SaaS control plane.

## Verification gates

Before saying done, run and report:

- `pnpm typecheck`
- frontend build command for `apps/web`
- API typecheck and Vitest command if API package exists
- worker typecheck and Vitest command if worker package exists
- Playwright command once browser E2E specs exist
- Docker Compose config validation if compose files were changed

All changes must preserve the decisions in `17_DECISIONS_LOCK.md`.
