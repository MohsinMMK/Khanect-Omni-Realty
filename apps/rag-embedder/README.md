# RAG Embedder

Internal OpenAI-compatible embedding service for the platform RAG pipeline.

## Endpoints

- `GET /health`
- `POST /v1/embeddings` with `{ "model": "BAAI/bge-m3", "input": ["text"] }`

## Modes

| `EMBEDDER_MODE` | Behavior |
|---|---|
| `stub` (default) | Deterministic `stub/hash-v1` 1024-dim vectors for local/CI smoke |
| `bge-m3` | Loads `FlagEmbedding` BGE-M3 dense vectors (requires `[bge]` extra + model download) |

## Local dev

```bash
cd apps/rag-embedder
uv venv && uv pip install -e ".[dev]"
uv run pytest
uv run uvicorn rag_embedder_service.main:app --app-dir src --port 8080
```

Set `EMBEDDER_URL=http://localhost:8080` in the API/worker environment when running against this service.

## Docker (BGE-M3 profile)

Phase0 compose uses the stub image by default. For real BGE-M3 vectors:

```bash
docker compose -f docker-compose.phase0.yml -f docker-compose.bge-m3.yml build rag-embedder
docker compose -f docker-compose.phase0.yml -f docker-compose.bge-m3.yml up -d rag-embedder
curl http://localhost:8080/health   # mode: bge-m3
```

Model weights cache in the `huggingface-cache` volume (`HF_HOME=/cache/huggingface`). See [Hugging Face — BAAI/bge-m3](https://huggingface.co/BAAI/bge-m3) and [FlagEmbedding BGE_M3](https://github.com/FlagOpen/FlagEmbedding/tree/master/FlagEmbedding/BGE_M3).