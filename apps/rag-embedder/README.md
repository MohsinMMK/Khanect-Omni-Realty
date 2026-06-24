# RAG Embedder

Internal OpenAI-compatible embedding service for the platform RAG pipeline.

## Endpoints

- `GET /health`
- `POST /v1/embeddings` with `{ "model": "BAAI/bge-base-en-v1.5", "input": ["text"] }`

## Modes

| `EMBEDDER_MODE` | Behavior |
|---|---|
| `stub` (default) | Deterministic vectors for local/CI smoke. When a BGE model is requested, it returns that model's expected dimension. |
| `local` | Loads FastEmbed BGE vectors for `BAAI/bge-small-en-v1.5` (384-dim) or `BAAI/bge-base-en-v1.5` (768-dim). |

## Local dev

```bash
cd apps/rag-embedder
uv venv && uv pip install -e ".[dev]"
uv run pytest
uv run uvicorn rag_embedder_service.main:app --app-dir src --port 8080
```

Set `EMBEDDER_URL=http://localhost:8080` in the API/worker environment when running against this service.

## Docker

Phase0 compose runs the local BGE base preset by default:

```bash
docker compose -f docker-compose.phase0.yml build rag-embedder
docker compose -f docker-compose.phase0.yml up -d rag-embedder
curl http://localhost:8080/health   # mode: local, dimension: 768
```

Model weights cache in the `huggingface-cache` volume (`HF_HOME=/cache/huggingface`). See [Hugging Face — BAAI/bge-base-en-v1.5](https://huggingface.co/BAAI/bge-base-en-v1.5) and [FastEmbed supported models](https://qdrant.github.io/fastembed/examples/Supported_Models/).
