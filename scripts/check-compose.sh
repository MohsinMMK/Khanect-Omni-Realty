#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"

cd "$repo_root/Real Estate Web RD"
sed \
  -e 's/env_file: \.env$/env_file: env.example/' \
  -e 's/env_file: \.env.twenty$/env_file: env.example/' \
  docker-compose.skeleton.yml |
  docker compose --env-file env.example -f - config >/tmp/khanect-compose-skeleton-config.out

docker compose -f "$repo_root/docker-compose.phase0.yml" config >/tmp/khanect-compose-phase0-config.out
docker compose -f "$repo_root/docker-compose.phase0.yml" -f "$repo_root/docker-compose.smoke.yml" config >/tmp/khanect-compose-smoke-config.out
docker compose -f "$repo_root/docker-compose.phase0.yml" -f "$repo_root/docker-compose.bge-m3.yml" config >/tmp/khanect-compose-bge-m3-config.out
docker compose -f "$repo_root/docker-compose.local-prod.yml" --profile local-prod config >/tmp/khanect-compose-local-prod-config.out

echo "compose config ok"
