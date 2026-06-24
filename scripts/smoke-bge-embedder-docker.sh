#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_root"

export RAG_EMBEDDER_DOCKERFILE=apps/rag-embedder/Dockerfile.bge-m3
export EMBEDDER_MODE=bge-m3
export EMBEDDING_MODEL=BAAI/bge-m3
export RAG_EMBEDDER_TAG=bge-m3

echo "building bge-m3 rag-embedder image..."
docker compose --profile dev build dev-rag-embedder

echo "starting dev-rag-embedder (bge-m3)..."
docker compose --profile dev up -d dev-rag-embedder

deadline=$((SECONDS + 300))
until [ "$SECONDS" -ge "$deadline" ]; do
  if curl -sf http://localhost:8080/health | grep -q '"mode":"bge-m3"'; then
    break
  fi
  sleep 5
done

if ! curl -sf http://localhost:8080/health | grep -q '"mode":"bge-m3"'; then
  echo "dev-rag-embedder did not become healthy with bge-m3 within 300s" >&2
  docker compose --profile dev logs dev-rag-embedder >&2 || true
  exit 1
fi

EMBEDDER_URL=http://localhost:8080 node scripts/smoke-bge-embedder.mjs
echo "bge-m3 docker smoke ok"