# Phase 0 Context Builder

Scope: context only. No project/source files edited. Source of truth: `Real Estate Web RD/*`, with `17_DECISIONS_LOCK.md` winning conflicts.

## Current repo structure relevant to Phase 0

```text
.
├── package.json                 # pnpm + turbo root
├── pnpm-workspace.yaml          # apps/* + packages/* workspaces
├── turbo.json                   # build/lint/format/typecheck/dev tasks
├── tsconfig.json                # strict TS base, ES2022, bundler resolution
├── apps/
│   └── web/                     # existing Vite React app
├── packages/
│   └── ui/                      # existing shadcn/base-luma UI package
└── Real Estate Web RD/
    ├── 17_DECISIONS_LOCK.md     # hard decisions, active baseline
    ├── 16_CODEX_IMPLEMENTATION_PROMPT.md
    ├── 13_ROADMAP_BACKLOG.md
    ├── 09_DATA_MODEL_API_RD.md
    ├── 10_DEVOPS_VPS_RUNBOOK.md
    ├── api_contracts.openapi.yaml
    ├── docker-compose.skeleton.yml
    ├── env.example
    └── schema.sql               # planning sketch, not real migrations
```

Existing app/package files:
- `apps/web/package.json`, `src/App.tsx`, `src/main.tsx`, `vite.config.ts`, ESLint + TS configs. Vite app imports `@workspace/ui`.
- `packages/ui/package.json`, `src/components/button.tsx`, `src/styles/globals.css`, `src/lib/utils.ts`, shadcn components export map.
- Missing Phase 0 targets: `apps/api`, `apps/worker`, shared non-UI packages, Dockerfile, real compose files, Drizzle config/migrations, Vitest config/tests, OpenAPI check tooling.

## Existing package/workspace constraints

Evidence:
- Root `package.json:5-11`: root scripts delegate to Turbo: `build`, `dev`, `lint`, `format`, `typecheck`.
- Root `package.json:18-20`: `packageManager` locked to `pnpm@10.33.4`; engine only says `node >=20`, but docs lock runtime to Node 24 LTS.
- `pnpm-workspace.yaml:1-3`: only `apps/*` and `packages/*` are workspace packages. New `apps/api`, `apps/worker`, `packages/*` fit without workspace config changes.
- `turbo.json:4-22`: tasks assume each package may expose `build`, `lint`, `format`, `typecheck`, `dev`; build outputs `dist/**`; `.env*` included as inputs.
- `tsconfig.json:2-8`: strict TS, `target ES2022`, `module ESNext`, `moduleResolution bundler`.
- `apps/web/package.json:6-12`: existing web scripts: `dev`, `build` (`tsc -b && vite build`), `lint`, `format`, `typecheck`, `preview`.
- `apps/web/package.json:14-34`: React 19.2, Vite 8, TS 6, Tailwind 4, shadcn-compatible UI dependency.
- `packages/ui/package.json:40-45`: exports `globals.css`, `lib/*`, `components/*`, `hooks/*`; keep this stable for frontend.
- Lockfile search shows no Fastify/BullMQ/Drizzle/Vitest/Playwright deps currently installed; `zod` exists through UI package only.

Implications:
- Add new workspace packages with package names likely `api`, `worker`, and scoped shared packages (`@workspace/config`, `@workspace/db`, `@workspace/core`, `@workspace/contracts` or similar).
- Keep Vite/shadcn setup intact. Do not turn `apps/web` into Next.js or split production frontend/API images.
- Each new package should expose Turbo-compatible scripts. Use `dist/**` output if built.
- Root Node engine should probably become `>=24` or `^24` during Phase 0, because docs lock Node.js 24 LTS (`17_DECISIONS_LOCK.md:19`, `02_TRD.md:12-13`). Ask/confirm if package engines may be tightened.

## Locked product/architecture constraints

