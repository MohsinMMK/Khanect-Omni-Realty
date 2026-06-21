# Twenty CRM Research and Integration Design

## 1. Decision

Twenty CRM is the only CRM in V1. The web app must not create a competing CRM pipeline. It should use local staging/outbox tables only for reliability and then sync to Twenty.

Twenty is used as upstream self-hosted software, not a fork. V1 should not modify Twenty source code, ship a custom Twenty build, or merge Twenty UI into the custom app. Configure the client workspace through supported Twenty UI/API features: custom fields, optional custom objects, API keys, and webhooks.

Twenty is suitable for this project because it can be self-hosted for data ownership, compliance, and customization. Its API model exposes REST and GraphQL APIs generated from the workspace schema, including custom objects and metadata operations. [S11] [S13]

### Why not fork Twenty

Forking Twenty would make this project responsible for merging upstream security fixes, schema changes, build changes, and CRM UI changes forever. That increases maintenance risk before the real-estate product is even launched.

Using upstream self-hosted Twenty keeps CRM responsibilities inside a mature CRM product while the custom app focuses on real-estate-specific value: public website, CMS, omni-channel RAG chatbot, lead scoring, scheduler, analytics, compliance warnings, and integration reliability.

The app should customize Twenty through supported workspace configuration and APIs, not source-code forks.

### Seamless interaction model

Twenty stores CRM records and owns CRM database migrations. The custom app stores website/CMS/bookings/omni-channel chat/RAG/lead scoring/uploads/audit data and only the CRM sync metadata needed for reliability and UX.

The app should feel connected to CRM by showing:

- Twenty sync status on every lead/booking record.
- Twenty Person/Opportunity/Task IDs stored in app-side sync tables.
- Deep links from app admin screens to the matching Twenty records.
- CRM-lite panels for recent leads, lead score, handoff reason, assigned owner, booking status, latest CRM note/task summary, and failed sync retries.
- Background refresh/outbox jobs so temporary Twenty downtime never loses leads.

Do not make app screens the authoritative CRM pipeline. Sales-owned CRM fields and pipeline stages remain in Twenty.

## 2. Deployment decision

Deploy Twenty on the same VPS using Docker Compose as recommended by Twenty self-host docs. [S12]

Use separate subdomain:

- `crm.clientdomain.com` for Twenty.
- `clientdomain.com/admin` for the custom app admin.

Both run on the same VPS and same Docker Compose project, but remain separate services and databases.

Do not modify Twenty source code or database tables directly. All CRM writes go through Twenty API.

## 3. Data mapping

### App lead capture -> Twenty Person

Fields:

- Name -> Person name.
- Email -> Person email.
- Phone -> Person phone.
- Source/channel -> custom field/source.
- Consent timestamp -> custom field or note.
- Lead score/band -> custom field or note.
- Handoff reason -> custom field or task/note.
- Language -> custom field.
- City/locality interest -> custom field.

### Property interest -> Twenty Opportunity

Fields:

- Opportunity name: `{person_name} - {property_name}`.
- Stage: New lead / Qualified / Visit booked / Visit completed / Negotiation / Won / Lost.
- Amount: optional budget range if provided, not guessed.
- Source: website chatbot/WhatsApp/Instagram DM/scheduler/social campaign.
- Property ID: custom field or custom object relation.
- UTM/channel fields: campaign/source/medium/content/term/channel.

### Booking -> Twenty Task + Note

Fields:

- Task title: Site visit for property.
- Due date/time: booking slot.
- Owner: assigned sales executive.
- Note: visitor message and booking metadata.
- Status updates: confirmed/cancelled/completed/no-show.

### Conversation -> Twenty Note

Store summary, not full raw transcript by default. Raw transcript remains in app database with retention rules.

## 4. Proposed Twenty custom fields/objects

Custom fields on Person:

- Lead source.
- Consent captured at.
- Preferred language.
- Budget range.
- Preferred locality.
- Purchase/rent timeline.

Custom fields on Opportunity:

- Property/project external ID.
- Property type.
- Unit configuration.
- Booking status.
- Last chatbot intent.
- Lead score and score band.
- Handoff reason.
- Campaign UTM/channel fields.

Optional custom object:

- `PropertyInterest` linking Person, Opportunity, and external property record.

## 5. Sync design

Use outbox pattern:

- App stores `lead_capture` locally.
- Worker creates idempotent `crm_sync_job`.
- Worker calls Twenty API.
- Worker stores Twenty record IDs and deep-link URLs.
- Worker retries failures.
- Admin can manually retry dead-letter jobs.
- Admin screens can read synced CRM summaries through the app API for seamless context without direct browser access to Twenty secrets.

Idempotency strategy:

- Person key: normalized email or normalized phone.
- Opportunity key: person key + property ID + active pipeline status.
- Booking task key: booking ID.

Conflict policy:

- Do not overwrite sales-owned CRM fields blindly.
- App can update source/context/score/handoff fields.
- Sales pipeline stage should be owned by CRM users after initial creation.
- Booking status can update CRM task/note.

## 6. API design

Twenty API wrapper functions:

- `findPersonByEmailOrPhone()`
- `createPerson()`
- `updatePersonContext()`
- `findOrCreateOpportunity()`
- `createTask()`
- `appendNote()`
- `updateLeadScoreContext()`
- `createHumanHandoffTask()`
- `updateBookingTaskStatus()`
- `getPipelineSummary()`

The wrapper should hide REST vs GraphQL differences. Use REST where simple CRUD is clearer. Use GraphQL where relationships, batch upserts, or cross-object reads reduce calls. Twenty supports schema-per-workspace REST and GraphQL generated from objects/custom objects, so exact fields must be discovered from the client workspace API docs after custom objects/fields are configured. [S13]

## 7. Webhooks

Twenty webhooks can notify the app about create/update/delete events for records, including custom objects. V1 should not depend on webhooks for the first launch path; outbox sync remains source of reliability.

Recommended webhook phase:

- Add webhook receiver after core lead sync is stable.
- Verify webhook authenticity if Twenty provides signature/secret support in the deployed version; otherwise restrict by network/proxy controls where possible and treat payload as untrusted.
- Use webhooks to refresh local sync status, pipeline summaries, and deleted/merged record awareness.
- Make webhook processing idempotent.

## 8. Authentication and API keys

- Use a service API key generated inside the client Twenty workspace.
- Store the key encrypted in app secrets.
- Never expose it to the browser.
- Rotate key before launch and after team handover.
- Scope permissions as narrowly as Twenty allows.

## 9. CRM screens needed in the app

The app admin dashboard should not duplicate full CRM. It should show:

- Recent captured leads.
- Sync status.
- CRM deep link.
- Assigned sales owner.
- Booking status.
- Failed sync queue.
- Lead source analytics.

For pipeline management, users should open Twenty. App admin screens provide status, retry, analytics, and deep links only; they do not replace Twenty CRM UI.

## 10. Sales workflow

1. New lead enters Twenty.
2. Sales manager assigns owner.
3. Sales executive calls/messages lead.
4. Site visit is booked or updated.
5. Opportunity stage moves through pipeline.
6. Won/lost reason is recorded in Twenty.
7. App analytics imports/reads pipeline summaries for dashboards.

## 11. CRM acceptance criteria

- Valid website lead creates/updates Person and Opportunity in Twenty.
- Booking creates/updates CRM Task.
- Chatbot summary is added as a Note.
- Duplicate lead does not create duplicate active opportunities for the same property/person combination unless configured.
- CRM sync failures are visible and retryable.
- App dashboards link to Twenty records.
