# DevOps and Single-VPS Runbook

## 1. Deployment rule

V1 runs on a single VPS. Apps, databases, files, Twenty CRM, and local backups stay on that VPS. Daily VPS provider snapshots with 7-14 days retention are expected. Production uses one custom app image: `app` serves Fastify API plus built Vite assets, and `worker` uses the same image with a different command.

## 2. VPS baseline

Minimum serious V1:

- Ubuntu 24.04 LTS.
- 8 vCPU.
- 32 GB RAM.
- 300 GB NVMe.
- Docker Engine.
- Docker Compose plugin.
- UFW firewall.
- SSH key login only.
- Automated security updates.

Recommended if local LLM is used for production:

- 12-16 vCPU.
- 64-128 GB RAM.
- 500 GB-1 TB NVMe.
- GPU with at least 24 GB VRAM.

## 3. Directory layout

```text
/opt/realestate-app/
  docker-compose.yml
  .env
  compose.override.yml
  scripts/
  backups/
/data/
  postgres/
  redis/
  twenty/
  uploads/
    tmp/
    originals/
    optimized/
    private/
    quarantine/
  app-assets/
  rag-models/
  llm-models/
  backups/
/var/log/realestate-app/
```

## 4. Deployment steps

1. Provision VPS.
2. Configure SSH, firewall, timezone, swap if needed.
3. Install Docker and Compose.
4. Create deployment user and directories.
5. Place `.env` securely.
6. Start Postgres and Redis.
7. Start Twenty CRM.
8. Run app database migrations.
9. Start ClamAV scan service if uploads are enabled.
10. Start `app` container and `worker` container from the same custom image.
11. Start embedder/LLM service if enabled.
12. Configure reverse proxy and TLS.
13. Run smoke tests.
14. Enable backup cron.
15. Trigger first manual backup.
16. Restore test on staging path or temporary database.

## 5. Backup policy

Local backups:

- Daily `pg_dump` for app and Twenty databases.
- Daily upload/media archive.
- Daily configuration backup excluding secrets or with secrets encrypted.
- Keep local daily backups for 7-14 days depending disk space.

VPS snapshots:

- Daily snapshot.
- 7-14 days retention.
- Verify snapshot exists from provider panel/API.

Restore test:

- At least monthly.
- Also before major upgrade.
- Restore app database, Twenty database, and sample uploads.
- Confirm login, website page, CRM sync, and chatbot source retrieval.

## 6. Monitoring checklist

Monitor:

- HTTPS uptime.
- Disk usage.
- Postgres availability.
- Redis availability.
- Queue depth.
- Worker failures.
- Twenty health.
- WhatsApp/Instagram webhook delivery errors if channels are enabled.
- Backup success.
- SSL expiry.
- CPU/RAM.
- LLM service health if enabled.
- ClamAV service health and virus database freshness if uploads are enabled.

V1 can expose monitoring in admin dashboard and through simple local alerts. Avoid third-party monitoring in default V1.

## 7. Release process

Before release:

- Pull/build image.
- Run migrations on staging or pre-prod database copy.
- Run tests.
- Backup production.
- Deploy new image.
- Run smoke tests.
- Watch logs.

Rollback:

- Stop new image.
- Start previous image.
- Restore DB only if migration is destructive and rollback requires it.
- Document incident.

## 8. Security hardening

- Disable password SSH.
- Use UFW allow only 22, 80, 443.
- Bind Postgres/Redis to Docker network only.
- Use non-root containers where possible.
- Limit Docker socket access.
- Rotate secrets after developer handover.
- Keep OS and containers patched.
- Enforce admin 2FA if available.
- Rate-limit public APIs.
- Configure secure headers.

## 9. Upgrade runbook

### Vite/Fastify app upgrade

- Upgrade frontend/API/worker dependencies in branch.
- Run typecheck, lint, unit/API tests, and frontend build.
- Build one versioned custom app Docker image containing Fastify server, worker entrypoint, and built Vite assets.
- Run migrations on staging or copied database.
- Run smoke tests.
- Deploy new image as `app` and `worker`. If issue appears, roll both roles back to previous image unless change is known worker-only.

### Twenty upgrade

- Read Twenty release notes.
- Backup Twenty database.
- Test upgrade on copied data.
- Verify custom fields, API keys, workflow, and sync jobs.
- Deploy production.

### PostgreSQL/pgvector upgrade

- Stay on current minor release for Postgres 18.
- Upgrade pgvector only after backup and extension smoke test.
- Reindex vector indexes if required by release notes.

## 10. Disaster recovery

Failure scenarios:

- App container failure: restart `app` service.
- Worker stuck: restart `worker`, inspect queue.
- Channel webhook failure: verify reverse proxy route, platform verify token/signature settings, event deduplication, and worker queue health.
- Postgres corruption: restore latest verified dump/snapshot.
- VPS outage: restore provider snapshot to new VPS if provider supports it.
- Domain/TLS issue: verify DNS and reverse proxy logs.
- LLM service down: disable chatbot generation or use fallback capture mode.

## 11. Acceptance criteria

- A new VPS can be configured from this runbook.
- Full stack restarts after reboot.
- Backup and restore tested before launch.
- Public services are only exposed through reverse proxy.
- Admin can see backup and integration health.
- Upload health check confirms ClamAV scan path and filesystem permissions.
- Reverse proxy routes `clientdomain.com` traffic to the `app` container; Fastify handles `/api/*`, static Vite assets, and SPA fallback.
- Reverse proxy routes `crm.clientdomain.com` traffic to official Twenty service.
- App admin shows CRM sync status/deep links without exposing Twenty API secrets to the browser.
- Enabled WhatsApp/Instagram webhook endpoints verify successfully and enqueue events without exposing platform tokens to the browser.