Source-backed facts:
- Vite + React, no Next.js App Router for V1: `17_DECISIONS_LOCK.md:12-15`.
- Fastify 5 on Node.js 24 LTS: `17_DECISIONS_LOCK.md:19-24`.
- Production runtime split: one custom app image; `app` serves `/api/v1/*` plus built Vite assets; `worker` uses same image, different command; Postgres, Redis, upstream Twenty services separate: `17_DECISIONS_LOCK.md:26-34`.
- Twenty integration: upstream self-hosted only, no fork, no direct Twenty DB writes; use typed adapter + outbox jobs: `17_DECISIONS_LOCK.md:36-44`.
- Omni-channel EGI direction: website chat, WhatsApp Business Platform, Instagram DM through official APIs/webhooks into normalized pipeline; store conversations/consent/source IDs/lead score/handoff/action traces in app DB: `17_DECISIONS_LOCK.md:46-53`.
- Auth: Better Auth with Fastify; auth storage in app DB; admin roles/tenant checks in API; no frontend-only auth decisions: `17_DECISIONS_LOCK.md:55-60`.
- API: REST, OpenAPI 3.1 external contract, Fastify schemas aligned with `api_contracts.openapi.yaml`: `17_DECISIONS_LOCK.md:62-68`.
- IDs: UUID v7 only for primary/public entity IDs, stored in Postgres `uuid`: `17_DECISIONS_LOCK.md:70-75`.
- Tests: Vitest for API/worker/shared, Fastify injection tests, Playwright once UI flows exist, Phase 0 must include API health test once API exists: `17_DECISIONS_LOCK.md:77-82`.
- Data: Drizzle ORM with `drizzle-orm/node-postgres` + `pg`; `drizzle-kit generate`; commit generated SQL; no production `drizzle-kit push`; `schema.sql` remains reference until replaced: `17_DECISIONS_LOCK.md:84-92`.
- Maps: MapLibre, no public OSM tile/Nominatim production dependency: `17_DECISIONS_LOCK.md:94-100`.
- Uploads: local `/data/uploads`, multipart -> temp private path -> limits -> magic-byte/type validation -> ClamAV -> image/PDF validation -> Sharp -> final storage; no public exposure until clean: `17_DECISIONS_LOCK.md:102-111`.

## Phase 0 scope from docs

`16_CODEX_IMPLEMENTATION_PROMPT.md:31-51` and `13_ROADMAP_BACKLOG.md:5-19` define Phase 0 only:
- Confirm monorepo layout for `apps/web`, `apps/api`, `apps/worker`, shared packages.
- Keep existing Vite/shadcn frontend.
- Add Fastify API skeleton with health endpoint, request ID logging, production static serving plan.
- Add Vitest/Fastify injection health test once API exists.
- Add Node/BullMQ worker skeleton using same image, different command.
- Add Drizzle + `pg` scaffold and `drizzle-kit generate` workflow; no full product schema.
- Add env validation.
- Add Better Auth plan/minimal skeleton using Drizzle/Postgres.
- Add audit log types/interface, channel adapter interfaces, webhook verification placeholders, lead scoring/handoff interfaces.
- Add MapLibre/provider config types only; no map UI.
- Add upload config/types and ClamAV health path only; no full media manager.
- Add Docker Compose dev/prod skeleton alignment; app+worker same image.
- Add OpenAPI generation/check plan or static validation.

Phase 0 non-goals: no CMS CRUD, full media manager, map UI, full RAG chatbot, live WhatsApp/Instagram messaging, full Twenty sync, scheduler, social publishing, analytics dashboard, voice, payments, SaaS control plane (`16_CODEX_IMPLEMENTATION_PROMPT.md:66-85`).

## OpenAPI/schema/docker/env context

OpenAPI:
- `api_contracts.openapi.yaml:1-7`: OpenAPI 3.1, base server `https://clientdomain.com/api/v1`.
- `api_contracts.openapi.yaml:9-18`: `GET /health` returns `HealthResponse`. This should be first implemented route and Fastify injection test target.
- `api_contracts.openapi.yaml:70-85`: `POST /leads` later captures lead + enqueues Twenty sync; Phase 0 should not implement full behavior.
- `api_contracts.openapi.yaml:86-120`: chat session/message endpoints exist in contract; Phase 0 only placeholder interfaces/types if any.
- `api_contracts.openapi.yaml:121-140+`: WhatsApp/Instagram webhook verify and receive endpoints exist; Phase 0 placeholders only, no live credentials.

Schema:
- `schema.sql:1-3`: planning sketch only; real migrations must be generated and reviewed; IDs UUID v7.
- `schema.sql:4`: `vector` extension planned.
- `schema.sql:6-90+`: high-level tables begin with `tenant`, `project`, `property_listing`, `media_asset`, `content_version`; later includes channel/lead/handoff/audit/outbox tables. Do not model full schema in Phase 0.

