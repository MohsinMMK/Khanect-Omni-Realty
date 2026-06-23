#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_root"

echo "building bge-m3 rag-embedder image..."
docker compose -f docker-compose.phase0.yml -f docker-compose.bge-m3.yml build rag-embedder

echo "starting rag-embedder (bge-m3 profile)..."
docker compose -f docker-compose.phase0.yml -f docker-compose.bge-m3.yml up -d rag-embedder

deadline=$((SECONDS + 300))
until [ "$SECONDS" -ge "$deadline" ]; do
  if curl -sf http://localhost:8080/health | grep -q '"mode":"bge-m3"'; then
    break
  fi
  sleep 5
done

if ! curl -sf http://localhost:8080/health | grep -q '"mode":"bge-m3"'; then
  echo "rag-embedder did not become healthy with bge-m3 within 300s" >&2
  docker compose -f docker-compose.phase0.yml -f docker-compose.bge-m3.yml logs rag-embedder >&2 || true
  exit 1
fi

EMBEDDER_URL=http://localhost:8080 node scripts/smoke-bge-embedder.mjs
echo "bge-m3 docker smoke ok"