# QA, Testing, and UAT Plan

## 1. Test strategy

The app touches content, CRM, omni-channel AI, channel webhooks, scheduling, OAuth, social APIs, analytics, lead scoring, and compliance. Testing must cover business flows end-to-end, not only unit tests.

## 2. Test layers

- Vitest unit tests for validators, schemas, adapters, utility functions.
- Vitest integration tests for database, queue, Twenty API wrapper, channel adapters, lead scoring, and RAG pipeline.
- Vitest + Fastify injection tests for public/admin API endpoints.
- Playwright E2E tests for website, CMS, chatbot lab, booking, lead scoring, handoff queue, and lead sync.
- Security tests for auth, roles, rate limits, file uploads, prompt injection.
- UAT with business users.

## 3. Critical test cases

### CMS

- Editor creates draft property.
- Draft not visible publicly.
- Approver publishes property.
- Published property appears on site.
- RAG index updates after publish.
- Rollback restores previous content.
- Missing RERA field warning appears.

### Lead capture

- Public form creates lead.
- Chatbot creates lead.
- Booking creates lead.
- Duplicate phone/email does not duplicate active CRM opportunity.
- Twenty unavailable -> outbox retry.
- Invalid phone/email rejected.

### Omni-channel chatbot

- Answers property facts correctly.
- Website chatbot, WhatsApp, and Instagram-style events enter the same EGI pipeline.
- Falls back on missing price.
- Falls back on missing RERA/legal claim.
- Captures lead after consent.
- Calculates explainable lead score.
- Creates human handoff for high-intent/sensitive/low-confidence conversations.
- Does not reveal prompt/secrets.
- Ignores prompt injection.
- Handles Hinglish/multilingual questions.

### Scheduler

- Slot availability shows correctly.
- Booking confirmed.
- Double booking prevented.
- Cancellation works.
- Reschedule works.
- Google Calendar sync failure retries.
- Gmail confirmation failure retries.

### Twenty CRM

- Person created.
- Opportunity created.
- Task created for booking or human handoff.
- Note attached with chatbot summary, lead score, source channel, and handoff reason.
- CRM deep link works.
- Sync error is visible.

### Social publishing and AI media

- Draft created.
- AI-assisted image edit requires approval before publish.
- Approval required.
- Missing RERA warning appears.
- Publish success logs post ID.
- Publish failure preserves draft.

### Channel webhooks

- WhatsApp webhook verification succeeds.
- Instagram webhook verification succeeds.
- Duplicate external event/message IDs are ignored.
- Invalid webhook signature/token is rejected.
- Channel outage does not lose queued messages or leads.

### Analytics

- Page view tracked.
- Lead source attributed.
- Chat conversion counted by channel.
- Lead score and handoff metrics counted.
- Booking counted.
- CRM stage imported/summarized.

## 4. Performance test targets

Public site:

- Home/property pages should remain responsive under expected campaign traffic.
- API lead submission should complete quickly even if CRM sync is queued.
- Chatbot response time depends on local model; set expectation based on final VPS hardware.

Database:

- Property listing queries indexed.
- Vector retrieval tested with expected content size.
- Analytics rollups do not lock high-traffic tables.

## 5. Security test cases

- Unauthorized admin route access denied.
- Editor cannot publish.
- Sales executive cannot access integration secrets.
- CSRF token required for admin mutations.
- Rate limits trigger on public form abuse.
- Uploaded executable disguised as image rejected.
- Prompt injection test set passes.
- OAuth/channel tokens not visible in logs or admin page.

## 6. UAT plan

Business users:

- Owner/director.
- Marketing admin.
- Sales manager.
- Sales executive.

UAT sessions:

1. Content management and publishing.
2. Omni-channel lead journey and CRM handoff.
3. Site visit booking and confirmation.
4. Chatbot answer/scoring/handoff review.
5. Analytics dashboard review.
6. Recovery: failed CRM/channel sync and retry.

UAT sign-off requires:

- Business approves content fields.
- Sales approves CRM workflow.
- Marketing approves publishing workflow.
- Owner approves dashboards.
- Admin understands backup/restore runbook.

## 7. Launch smoke test

After production deploy:

- Visit public home page.
- Visit property page.
- Submit test lead.
- Verify lead in app and Twenty.
- Ask chatbot known question in website chat lab.
- If enabled, send test WhatsApp/Instagram webhook event.
- Verify lead score/handoff result.
- Book test site visit.
- Verify email/calendar if connected.
- Check analytics event.
- Confirm backup job scheduled.
- Confirm errors dashboard clean.

## 8. Acceptance criteria

- Vitest API/worker/shared tests pass.
- All critical Playwright E2E tests pass.
- No critical/high security findings open.
- RAG test set passes launch gate.
- UAT signed off by business owner.
- Backup restore test completed.
