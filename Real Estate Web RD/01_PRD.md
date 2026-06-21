# Product Requirements Document: Real-Estate AI Web App

## 1. Product vision

Build a self-hosted, premium omni-channel AI platform for high-revenue real-estate organizations that converts property content and conversations into qualified leads, CRM records, scheduled viewings, and measurable sales activity. The product should behave like an AI sales assistant across website, WhatsApp, and Instagram, not a basic brochure site.

The platform combines a public property website, admin CMS, omni-channel RAG chatbot, EGI channel framework, staging workflow, lead scoring, human handoff queue, Twenty CRM lead management, property viewing scheduler, direct Google Workspace/Gmail integration, direct social publishing, AI-assisted image editing, and executive analytics.

The product is India-ready from V1 and can be adapted for high-revenue real-estate organizations worldwide.

## 2. Target customers

Primary customers:

- Property developers and builders.
- Premium real-estate brokerages.
- Commercial real-estate firms.
- Property marketing agencies managing multiple projects.
- Large landlords and property management firms.

Best-fit customer profile:

- Has multiple active property listings/projects.
- Receives inbound leads from website, WhatsApp, calls, ads, or social media.
- Wants central lead visibility without buying/maintaining many SaaS tools.
- Needs compliance-friendly property pages, accurate RERA fields, and auditability.
- Values data control and customization.

## 3. User personas

### Business owner / director

Needs revenue visibility, lead quality, campaign ROI, missed follow-ups, booked site visits, and pipeline performance.

### Sales manager

Needs assignment, lead qualification, duplicate detection, reminders, CRM pipeline, and SLA tracking.

### Sales executive

Needs fast lead context, previous conversation summary, property interest, call/WhatsApp notes, booking status, and follow-up tasks.

### Marketing/admin user

Needs to create/edit property pages, manage project details, publish updates, stage changes before going live, and push approved posts to Instagram.

### Website visitor / buyer / tenant

Needs trustworthy property information, photos, location details, pricing ranges, amenities, availability, RERA registration number, quick answers, and booking options.

## 4. Core value proposition

The app gives a real-estate business one controlled system for website content, approved AI knowledge, omni-channel conversations, lead capture, lead scoring, CRM movement, scheduled property visits, publishing, and analytics. It avoids the common headache of scattered SaaS tools by using a single-VPS deployment and Twenty CRM as the only CRM core.

## 5. V1 product principles

- Single VPS first: reduce moving parts and operating cost.
- Twenty CRM only: do not introduce another CRM.
- Omni-channel first: website chat, WhatsApp Business Platform, and Instagram Messaging/DM share one normalized conversation, RAG, scoring, booking, and handoff pipeline.
- Direct official integrations only: Google Workspace/Gmail OAuth and official Meta/WhatsApp/Instagram APIs where required.
- AI should be grounded: chatbot answers must cite retrieved business content and avoid unsupported claims.
- Compliance by design: RERA and privacy fields are not optional after launch.
- Staging before live publishing: no accidental property page changes.
- Admins should not need developers for daily content changes.

## 6. V1 scope

### Public website

- Home page.
- Project/property listing pages.
- Property detail pages.
- Developer/about page.
- Contact and lead forms.
- AI chatbot widget and admin chat lab.
- Book a viewing/site visit flow.
- SEO metadata and structured data for property pages.
- RERA field display where applicable.

### Admin CMS

- Property/project CRUD.
- Media upload and ordering.
- Floor plan upload.
- Amenities and features management.
- Locality/location fields.
- Pricing display rules.
- RERA registration fields.
- Draft, staged, approved, published workflow.
- Version history for content updates.
- Preview URL for staged content.

### Omni-channel RAG chatbot

- Ingests approved/published business content into PostgreSQL + pgvector.
- Supports website chatbot UI first, then WhatsApp Business Platform and Instagram Messaging/DM through official APIs and webhooks.
- Uses the internal EGI framework: normalize channel events, ground/generate safe responses from approved RAG content, then integrate actions such as links, lead capture, booking, CRM sync, and human handoff.
- Answers questions about projects, pricing ranges, availability, amenities, site visits, financing disclaimers, and contact process.
- Generates property links, booking CTAs, and safe next-step suggestions when supported by approved content.
- Captures leads mid-conversation after consent.
- Scores leads by intent, budget, contact details, property match, urgency, booking status, and channel engagement.
- Creates/updates leads in Twenty CRM and queues human handoff for high-intent or sensitive conversations.
- Shows fallback when it lacks reliable information.
- Logs conversations with PII controls.

