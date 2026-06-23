# Plan 010: BGE-M3 smoke validation

## Status: DONE

- `scripts/smoke-bge-embedder.mjs` — validates `mode=bge-m3` and 1024-dim vectors
- `scripts/smoke-bge-embedder-docker.sh` — build bge profile, wait for health, run smoke
- `pnpm smoke:bge-embedder` and `pnpm smoke:bge-embedder:docker` root scripts