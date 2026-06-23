# Plan 013: Better Auth production admin

## Status: DONE

Production admin authentication via Better Auth sessions with `ADMIN_API_KEY` break-glass fallback.

## Delivered

- `BETTER_AUTH_ENABLED`, `ADMIN_BOOTSTRAP_EMAIL` config
- Drizzle auth schema (`user`, `session`, `account`, `verification`) + migration `0005_better_auth.sql`
- `/api/auth/*` Fastify handler ([Better Auth Fastify](https://www.better-auth.com/docs/integrations/fastify))
- Shared `resolveAdminAuth` (session OR API key OR dev stub)
- `POST /api/v1/admin/bootstrap` (one-time, API key only)
- `docs/production-deploy.md` rollout notes

## Official refs

- [Better Auth Fastify](https://www.better-auth.com/docs/integrations/fastify)
- [Drizzle adapter](https://www.better-auth.com/docs/adapters/drizzle)
- [Database schema](https://www.better-auth.com/docs/concepts/database)