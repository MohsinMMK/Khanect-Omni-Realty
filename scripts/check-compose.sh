#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"

cd "$repo_root/Real Estate Web RD"
sed \
  -e 's/env_file: \.env$/env_file: env.example/' \
  -e 's/env_file: \.env.twenty$/env_file: env.example/' \
  docker-compose.skeleton.yml |
  docker compose --env-file env.example -f - config >/tmp/khanect-compose-skeleton-config.out

docker compose -f "$repo_root/docker-compose.yml" --profile dev config >/tmp/khanect-compose-dev-config.out
API_HOST_PORT=3002 REDIS_URL=redis://host.docker.internal:6379 docker compose -f "$repo_root/docker-compose.yml" --profile dev config >/tmp/khanect-compose-dev-smoke-config.out
RAG_EMBEDDER_DOCKERFILE=apps/rag-embedder/Dockerfile.bge-m3 EMBEDDER_MODE=bge-m3 EMBEDDING_MODEL=BAAI/bge-m3 RAG_EMBEDDER_TAG=bge-m3 \
  docker compose -f "$repo_root/docker-compose.yml" --profile dev config >/tmp/khanect-compose-dev-bge-m3-config.out
docker compose -f "$repo_root/docker-compose.yml" --profile local-prod config >/tmp/khanect-compose-local-prod-config.out
docker compose -f "$repo_root/docker-compose.yml" --env-file "$repo_root/env.production.example" --profile production config >/tmp/khanect-compose-production-config.out

grep -q "rag-embedder:" /tmp/khanect-compose-production-config.out
grep -q "EMBEDDING_PROVIDER: local" /tmp/khanect-compose-production-config.out
grep -q "EMBEDDER_URL: http://rag-embedder:8080" /tmp/khanect-compose-production-config.out
grep -q "rag-embedder:" /tmp/khanect-compose-dev-config.out

echo "compose config ok"
