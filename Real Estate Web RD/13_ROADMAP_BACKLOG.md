# Roadmap, Backlog, and Launch Plan

## 1. MVP build phases

### Phase 0: Foundation

- Repo setup and monorepo package boundaries.
- Vite React frontend setup.
- Fastify app service setup for `/api/*` and production Vite static serving.
- Node/BullMQ worker setup using the same custom app image with a different command.
- Docker Compose skeleton.
- PostgreSQL/Redis setup.
- Better Auth baseline, roles, and tenant checks.
- Base design system.
- Audit log foundation.
- Drizzle + `pg` data layer and `drizzle-kit generate` migration workflow wired into API/worker packages.
- MapLibre/provider configuration placeholders.
- Upload pipeline skeleton with ClamAV health path and filesystem directories.
- UUID v7 ID utility and Vitest/Playwright baseline wired into packages that exist.

### Phase 1: CMS and public website

- Project/property schema.
- Admin CRUD.
- Draft/staged/published workflow.
- Public property pages.
- Secure media upload, scan, transform, and publish pipeline.
- SEO basics.
- RERA fields/warnings.

### Phase 2: Omni-channel RAG chatbot foundation

- Published content ingestion.
- BGE-M3 embeddings.
- pgvector search.
- Website chat UI and admin chat lab.
- EGI conversation pipeline for normalized channel events.
- Grounded answers.
- Lead capture.
- Lead scoring and human handoff queue.
- Bad answer feedback.
- RAG evaluation set.

### Phase 3: Twenty CRM integration

- Self-host Twenty.
- Custom fields/objects for lead score, source channel, handoff reason, and property interest.
- API key setup.
- Lead sync outbox.
- Opportunity/task/note creation.
- Handoff task creation.
- Retry dashboard.
- CRM deep links.

### Phase 4: Scheduler + Google/Gmail

- Booking rules.
- Availability and slot reservation.
- Booking lifecycle.
- Gmail send via OAuth.
- Google Calendar event sync.
- Admin retry/status.

### Phase 5: Analytics + channels + social publishing

- Event tracking.
- Rollup jobs.
- Owner/marketing/sales dashboards with channel, score, and handoff metrics.
- WhatsApp Business Platform adapter after official setup.
- Instagram Messaging/DM adapter after official setup.
- Social draft/approval.
- AI-assisted image edit/variant workflow.
- Instagram/Meta direct publishing adapter with platform permission/rate-limit checks.
- Publish log.

### Phase 6: Hardening and launch

- Security testing.
- Prompt injection testing.
- Backup/restore test.
- Performance tuning.
- UAT.
- Production deployment.
- Handover documentation.

## 2. MVP backlog epics

### Epic A: Identity and admin

- Login/logout through Better Auth + Fastify.
- Roles.
- User invitation.
- Tenant checks.
- Audit logs.
- Admin navigation.

### Epic B: Property CMS

- Projects.
- Listings.
- Media.
- FAQs.
- Locality guides.
- Versioning.
- Staging preview.

### Epic C: Public website

- Home.
- Property list.
- Property detail.
- Contact form.
- SEO metadata.
- Sitemap.

### Epic D: Omni-channel AI chatbot

- Website widget.
- Admin chat lab.
- RAG ingestion.
- Retrieval.
- Answer generation.
- EGI channel event pipeline.
- WhatsApp and Instagram adapters.
- Lead capture.
- Lead scoring.
- Human handoff.
- Admin review.

### Epic E: CRM

- Twenty setup.
- Data mapping.
- Sync jobs.
- Retry UI.
- Pipeline summary.

### Epic F: Scheduler

- Booking rules.
- Availability.
- Booking creation.
- Status changes.
- Google/Gmail sync.

### Epic G: Social publishing and AI media

- Draft generation.
- AI-assisted image editing/cropping/enhancement.
- Approval.
- Meta connection.
- Publish worker.
- Publish log.

### Epic H: Analytics

- Event capture.
- Channel attribution.
- Lead scoring metrics.
- Handoff metrics.
- Rollups.
- Dashboards.
- Exports.

### Epic I: DevOps/security

- Compose deployment for `app`, `worker`, Postgres, Redis, official Twenty services, backup, ClamAV, and optional AI services.
- Backups.
- Monitoring.
- Security headers.
- Rate limits.
- Restore runbook.

## 3. Launch checklist

Product:

- Property content complete.
- RERA fields reviewed.
- CTAs reviewed.
- Chatbot answer set approved.
- CRM pipeline configured.
- Scheduler slots configured.
- Email templates approved.

Technical:

- Domain/DNS live.
- HTTPS live.
- Docker services healthy.
- Backups tested.
- Logs/monitoring active.
- Error dashboard clean.
- Secrets rotated.

Business:

- Sales team trained.
- Admin trained.
- Owner dashboard reviewed.
- Privacy/terms published.
- Social publishing and WhatsApp/Instagram messaging permissions approved if used at launch.

## 4. Post-launch backlog

- WhatsApp and Instagram DM activation after official setup/approval if not enabled by launch.
- AI voice assistant after telephony/compliance review.
- Advanced property recommendation engine.
- Multi-business SaaS control plane.
- Offsite backup target.
- Separate GPU inference node.
- More social platforms.
- Advanced attribution.
- Mobile app/PWA enhancements.
- Broker/agent portal.
