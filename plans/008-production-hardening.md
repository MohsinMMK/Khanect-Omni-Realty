# Plan 008: Production hardening

## Status: DONE

- `GET /api/v1/health/ready` — postgres, redis, optional embedder probes
- Worker health HTTP server on `WORKER_HEALTH_PORT` (default `3001`)
- Graceful shutdown timeout via `SHUTDOWN_TIMEOUT_MS`
- Docker Compose healthchecks + `depends_on: condition: service_healthy`
- `docs/production-deploy.md`