#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_root"

compose_file="docker-compose.production.yml"
profile="production"
env_file=".env.production"

if [[ ! -f "$env_file" ]]; then
  echo "Missing $env_file — copy env.production.example and edit secrets:" >&2
  echo "  cp env.production.example .env.production" >&2
  exit 1
fi

echo "Building and starting production stack..."
docker compose -f "$compose_file" --env-file "$env_file" --profile "$profile" up -d --build

echo "Waiting for API readiness..."
ready=false
for _ in $(seq 1 40); do
  if docker compose -f "$compose_file" --env-file "$env_file" --profile "$profile" exec -T api \
    node -e "fetch('http://127.0.0.1:3000/api/v1/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" \
    >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 3
done

if [[ "$ready" != "true" ]]; then
  echo "API readiness check failed. Recent api logs:" >&2
  docker compose -f "$compose_file" --env-file "$env_file" --profile "$profile" logs --tail=80 api >&2 || true
  exit 1
fi

web_port="$(grep -E '^WEB_PORT=' "$env_file" 2>/dev/null | cut -d= -f2- || true)"
web_port="${web_port:-80}"

echo "Production deploy healthy."
echo "  Web:    http://localhost:${web_port}/"
echo "  Health: http://localhost:${web_port}/api/v1/health/ready"
docker compose -f "$compose_file" --env-file "$env_file" --profile "$profile" ps