### Twenty CRM

- Twenty CRM is the lead/customer source of truth.
- Leads from website chat, WhatsApp, Instagram DM, forms, scheduler, and social campaign links create or update Twenty People/Companies/Opportunities.
- CRM records store property interest, source, UTMs, conversation summary, booking status, and follow-up tasks.
- No second CRM in V1.

### Scheduler

- Site visit booking flow from public pages and omni-channel chatbot.
- Availability rules configured by admin.
- Internal booking records in app database.
- Optional Google Calendar event creation through OAuth only.
- Booking confirmation through Gmail API only.

### Social publishing and AI media

- Admin can prepare social content from property/project content.
- Admin can use AI-assisted image editing/cropping/enhancement workflows before approval, with originals preserved and scanned media rules enforced.
- Instagram publishing uses official Meta/Instagram APIs after business account/app approval and valid Instagram professional account IDs.
- V1 supports draft social post, approval, publish, and publish log.
- No third-party social scheduling platform.

### Analytics

- Lead source tracking.
- Chatbot sessions and conversions.
- Property page views and CTA clicks.
- Booked, completed, cancelled viewings.
- CRM pipeline movement imported from Twenty.
- Content change audit and publishing activity.

## 7. Explicit V1 non-goals

- No monday CRM, HubSpot, Salesforce, Pipedrive, Zoho CRM, Airtable CRM, or custom second CRM.
- No multi-VPS or Kubernetes V1 deployment.
- No managed vector database such as Pinecone.
- No managed search service such as Algolia.
- No Zapier, Make, n8n, or third-party automation middleware.
- No Microsoft 365 integration in V1.
- No generic SMTP/IMAP in V1.
- No ungrounded chatbot answer mode.
- No unofficial WhatsApp/Instagram scraping, personal-account automation, or browser-bot messaging.
- No property transaction/payment processing in V1.
- No legal advice or financial advice generated by AI.

## 8. Key user journeys

### Journey A: Visitor becomes qualified lead

1. Visitor lands on a property page, WhatsApp chat, or Instagram DM.
2. Visitor asks the chatbot about price, location, amenities, possession, availability, or asks for links/booking.
3. EGI normalizes the channel event into one conversation model.
4. Chatbot answers only from approved content and returns sources, property links, or booking options where appropriate.
5. Chatbot asks for name, phone, email, and property interest when buying intent is detected and consent is shown.
6. System calculates lead score and handoff reason.
7. Lead is deduplicated and pushed to Twenty CRM.
8. Sales owner is assigned or human handoff is queued.
9. Analytics captures conversion source and channel.

Acceptance criteria:

- Lead record is created in Twenty within 10 seconds after valid submission when Twenty is available.
- Duplicate phone/email is merged or linked, not blindly duplicated.
- Chat transcript summary, lead score, source channel, and handoff reason are attached to the CRM record or task/note.
- If Twenty API fails, the lead stays in an outbox queue and retries.

### Journey B: Admin publishes property update safely

1. Admin edits a property in CMS.
2. Changes are saved as draft.
3. Admin previews staged URL.
4. Approver compares current vs staged values.
5. Approver publishes.
6. RAG index refreshes only after publish.
7. Audit log records who changed what and when.

Acceptance criteria:

- Draft changes do not affect live site or chatbot.
- Published version has a rollback point.
- RERA number validation warning appears before publishing an applicable project without RERA data.

### Journey C: Visitor books viewing

1. Visitor selects property and preferred slot.
2. System validates availability.
3. Visitor submits contact information.
4. Booking is stored internally.
5. Lead and task are created/updated in Twenty.
6. Optional Google Calendar event is created.
7. Confirmation email is sent using Gmail API.

Acceptance criteria:

- Booking is not double-booked.
- CRM task is created for the assigned sales executive.
- Confirmation and cancellation state changes are auditable.

### Journey D: Marketing publishes social post

1. Admin selects property/project.
2. System creates social post draft from approved content.
3. Admin edits caption and selects images/reel assets.
4. Approver approves.
5. System publishes through Meta/Instagram API if account permissions are valid.
6. Publish status and API response are logged.

