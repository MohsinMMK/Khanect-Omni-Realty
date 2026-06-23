# Plan 012: Per-project AI keys

## Status: DONE

Isolated LLM and embedding credentials per business project, with admin UI and runtime resolution.

## Delivered

- `project_ai_config` table + migration `0004_project_ai_config.sql`
- `@workspace/core` encrypt/mask helpers and per-project provider resolution
- `GET/PATCH /api/v1/admin/projects/:projectId/ai-config`
- `POST .../ai-config/llm/test` and `POST .../ai-config/embedding/test`
- Admin UI: **Projects → ⋮ → AI keys** (LLM | Embeddings tabs)
- Project card badges for own LLM / embedding keys
- Worker + `rag-index-enqueuer` resolve embedding per `chatbot.projectId`
- OpenAPI schemas: `ProjectAiConfig`, `ProjectAiKeySummary`, smoke-test responses

## Official refs

- [OpenAI embeddings](https://platform.openai.com/docs/guides/embeddings)
- [BGE-M3](https://huggingface.co/BAAI/bge-m3)