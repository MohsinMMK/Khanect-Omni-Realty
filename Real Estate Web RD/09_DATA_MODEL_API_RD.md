# Data Model and API Research / Design

## 1. Core database model

The app database must support CMS, RAG, omni-channel conversations, lead scoring, scheduler, analytics, integration sync, and audit without becoming a second CRM. Twenty stores CRM records; the app stores local lead capture, channel conversation state, outbox state, Twenty record IDs, sync summaries, and deep-link metadata needed for seamless UX and reliability.

Core tables:

- `tenant`
- `app_user`
- `role`
- `user_role`
- `project`
- `property_listing`
- `media_asset`
- `content_version`
- `faq`
- `channel_conversation`
- `channel_message`
- `lead_capture`
- `lead_score_event`
- `human_handoff`
- `booking`
- `booking_rule`
- `rag_document`
- `rag_chunk`
- `integration_connection`
- `integration_outbox`
- `analytics_event`
- `audit_log`

## 2. Tenant strategy

V1 is single-tenant per VPS, but every table should include `tenant_id` where business data exists. This future-proofs the codebase for multi-tenant SaaS without forcing shared deployment now.

## 3. Media and location data decisions

Media records must include upload status, scan status, original private path, optimized public paths, size, detected MIME, sha256 hash, alt text, and owning entity. Only clean scanned files can become public.

Location records should store coordinates and provider metadata. Map tiles/geocoding provider is configurable; public OSM tile servers and public Nominatim must not be required for production.

## 4. API implementation decision

V1 API is implemented as Fastify 5 on Node.js 24 LTS inside the production `app` container. Fastify serves `/api/v1/*`, Meta/WhatsApp/Instagram webhooks, and the built Vite frontend assets. Vite routes call the API through `/api/v1/*` only. The API owns auth enforcement, tenant checks, webhook verification, validation, rate limits, audit logs, and background job enqueueing. Workers use the same app image with a different command and process jobs asynchronously; public requests must not synchronously depend on Twenty, Google, Meta, embedder, or LLM availability.

Data access is locked to Drizzle ORM with `drizzle-orm/node-postgres` and `pg` pooling. Use `drizzle-kit generate` for SQL migrations, commit generated migrations, and review them before applying. Raw SQL is allowed for pgvector, UUID v7 defaults, HNSW indexes, advisory locks, complex booking transactions, analytics rollups, and advanced RAG retrieval queries. ID format is locked to UUID v7 in `17_DECISIONS_LOCK.md`.

## 5. Public API endpoints

### Properties

- `GET /api/v1/properties`
- `GET /api/v1/properties/{slug}`
- `GET /api/v1/projects/{slug}`

### Leads

- `POST /api/v1/leads`

### Chat and channels

Website chat sessions map to `channel_conversation` records with `channel = website`; WhatsApp and Instagram inbound messages create/update the same conversation model through webhooks.

- `POST /api/v1/chat/sessions`
- `POST /api/v1/chat/sessions/{id}/messages`
- `POST /api/v1/chat/sessions/{id}/lead`
- `POST /api/v1/webhooks/meta/whatsapp`
- `GET /api/v1/webhooks/meta/whatsapp`
- `POST /api/v1/webhooks/meta/instagram`
- `GET /api/v1/webhooks/meta/instagram`

### Scheduler

- `GET /api/v1/bookings/availability`
- `POST /api/v1/bookings`
- `POST /api/v1/bookings/{id}/cancel`
- `POST /api/v1/bookings/{id}/reschedule`

## 6. Admin API endpoints

- `POST /api/v1/admin/projects`
- `PATCH /api/v1/admin/projects/{id}`
- `POST /api/v1/admin/projects/{id}/submit-review`
- `POST /api/v1/admin/projects/{id}/publish`
- `POST /api/v1/admin/properties/{id}/publish`
- `GET /api/v1/admin/chat-lab/sessions`
- `POST /api/v1/admin/chat-lab/test-message`
- `GET /api/v1/admin/handoffs`
- `POST /api/v1/admin/handoffs/{id}/assign`
- `POST /api/v1/admin/handoffs/{id}/resolve`
- `GET /api/v1/admin/crm/leads/recent`
- `GET /api/v1/admin/crm/leads/{leadId}`
- `GET /api/v1/admin/crm-sync/errors`
- `POST /api/v1/admin/crm-sync/{jobId}/retry`
- `GET /api/v1/admin/analytics/overview`
- `GET /api/v1/admin/rag/fallbacks`
- `POST /api/v1/admin/rag/reindex`
- `POST /api/v1/admin/social-posts/{id}/approve`
- `POST /api/v1/admin/social-posts/{id}/publish`

## 7. API standards

- All input validated with shared TypeScript schemas and Fastify-compatible route schemas.
- OpenAPI 3.1 contract in `api_contracts.openapi.yaml` must match implemented Fastify routes.
- All public mutations are rate-limited and bot-checked where applicable.
- All admin APIs require auth, role, and tenant checks.
- All mutating admin APIs write audit logs.
- All integration calls use outbox jobs.
- Channel webhooks must verify platform challenge/signature, deduplicate external event/message IDs, and enqueue processing rather than doing heavy AI work inline.
- CRM-lite admin endpoints read app-side sync summaries and can fetch Twenty details server-side through the Twenty adapter when authorized; the browser never receives Twenty API secrets.
- All IDs use UUID v7 stored in PostgreSQL `uuid` columns.
- Drizzle schema is the default source for application table definitions; generated SQL migrations are the deployable artifact.
- Raw SQL migrations/queries are allowed when PostgreSQL features are clearer or unsupported by Drizzle abstractions.
- Slugs are unique per tenant and content type.

## 8. Example lead payload

```json
{
  "name": "Aisha Khan",
  "phone": "+919999999999",
  "email": "aisha@example.com",
  "propertyId": "prop_123",
  "message": "Interested in 3BHK and site visit this weekend",
  "budgetRange": "1.5Cr-2Cr",
  "source": "website_chatbot",
  "consent": {
    "accepted": true,
    "textVersion": "lead-consent-v1",
    "purpose": "sales_follow_up"
  },
  "utm": {
    "source": "instagram",
    "medium": "social",
    "campaign": "launch_june"
  }
}
```

## 9. Data retention

Suggested defaults:

- Analytics raw events: 13 months.
- Chat raw messages: 90-180 days unless converted to lead and policy requires retention.
- Chat summary in CRM: retained per CRM policy.
- Failed integration logs: 90 days after resolution.
- Audit logs: 3-7 years depending business/legal policy.
- Backups: local retention plus VPS snapshot retention per agreed operations plan.

## 10. Data export/delete

Admin privacy tools:

- Search person by phone/email.
- Export lead data.
- Delete/anonymize app-side lead/chat analytics where legally permitted.
- Mark CRM follow-up needed for Twenty-side deletion/export.

## 11. Acceptance criteria

- Schema supports V1 workflows without direct Twenty DB writes.
- API contracts are documented before implementation.
- Fastify route schemas, shared validation schemas, and OpenAPI contracts stay aligned.
- Public APIs validate and rate-limit requests.
- Admin APIs audit every mutation.
- Tenant ID exists in business tables from day one.
