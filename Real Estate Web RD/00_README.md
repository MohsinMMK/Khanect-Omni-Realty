# Real-Estate AI Web App Documentation Pack

Generated: 21 June 2026
Owner context: Khanect AI, India-first delivery, high-revenue real-estate businesses, single-VPS V1, omni-channel RAG chatbot, Twenty CRM only.

## Hard decisions carried into this pack

- V1 is a single-business deployment on a single VPS. Apps, databases, uploaded files, local backups, and operational services stay on the VPS.
- V1 has one custom product web app for public website, admin CMS, API, and chatbot testing/control UI. Production uses one custom app image: Fastify serves `/api/*` plus the built Vite assets; the worker uses the same image with a different command.
- Core product is an omni-channel RAG chatbot connected to website chat, WhatsApp Business Platform, and Instagram Messaging/DM through official APIs/webhooks and an internal EGI channel framework.
- Automated VPS provider snapshots are expected daily with 7-14 days retention.
- CRM is upstream self-hosted Twenty CRM only. Do not fork Twenty or merge Twenty source/UI into the custom app for V1. Twenty stores CRM records; the app stores website/CMS/bookings/omni-channel chat/RAG/lead scoring/upload/audit/sync data and connects to Twenty through API/outbox jobs.
- Email and calendar integrations use Google Workspace/Gmail OAuth only. No Microsoft 365, generic SMTP, or generic IMAP in V1.
- No Make/Zapier/n8n/Pinecone/Algolia/PostHog/Supabase/Firebase as required runtime services in V1.
- Social publishing and Instagram/WhatsApp messaging use direct official platform APIs where the business owns the accounts, IDs, webhooks, approvals, and policy responsibility.
- AI/RAG is designed local-first. External LLM APIs are not the default.
- Frontend is Vite + React for V1. Backend is Fastify on Node.js 24 LTS. In production Fastify serves the Vite build and `/api/*` from the same custom app container. Next.js App Router is not a V1 target unless this decision is explicitly reopened.
- Data access uses Drizzle ORM with `drizzle-orm/node-postgres`, `pg` pooling, reviewed `drizzle-kit generate` migrations, and raw SQL escape hatches for PostgreSQL-specific features.
- Maps use MapLibre GL JS with a configurable paid/self-hosted OSM-derived provider; public OSM tile servers/Nominatim are not production dependencies.
- Uploads stay local on the VPS in V1 and must pass Fastify multipart limits, magic-byte validation, ClamAV scanning, and Sharp optimization before publish.
- The Vite frontend never connects directly to Postgres, Redis, Twenty, Google, Meta, embedder, or LLM services; all privileged operations go through the Fastify API/worker boundary.

## Included documents

1. `01_PRD.md` - Product requirements document.
2. `02_TRD.md` - Technical requirements document and stack decisions.
3. `03_ARCHITECTURE_RD.md` - Architecture research/design document.
4. `04_AI_RAG_RD.md` - Omni-channel RAG/chatbot design, ingestion, grounding, lead scoring, evaluation, and guardrails.
5. `05_TWENTY_CRM_RD.md` - Twenty CRM integration/customization design.
6. `06_CMS_CONTENT_PIPELINE_RD.md` - CMS, staging, publishing, property content workflows.
7. `07_SCHEDULER_EMAIL_SOCIAL_RD.md` - Viewing scheduler, Google OAuth, Gmail, WhatsApp/Instagram messaging, and Instagram/Meta publishing.
8. `08_ANALYTICS_RD.md` - Analytics dashboard, event taxonomy, KPI model.
9. `09_DATA_MODEL_API_RD.md` - Core data model, API contract, ownership boundaries.
10. `10_DEVOPS_VPS_RUNBOOK.md` - Single-VPS deployment, backup, restore, operations.
11. `11_SECURITY_COMPLIANCE_RD.md` - Security, DPDP, RERA, privacy, audit, AI safety.
12. `12_QA_TESTING_UAT_RD.md` - Test plan, acceptance, performance, UAT.
13. `13_ROADMAP_BACKLOG.md` - MVP milestones, backlog, launch checklist.
14. `14_RISK_REGISTER.md` - Product, technical, compliance, and operational risks.
15. `15_SOURCE_RESEARCH_LOG.md` - Source list used for June 2026 stack/release decisions.
16. `16_CODEX_IMPLEMENTATION_PROMPT.md` - Agent handoff prompt for implementation.
17. `17_DECISIONS_LOCK.md` - Current locked technical decisions; wins over conflicting older notes.

## Technical artifacts

- `docker-compose.skeleton.yml` - V1 service blueprint.
- `env.example` - Environment variable skeleton.
- `schema.sql` - Initial relational/vector schema sketch.
- `api_contracts.openapi.yaml` - Public API contract sketch.

## Recommended reading order

Start with PRD, then `17_DECISIONS_LOCK.md`, then TRD, then Architecture RD, then Twenty CRM RD and AI/RAG RD. The remaining documents are implementation references.