Docker skeleton:
- `docker-compose.skeleton.yml:19-38`: Postgres pgvector image and Redis service.
- `docker-compose.skeleton.yml:40-63`: `app` and `worker` both use `ghcr.io/khanect/realestate-app:${APP_VERSION}`; commands differ (`dist/api/index.js`, `dist/worker/index.js`); both mount uploads.
- `docker-compose.skeleton.yml:65-74`: ClamAV service and healthcheck.
- `docker-compose.skeleton.yml:91-106`: official Twenty server/worker services.
- `docker-compose.skeleton.yml:108-116`: backup service skeleton.

Env:
- `env.example:2-9`: app/API URLs, Vite API base, CRM base, CORS.
- `env.example:11-15`: Postgres app/Twenty DB URLs and Redis.
- `env.example:17-21`: Map config placeholders.
- `env.example:23-25`: Better Auth + encryption secrets.
- `env.example:27-29`: Twenty API config.
- `env.example:37-49`: Meta/WhatsApp/Instagram vars disabled-capable.
- `env.example:58-68`: upload dirs, ClamAV host/port/timeout, backup retention, log level.

## Likely files to create/edit if Phase 0 approved

Root/workspace:
- `package.json`: add deps/scripts only as needed; probably set Node engine to Node 24 after approval.
- `pnpm-lock.yaml`: dependency changes.
- `turbo.json`: likely no change unless adding custom test task.
- `tsconfig.json` or `tsconfig.base.json`: optional shared strict base for Node packages.
- `.env.example` at repo root may be created from docs `env.example`, or docs file may remain source and app packages validate same vars.

API app:
- `apps/api/package.json`
- `apps/api/tsconfig.json`
- `apps/api/src/index.ts` server entry
- `apps/api/src/app.ts` Fastify app factory for injection tests
- `apps/api/src/routes/health.ts`
- `apps/api/src/plugins/request-id.ts` or use Fastify request id/logger config
- `apps/api/src/plugins/static.ts` or server setup for production Vite asset serving plan
- `apps/api/src/routes/webhooks/meta.ts` placeholders only if included
- `apps/api/src/routes/uploads/health.ts` ClamAV health path only if included
- `apps/api/test/health.test.ts`
- `apps/api/vitest.config.ts`

Worker:
- `apps/worker/package.json`
- `apps/worker/tsconfig.json`
- `apps/worker/src/index.ts`
- `apps/worker/src/queues.ts` BullMQ connection placeholder
- `apps/worker/test/*.test.ts` optional smoke/interface tests if package exists
- `apps/worker/vitest.config.ts`

Shared packages likely useful:
- `packages/config`: env validation (`zod` or equivalent), typed runtime config for API/worker. Include map/upload/clamav/auth/twenty/meta booleans; no real secret values.
- `packages/db`: `pg.Pool`, Drizzle client, minimal schema scaffold, `drizzle.config.ts` maybe root or package-local, migrations folder. Include only baseline tables needed for auth/audit placeholder if approved; avoid full schema.
- `packages/core` or `packages/domain`: UUID v7 utility, audit interface/types, channel adapter interfaces, lead scoring/handoff placeholder types.
- `packages/contracts`: shared schemas/OpenAPI validation helpers or route schema exports if desired.

Drizzle:
- `drizzle.config.ts` at root or `packages/db/drizzle.config.ts`.
- `packages/db/src/schema.ts` minimal schema only.
- `packages/db/src/client.ts` Drizzle + `pg` pool.
- `packages/db/migrations/` for generated SQL.
- Script `db:generate`: `drizzle-kit generate` only. Avoid `drizzle-kit push` production path.

Docker/ops:
- `Dockerfile` for one image containing built web assets + API + worker dist.
- `docker-compose.yml` and/or `docker-compose.dev.yml` aligned to docs.
- `scripts/backup-loop.sh` only if compose references real backup script.
- Static-serving path from API to web build must match Dockerfile output.

OpenAPI validation:
- Either static validator script against `Real Estate Web RD/api_contracts.openapi.yaml` or generation/check plan.
- Route schemas should start from health route and keep `/api/v1/health` behavior aligned with contract path `/health` under base server `/api/v1`.

## Risks / unknowns before coding

