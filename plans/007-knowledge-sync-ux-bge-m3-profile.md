# Plan 007: Knowledge sync UX + BGE-M3 compose profile

> **Executor instructions**: Follow this plan step by step. Web-search official docs per segment (see `AGENTS.md`). Update `plans/README.md` when done.

## Status

- **Execution status**: DONE
- **Priority**: P1
- **Effort**: M
- **Depends on**: 006
- **Planned at**: 2026-06-23

## Scope

- `packages/db` — `listKnowledge` returns syncing/pending/failed sources, not only `indexed`
- OpenAPI — `GET /admin/chatbots/{chatbotId}/knowledge`, `PlatformKnowledgeListResponse`
- `apps/web` — publish polling + indexing status badges in content desk
- `apps/rag-embedder/Dockerfile.bge-m3` + `docker-compose.bge-m3.yml` — optional real BGE-M3 CPU profile
- `scripts/check-compose.sh` — validates smoke + bge-m3 merge configs

## Done criteria

- [x] Drizzle `listKnowledge` includes in-flight sources with real `status`
- [x] Admin content desk polls until indexed when `indexing: true`
- [x] OpenAPI + `pnpm check:openapi` updated
- [x] BGE-M3 compose override documented and config-validated
- [x] Package tests + rag-embedder pytest pass
- [x] `plans/README.md` row 007 DONE

## References

- [BullMQ job IDs](https://docs.bullmq.io/guide/jobs/job-ids.md) — colon restriction (fixed in 006)
- [Hugging Face BAAI/bge-m3](https://huggingface.co/BAAI/bge-m3)
- [FlagEmbedding BGE_M3](https://github.com/FlagOpen/FlagEmbedding/tree/master/FlagEmbedding/BGE_M3)