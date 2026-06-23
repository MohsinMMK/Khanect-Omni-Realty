# Plan 006: RAG embedder service + Docker E2E pipeline

> **Executor instructions**: Follow this plan step by step. Web-search official docs per segment (see `AGENTS.md`). Update `plans/README.md` when done.

## Status

- **Execution status**: DONE
- **Priority**: P1
- **Effort**: M
- **Depends on**: 005
- **Planned at**: 2026-06-23

## Scope

- `apps/rag-embedder/` — FastAPI OpenAI-compatible `/v1/embeddings`
- `docker-compose.phase0.yml` — `rag-embedder` service + `EMBEDDER_URL`
- `packages/config` — `RAG_INDEX_SYNC` (sync index in dev/test, async in compose prod)
- `scripts/smoke-rag-pipeline.mjs` — polls until worker indexes
- OpenAPI `embeddingModel` enum includes `BAAI/bge-m3`

## Done criteria

- [x] `uv run pytest` in `apps/rag-embedder` passes
- [x] `pnpm check:compose` passes
- [x] `pnpm smoke:rag-pipeline` passes against compose stack (postgres, redis, rag-embedder, worker, app)
- [x] `plans/README.md` row 006 DONE

## Fix notes (2026-06-23)

- BullMQ rejects custom `jobId` values containing `:` ([job IDs guide](https://docs.bullmq.io/guide/jobs/job-ids.md)). Platform dedupe key is now `buildPlatformRagIndexJobId` (`chatbotId__contentVersionId`).
- Worker Redis connection sets `maxRetriesPerRequest: null` per [BullMQ connections](https://docs.bullmq.io/guide/connections.md).