1. Node version mismatch: root engine says `>=20`; docs lock Node.js 24 LTS. Need approval to tighten engine and use Node 24 base image.
2. Workspace names not specified: need choose package names. Low-risk if internal private packages use `@workspace/*`.
3. Better Auth Drizzle/Postgres exact integration may require checking current Better Auth package API at implementation time; docs demand Fastify + app DB.
4. Fastify static-serving path depends on chosen build layout/Dockerfile. Need avoid serving unbuilt local files in prod.
5. OpenAPI alignment method undecided: generation from route schemas vs static validation against contract. Phase 0 can implement static validation plan/check only.
6. Drizzle minimal schema boundary: Better Auth may need tables; Phase 0 says scaffold, not full schema. If adding Better Auth real schema, keep minimal and reviewed.
7. UUID v7 generation choice: PostgreSQL 18 UUID v7 if available vs application utility. Need implementation confirm library/API; must not use UUID v4/ULID.
8. Compose skeleton says review official Twenty compose vars before production. Phase 0 should not claim production-ready Twenty env.
9. ClamAV health check path can verify TCP/connectivity/version only; no upload scan flow in Phase 0.
10. No real credentials required. Stop if task needs Twenty/Google/Meta/WhatsApp/Instagram secrets (`16_CODEX_IMPLEMENTATION_PROMPT.md:63-64`).

## Recommended validation contract for Phase 0 implementation

Minimum required once Phase 0 code exists:
- `pnpm typecheck` passes at root.
- `pnpm --filter web build` or `pnpm --dir apps/web build` passes.
- `pnpm --filter api typecheck` passes.
- `pnpm --filter api test` passes with Fastify injection test for `GET /api/v1/health` or route registered under `/api/v1` returning body matching OpenAPI `HealthResponse`.
- `pnpm --filter worker typecheck` passes.
- `pnpm --filter worker test` passes if worker tests/config added.
- `pnpm lint` passes if lint scripts added/changed.
- `pnpm exec drizzle-kit generate --config <config>` works when schema changes exist, or documented no-op if no schema changes.
- `docker compose config` passes for any compose file changed/created.
- OpenAPI contract validation command passes if implemented; otherwise documented manual mapping health route -> `api_contracts.openapi.yaml`.
- `git diff --cached --name-only` empty unless user explicitly staged changes.

Acceptance must include changed files, commands run, outputs, residual risks.

## Clarification questions needing user input

1. Approve tightening root Node engine from `>=20` to Node 24 LTS? Docs lock Node 24, but package currently allows 20+.
2. Preferred shared package names? Default recommendation: `@workspace/config`, `@workspace/db`, `@workspace/core`, maybe `@workspace/contracts`.
3. Should Phase 0 create real compose files at repo root, or keep only docs skeleton and Dockerfile until env/domain details firm?
4. Better Auth depth in Phase 0: minimal integration plan/stub only, or real package + minimal DB tables/session endpoints?
5. OpenAPI alignment preference: generate OpenAPI from Fastify schemas later, or keep docs OpenAPI as source and add static validation/check now?

## Compact implementation meta-prompt for Phase 0 worker

Goal: Implement Phase 0 foundation only for Khanect Omni Realty. Preserve existing Vite/shadcn frontend. Add Fastify 5 API skeleton, Node/BullMQ worker skeleton, shared config/db/core scaffolds, env validation, Drizzle + `pg` migration workflow, UUID v7 utility, audit/channel/lead/handoff interfaces, ClamAV/upload/map config placeholders, Docker one-image alignment, and validation scripts/tests. Do not build product features.

Context/evidence:
- Docs source of truth: `Real Estate Web RD/17_DECISIONS_LOCK.md` wins conflicts.
- Must follow Vite + React, Fastify 5 on Node 24, one custom app image with `app` and `worker` commands, upstream Twenty only, omni-channel EGI direction (`17_DECISIONS_LOCK.md:12-53`).
- Use Better Auth + Fastify + app DB roles/tenant checks direction (`17_DECISIONS_LOCK.md:55-60`).
- REST/OpenAPI 3.1; route schemas align with `Real Estate Web RD/api_contracts.openapi.yaml` (`17_DECISIONS_LOCK.md:62-68`). First route: `GET /api/v1/health`, mapped to contract `/health` under base `/api/v1` (`api_contracts.openapi.yaml:5-18`).
- IDs UUID v7 only (`17_DECISIONS_LOCK.md:70-75`).
- Tests: Vitest + Fastify injection for API health once API exists (`17_DECISIONS_LOCK.md:77-82`).
- Drizzle ORM + `drizzle-orm/node-postgres` + `pg`; generate migrations with `drizzle-kit generate`; no production push (`17_DECISIONS_LOCK.md:84-92`).
- Maps/upload constraints: MapLibre provider config only; ClamAV health/upload config only; no map UI/media manager (`17_DECISIONS_LOCK.md:94-111`, `16_CODEX_IMPLEMENTATION_PROMPT.md:43-44,70-72`).
- Existing workspaces: `apps/*`, `packages/*`; existing packages are `apps/web` and `packages/ui`; keep them working.

