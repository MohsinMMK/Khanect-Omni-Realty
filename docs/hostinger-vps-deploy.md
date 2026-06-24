# Hostinger VPS deploy (8 GB optimized)

Slim Docker Compose production stack for Khanect Omni Realty on a Hostinger KVM VPS. Targets **~3–4 GB RAM** used with headroom for spikes.

Official Hostinger Docker VPS guide: [How to use the Docker VPS template](https://www.hostinger.com/support/8306612-how-to-use-the-docker-vps-template-at-hostinger/).

## Embedding model (read first)

The database stores vectors in dimension-specific columns (`embedding` 1024, `embedding_768`, `embedding_384`). Search uses the column matching your configured dimension.

| Mode | Model | Dim | RAM on VPS | When to use |
|------|-------|-----|------------|-------------|
| **OpenAI (default)** | `text-embedding-3-small` | 1024 | **0** (API call) | **Recommended** — matches platform RAG target, no embedder container |
| Local BGE base | `BAAI/bge-base-en-v1.5` | 768 | ~0.5–1.5 GB | No OpenAI spend; add `rag-embedder` service |
| Local BGE small | `BAAI/bge-small-en-v1.5` | 384 | ~0.3–0.8 GB | Lowest local RAM; lower retrieval quality |
| Local BGE-M3 | `BAAI/bge-m3` | 1024 | ~2–4 GB | Not recommended on 8 GB with postgres + api + worker |

`docker-compose.yml` (`--profile production`) defaults to **OpenAI @ 1024**. Set `OPENAI_API_KEY` in `.env.production`. The admin UI (**AI → Embedding**) documents all modes and probes connectivity.

## Services in production compose

| Service | Included | Notes |
|---------|----------|-------|
| `postgres` (pgvector) | Yes | 1.5 GB memory limit |
| `redis` | Yes | Queue only; no persistence |
| `migrate` | Yes | One-off before api/worker |
| `api` | Yes | 512 MB limit |
| `worker` | Yes | 512 MB limit |
| `web` (nginx) | Yes | Public `:80`, proxies `/api/` |
| `rag-embedder` | No | Use OpenAI embeddings |
| `agno-agent` | No | API uses `LLM_API_KEY` directly |
| `clamav` | No | Add later if upload scanning required |

## Phase 1 — VPS prep

1. **Docker on VPS** — either:
   - Switch OS to Hostinger **Docker template** (pre-installed `docker-ce` + Compose), or
   - Install manually on Ubuntu 24.04: [Docker Engine on Ubuntu](https://docs.docker.com/engine/install/ubuntu/).
2. **Firewall** — allow 22, 80, 443 only.
3. **Clone repo:**
   ```bash
   git clone https://github.com/MohsinMMK/Khanect-Omni-Realty.git
   cd Khanect-Omni-Realty
   git checkout codex/production-website-chatbot-platform
   ```

## Phase 2 — Configure environment

```bash
cp env.production.example .env.production
nano .env.production   # domain, secrets, OPENAI_API_KEY, LLM_API_KEY
```

Required for production:

- `APP_BASE_URL`, `API_BASE_URL`, `BETTER_AUTH_URL`, `CORS_ORIGINS` — your public `https://` domain
- `BETTER_AUTH_SECRET`, `ENCRYPTION_KEY`, `ADMIN_API_KEY` — each ≥ 32 characters
- `POSTGRES_PASSWORD` — strong password
- `OPENAI_API_KEY` — embeddings (when `EMBEDDING_PROVIDER=openai`)
- `LLM_API_KEY` — chat answers

## Phase 3 — Deploy

From repo root on the VPS:

```bash
./scripts/deploy-vps.sh
```

Or manually:

```bash
docker compose --env-file .env.production --profile production up -d --build
```

## Phase 4 — Verify

```bash
curl -i http://localhost/
curl -i http://localhost/api/v1/health
curl -i http://localhost/api/v1/health/ready
docker compose --env-file .env.production --profile production ps
```

Admin (break-glass): pass `x-khanect-admin-api-key: <ADMIN_API_KEY>` or sign in via Better Auth.

Embedding probe: `GET /api/v1/admin/ai/embedding` (authenticated).

## Phase 5 — Domain and TLS

1. DNS **A record** → VPS IP (e.g. `194.164.149.3`).
2. Update `.env.production` URLs to `https://yourdomain.com`.
3. TLS options:
   - **Caddy** or **Traefik** reverse proxy in front of `web` (terminate HTTPS, proxy to `:80`), or
   - Host **nginx + certbot** on the VPS host (not in compose).
4. Redeploy after URL changes: `./scripts/deploy-vps.sh`

## Phase 6 — App bootstrap

1. Migrations run automatically via `migrate` service on each deploy.
2. Bootstrap admin: `POST /api/v1/admin/bootstrap` with `ADMIN_API_KEY` (one-time).
3. Per-project AI keys: admin UI → **Projects → ⋮ → AI keys** (optional overrides).
4. Publish test content → confirm worker indexes (`runtimeStatus: ready`).
5. Smoke widget: `POST /api/v1/widget/{publicKey}/message`.

## Rollout order

Same as [production-deploy.md](./production-deploy.md#rollout-order): migrate → data stores → worker → api → AI config → content → widget → Meta webhooks.

## End-to-end automation (GitHub Actions)

Push to `codex/production-website-chatbot-platform` triggers:

1. **verify** — `pnpm test` + `pnpm check:compose` on GitHub
2. **deploy** — SSH to VPS → `git pull` → `./scripts/deploy-vps.sh`
3. **health** — optional external `curl` to `DEPLOY_HEALTH_URL`

Workflow: `.github/workflows/deploy-production.yml`

### One-time bootstrap (VPS)

```bash
ssh root@YOUR_VPS_IP
git clone git@github.com:MohsinMMK/Khanect-Omni-Realty.git /opt/khanect-omni-realty
cd /opt/khanect-omni-realty
git checkout codex/production-website-chatbot-platform
./scripts/vps-bootstrap.sh
```

Bootstrap creates a **read-only GitHub deploy key** on the VPS and clones the repo. Add the printed public key under **GitHub → repo → Settings → Deploy keys**.

Generate a **separate key pair** for GitHub Actions → VPS SSH:

```bash
ssh-keygen -t ed25519 -f github_actions_vps -N ""
# Public key  → VPS authorized_keys (bootstrap script or manually)
# Private key → GitHub secret VPS_SSH_KEY
```

### GitHub secrets (repo → Settings → Secrets → Actions)

| Secret | Example |
|--------|---------|
| `VPS_HOST` | `194.164.149.3` |
| `VPS_USER` | `root` |
| `VPS_SSH_KEY` | contents of `github_actions_vps` private key |
| `VPS_DEPLOY_PATH` | `/opt/khanect-omni-realty` |
| `DEPLOY_HEALTH_URL` | `https://yourdomain.com/api/v1/health/ready` (optional) |

Optional: create a **`production` environment** in GitHub with required reviewers before deploy runs.

### Day-to-day flow

```text
local changes → git commit → git push → GitHub Actions → VPS docker rebuild → live
```

`.env.production` stays **only on the VPS** — never committed. Code updates are automatic; secret changes are manual on the server.

Manual redeploy: **Actions → Deploy production → Run workflow**.

## Updates (manual fallback)

```bash
git pull
./scripts/deploy-vps.sh
```

## Local proof before VPS

```bash
docker compose --profile local-prod up -d --build
```

Local-prod includes embedder/agno/clamav for full-stack smoke; production compose is the slim VPS profile.