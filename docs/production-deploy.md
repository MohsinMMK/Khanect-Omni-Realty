# Production deploy notes

Operational checklist for running Khanect Omni Realty outside local dev. Production admin routes accept **Better Auth sessions** (when enabled) or **`ADMIN_API_KEY`** as a break-glass fallback.

References: [WhatsApp Cloud API send messages](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages), [Instagram Messaging API](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api/), [Better Auth Fastify](https://www.better-auth.com/docs/integrations/fastify).

## Required services

| Service | Role | Health |
|---|---|---|
| `app` (Fastify API) | Admin + widget + Meta webhooks | `GET /api/v1/health` (liveness), `GET /api/v1/health/ready` (readiness) |
| `worker` (BullMQ) | Async `rag.index` jobs | `GET http://<worker>:3001/` (`WORKER_HEALTH_PORT`) |
| `postgres` (pgvector) | Platform + RAG + auth sessions | `pg_isready` |
| `redis` | BullMQ queue | `redis-cli ping` |
| `rag-embedder` (optional) | Local 1024-dim embeddings | `GET /health` |
| `agno-agent` (optional) | Grounded LLM runtime | `GET /health` |
| `clamav` (optional) | Upload scanning | `GET /api/v1/health/clamav` |

## Environment (production)

Set `NODE_ENV=production` and provide real secrets (enforced by `@workspace/config`):

### Platform core

- `ADMIN_API_KEY` — break-glass admin access (header `x-khanect-admin-api-key` or `Authorization: Bearer`)
- `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `ENCRYPTION_KEY` — Better Auth sessions + encrypted project AI keys
- `DATABASE_URL`, `REDIS_URL`
- `PLATFORM_STORE=postgres` (memory is rejected in production)
- `RAG_INDEX_SYNC=false` — publish enqueues `rag.index` via BullMQ

### Platform-default AI (fallback when a project uses “Platform default”)

Recommended on an **8 GB VPS** without room for BGE-M3:

```bash
EMBEDDING_PROVIDER=openai
OPENAI_API_KEY=sk-...
EMBEDDING_DIMENSION=1024
LLM_API_KEY=sk-...
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
```

Local embeddings instead:

```bash
EMBEDDING_PROVIDER=local
EMBEDDER_URL=http://rag-embedder:8080
```

### Per-project AI keys

Each business project can override platform defaults in the admin UI (**Projects → ⋮ → AI keys**):

- **LLM answers** tab — OpenAI-compatible key for chat replies
- **Embeddings** tab — separate key or embedder URL for RAG indexing

Keys are stored encrypted in `project_ai_config` using `ENCRYPTION_KEY`. After deploy:

1. `pnpm db:migrate` (includes `0004_project_ai_config`)
2. Open each project → **AI keys** → set **This project** where tenants need isolation
3. Run **Test LLM key** and **Test embedding key** before publishing content

### Meta channels (WhatsApp + Instagram DM)

```bash
META_WEBHOOK_VERIFY_TOKEN=...
WHATSAPP_ENABLED=true
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_ACCESS_TOKEN=...
INSTAGRAM_MESSAGING_ENABLED=true
INSTAGRAM_PAGE_ID=...          # Instagram professional account / page id for Graph send
INSTAGRAM_ACCESS_TOKEN=...
```

Activate the connector in **Connect** (`active` status) for the target chatbot. Inbound webhooks ground replies through the same RAG path as the website widget.

### Optional

- `AGNO_SERVICE_TOKEN` when `AGNO_ENABLED=true`
- `WIDGET_RATE_LIMIT_MAX` (default `30`), `WIDGET_RATE_LIMIT_WINDOW_MS` (default `60000`)
- `SHUTDOWN_TIMEOUT_MS` (default `30000`)

## Compose profiles

**Default (stub embeddings, fast CI/dev):**

```bash
docker compose -f docker-compose.phase0.yml up -d
```

**Smoke override** (host Redis / alternate API port): `docker-compose.smoke.yml`

**BGE-M3 embeddings** (CPU, downloads model on first start):

```bash
docker compose -f docker-compose.phase0.yml -f docker-compose.bge-m3.yml up -d rag-embedder
```

## Verification gates

```bash
pnpm test
pnpm check:compose
pnpm check:openapi
pnpm smoke:rag-pipeline
pnpm smoke:bge-embedder          # requires running bge-m3 embedder
pnpm smoke:bge-embedder:docker
```

## Rollout order

1. **Migrate database:** `pnpm db:migrate`
2. Start **postgres** + **redis** (+ **rag-embedder** if using local embeddings; wait healthy)
3. Start **worker** (wait healthy on `:3001`)
4. Start **app** (wait `GET /api/v1/health/ready` = 200)
5. Configure **platform-default AI** env vars; optionally set **per-project keys** in admin
6. Publish test content → confirm worker indexes (`runtimeStatus: ready`)
7. Smoke widget: `POST /api/v1/widget/{publicKey}/message`
8. Register Meta webhooks and send a test DM

## Meta webhooks (live ingress + replies)

Register in Meta developer console:

- WhatsApp: `GET/POST /api/v1/webhooks/meta/whatsapp`
- Instagram: `GET/POST /api/v1/webhooks/meta/instagram`

Verification uses `META_WEBHOOK_VERIFY_TOKEN`. POST handlers parse inbound text, resolve the first chatbot with an **active** connector for that channel, generate a grounded answer, and send a reply via Graph API:

- WhatsApp: `POST /{phone-number-id}/messages` ([docs](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages))
- Instagram: `POST /{ig-id}/messages` on `graph.facebook.com` ([docs](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api/))

## Better Auth (production admin)

When `BETTER_AUTH_ENABLED=true`:

- Auth routes mount at `/api/auth/*` on the API host (`BETTER_AUTH_URL` must match)
- Admin platform routes accept a valid Better Auth session cookie **or** `ADMIN_API_KEY`
- Bootstrap the first admin: `POST /api/v1/admin/bootstrap` with `ADMIN_API_KEY` (one-time, creates user from `ADMIN_BOOTSTRAP_EMAIL`)

Web admin can sign in via Better Auth client endpoints; the existing “save admin API key in browser” path remains for break-glass access.