Success criteria:
- `apps/api` exists with Fastify app factory, server entry, `/api/v1/health`, request ID logging, production static serving plan/path, Vitest injection test.
- `apps/worker` exists with BullMQ/Redis connection placeholder and safe startup/shutdown.
- Shared packages provide typed env validation, Drizzle/pg scaffold, UUID v7 utility, audit/channel/lead/handoff interfaces. No full product schema.
- Dockerfile/compose alignment shows one custom image reused by `app` and `worker` with different commands and services from docs skeleton.
- OpenAPI alignment is checked or clearly planned with command/script.
- Existing web build/typecheck remain green.
- No locked decisions violated. No real credentials required.

Hard constraints:
- No Next.js. No Twenty fork. No direct Twenty DB writes. No frontend direct access to Postgres/Redis/Twenty/Google/Meta/embedder/LLM.
- No Kysely/Prisma/TypeORM/raw-only replacement for Drizzle + `pg`.
- No `drizzle-kit push` production workflow.
- No UUID v4/ULID for business IDs.
- No test runner besides Vitest/Playwright baseline.
- No public OSM tile/Nominatim production dependency.
- No public upload exposure before validation + ClamAV clean verdict.
- No real external credentials in code/tests.

Suggested approach:
1. Add workspace package skeletons with scripts matching Turbo tasks.
2. Add shared config first; validate docs `env.example` variables needed for API/worker.
3. Add API app factory and health route; write Fastify injection test.
4. Add worker entry and queue placeholder using env Redis URL.
5. Add Drizzle config/client/schema scaffold and generate workflow, keeping schema minimal.
6. Add Dockerfile/compose alignment with same image, different commands; keep official Twenty services upstream.
7. Add OpenAPI validation/check or documented route-contract mapping.
8. Run validation commands and report exact output.

Validation:
- `pnpm install` if dependencies changed.
- `pnpm typecheck`
- `pnpm --filter web build`
- `pnpm --filter api typecheck && pnpm --filter api test`
- `pnpm --filter worker typecheck` and worker tests if present
- `docker compose config` for changed compose files
- Drizzle generate/check command if configured
- OpenAPI validation command if added
- `git diff --cached --name-only`

Stop/escalate:
- Stop before changing locked architecture docs or making decisions listed in clarification questions without approval.
- Stop if Better Auth/current dependency docs contradict locked plan.
- Stop if implementation would require real Twenty/Google/Meta/WhatsApp/Instagram credentials or production secrets.

Resolved assumptions:
- Repo is already pnpm/turbo monorepo.
- Existing Vite web and UI package should stay intact.
- Phase 0 is foundation only; no product CRUD/chat/CRM live features.

## Acceptance report

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "Created context-only handoff at phase0/context-builder.md; no project/source files modified. Scope limited to Phase 0 foundation analysis and worker meta-prompt."
    },
    {
      "id": "criterion-2",
      "status": "satisfied",
      "evidence": "Handoff cites repo files, workspace constraints, docs lock lines, OpenAPI/schema/docker/env evidence, risks, validation contract, and clarification questions."
    }
  ],
  "changedFiles": [
    "phase0/context-builder.md"
  ],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "ls/find/read/grep inspections across root, apps, packages, Real Estate Web RD",
      "result": "passed",
      "summary": "Confirmed existing web/UI workspaces, docs locks, docker skeleton, env example, OpenAPI contract, schema sketch."
    },
    {
      "command": "bash nl/sed evidence extraction for package/workspace/docs files",
      "result": "passed",
      "summary": "Collected line-numbered evidence for package constraints and locked Phase 0 decisions."
    },
    {
      "command": "git status --short && git diff --cached --name-only",
      "result": "passed",
      "summary": "No staged files. Working tree already has other unstaged/untracked files; task-created output is phase0/context-builder.md."
    }
  ],
  "validationOutput": [
    "Context file written. No code/test validation run because task was context building only and project source edits were prohibited."
  ],
  "residualRisks": [
    "Working tree not clean before/after task: git status shows unstaged package.json modification plus untracked .agents/, .pi/, Real Estate Web RD/, phase0/, skills-lock.json. Only task-created file is phase0/context-builder.md.",
    "Implementation still needs user decisions on Node 24 engine tightening, package names, compose depth, Better Auth depth, OpenAPI alignment method."
  ],
  "noStagedFiles": true,
  "notes": "No project/source files modified; only requested output file created."
}
```