Acceptance criteria:

- No social post is published without approval.
- Failed publishing never loses the draft.
- Published post ID/permalink is stored.

## 9. Functional requirements

### CMS requirements

- Create, edit, archive, and publish projects/properties.
- Store price ranges, configurations, amenities, construction status, possession date, address, locality, map coordinates, media, brochures, and RERA metadata.
- Display compliance warnings before publishing.
- Support draft/staged/published states.
- Support version rollback.

### Lead requirements

- Capture leads from forms, website chatbot, WhatsApp, Instagram DM, scheduler, and campaign links.
- Required fields: name, phone or email, property interest where available, consent checkbox/text, source channel.
- Optional fields: budget range, preferred location, purchase timeline, notes, channel handle/ID, last intent, handoff reason.
- Deduplicate by normalized phone and email where available, and channel identity when phone/email is not yet shared.
- Score lead quality and urgency.
- Sync to Twenty CRM.

### Chatbot requirements

- Answer only from indexed approved content.
- Use one omni-channel conversation engine for website, WhatsApp, and Instagram DM.
- Refuse unsupported claims.
- Capture lead consent before storing PII.
- Route booking intent to scheduler.
- Generate links/CTAs only when URL/action is known and allowed.
- Calculate lead score and handoff recommendation after meaningful buyer signals.
- Log answer source IDs and action traces for audit.
- Allow admin to mark bad answers for review.

### CRM requirements

- Create/update People, Companies, Opportunities, Tasks, Notes, and custom objects as needed using Twenty APIs.
- Maintain idempotency keys for sync.
- Store sync status and retry failed operations.
- Provide direct CRM deep links from admin dashboard.

### Scheduler requirements

- Admin-defined working hours, blackout days, slot duration, buffer time, max bookings per slot.
- Booking lifecycle: requested, confirmed, rescheduled, cancelled, completed, no-show.
- Google Calendar event creation via OAuth.
- Gmail confirmation email via API.

### Analytics requirements

- Track anonymous session events until lead capture.
- Attribute lead source using UTM, referrer, and channel identity.
- Show funnel: channel session -> chatbot engaged -> lead captured -> lead scored -> booking -> CRM opportunity -> won/lost.
- Show slow follow-ups, unassigned leads, high-score leads, and human-handoff queue.
- Provide export for owner/director review.

## 10. Non-functional requirements

- Availability target for V1: 99.5% monthly for the single VPS deployment, excluding planned maintenance and provider outages.
- Public pages should load fast on Indian mobile networks; use Vite static build, caching, and later prerender/SSR only if SEO/performance evidence requires it.
- Admin actions must be auditable.
- Backups must be restorable, not merely present.
- All secrets must be stored outside Git.
- All public forms must have rate limiting and abuse protection.
- The system must degrade gracefully if AI, channel APIs, or social publishing are unavailable.

## 11. Success metrics

Product launch metrics:

- 100% of active properties migrated into CMS.
- 100% of public property pages have required metadata and RERA fields where applicable.
- Twenty sync success rate above 99% after retries.
- Chatbot unsupported-answer fallback rate below 20% after content tuning.
- Lead capture conversion rate baseline established in first month.

Business metrics:

- More qualified leads captured from website, WhatsApp, and Instagram.
- Faster response to high-intent visitors across channels.
- More site visits booked without manual coordination.
- Reduced manual content update dependency.
- Better owner visibility into ROI.

## 12. Launch acceptance checklist

- Public website deployed behind HTTPS.
- CMS roles configured.
- Twenty CRM self-hosted and connected.
- Google OAuth app configured for approved scopes.
- RAG ingestion runs after publish.
- Chatbot has fallback guardrails.
- Website chatbot test UI works before enabling WhatsApp/Instagram live channels.
- Lead scoring and human handoff queue work.
- Scheduler is tested for booking, reschedule, cancel.
- Analytics dashboard shows real events.
- Backup and restore test completed.
- RERA and DPDP compliance checks reviewed by business/legal owner.

## 13. Source notes

Current technical stack and compliance assumptions were validated against official Vite, React, Fastify, Node.js, PostgreSQL, Twenty, pgvector, Google, Meta, MeitY, RERA, and OWASP sources. See `15_SOURCE_RESEARCH_LOG.md` and `17_DECISIONS_LOCK.md`.
