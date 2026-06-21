# Scheduler, Email, and Social Integration Design

## 1. Purpose

Provide direct integrations that support real-estate sales activity without adding automation middleware. V1 supports viewing/site visit scheduling, Gmail confirmation emails, optional Google Calendar sync, omni-channel WhatsApp/Instagram messaging via official APIs, and direct Instagram/Meta content publishing.

## 2. Google Workspace principle

Google Workspace/Gmail is the only email/calendar integration in V1. Use OAuth only. No generic SMTP, no generic IMAP, and no Microsoft 365 in V1.

Google's official docs define Gmail API OAuth scopes and recommend selecting scopes based on the level of access needed. [S23]

Production setup requirements:

- Use separate Google Cloud projects for testing and production.
- Configure OAuth consent screen, verified domain, support email, privacy policy, and redirect URIs before production.
- Declare only the scopes actually used by enabled features.
- Keep booking usable even when Google verification or API access is delayed.

## 3. Gmail requirements

V1 email actions:

- Send booking confirmation.
- Send booking cancellation/reschedule notice.
- Send lead acknowledgement.
- Send internal notification if configured.

Preferred scope:

- Use least-privilege `https://www.googleapis.com/auth/gmail.send` for sending if the app only sends emails.
- Do not request full mailbox access unless the business explicitly approves a CRM email-sync feature.

Storage:

- Store OAuth tokens encrypted.
- Store email send status, message ID, recipient, template, and related booking/lead ID.
- Do not store full email body unnecessarily after send unless required for audit.

## 4. Google Calendar requirements

Google Calendar API docs require configuring OAuth consent and choosing scopes. [S24]

Preferred scope posture:

- Use the narrowest Calendar scope that supports creating, updating, and cancelling app-created booking events.
- Avoid broad calendar read/write access unless the business explicitly approves availability sync from user calendars.
- Store connected account, granted scopes, refresh status, and disconnect action in admin.

V1 calendar actions:

- Create site visit event.
- Update event when rescheduled.
- Cancel event when booking cancelled.
- Add assigned salesperson and visitor where policy allows.

Availability source:

- V1 source of truth is app booking rules and booking table.
- Google Calendar event creation is a sync action, not the transactional reservation source.

This avoids losing booking control if Google API is delayed.

## 5. Scheduler rules

Admin-configurable:

- Working days.
- Working hours.
- Slot duration.
- Buffer time.
- Max bookings per slot.
- Project-specific blackout dates.
- Salesperson/team assignment rules.
- Minimum notice time.

Booking lifecycle:

- Requested.
- Confirmed.
- Rescheduled.
- Cancelled.
- Completed.
- No-show.

## 6. Scheduler database requirements

Tables:

- `booking_rule`
- `booking_blackout`
- `booking_slot`
- `booking`
- `booking_event_sync`
- `booking_email_log`

Database must enforce no double booking for the same property/team slot by unique constraint or transaction lock.

## 7. WhatsApp and Instagram messaging

Omni-channel chatbot targets:

- Website chat widget controlled by the app.
- WhatsApp Business Platform Cloud API with verified WABA/phone number, webhooks, templates, and platform limits. [S46]
- Instagram Messaging/DM through official Meta business messaging APIs and webhooks. [S47]

Messaging rules:

- All inbound webhooks must be verified and idempotent.
- Normalize channel event into the EGI conversation pipeline before RAG/lead scoring.
- Store channel ID, external message ID, timestamp, delivery state, consent state, and conversation linkage.
- Business-initiated WhatsApp messages require approved templates when outside the customer service window.
- Do not use unofficial WhatsApp Web automation, personal-account bots, scraping, or browser-driving for messaging.
- Human handoff state must pause or gate automated replies when sales takes over.

## 8. Instagram/Meta publishing

Meta's official Instagram Platform content publishing documentation covers publishing single images, videos, reels, and carousel posts. [S22] V1 product scope remains image/carousel-first because video uploads are disallowed in the locked media rules unless the owner reopens that decision.

V1 social publishing flow:

1. Admin creates social draft from property/project content.
2. Admin edits caption/media and optionally uses AI-assisted image edit/crop/enhancement tools.
3. Approver approves final image/caption/compliance warnings.
4. Worker publishes through Meta/Instagram API.
5. Publish result is logged.

Constraints:

- Business must have correct Instagram professional/business setup and Meta developer app permissions.
- Business Login/Facebook Login and content publishing permission are required before production publishing.
- Publishing uses media container creation, container status checks, and media publish endpoints.
- Publishing media may need a temporary public URL that Meta can fetch; expose only approved, scanned, non-sensitive media variants.
- App must enforce conservative publish caps and check platform publishing-limit endpoints when available.
- Containers can expire; worker must detect expired containers and ask admin to recreate/reapprove instead of retrying forever.
- App review and permissions may delay launch of social publishing.
- No third-party social scheduling tool is used.
- Failed publishing does not delete drafts.

## 9. Social post compliance checks

Before approval/publish:

- Confirm property/project is approved for marketing.
- Include RERA number line where applicable.
- Warn on price/offer claims.
- Warn on unapproved possession/legal claims.
- Store approver and approval timestamp.

## 10. Integration adapter design

Adapters:

- `gmailAdapter.sendEmail()`
- `calendarAdapter.createEvent()`
- `calendarAdapter.updateEvent()`
- `whatsappAdapter.verifyWebhook()`
- `whatsappAdapter.sendMessage()`
- `instagramMessagingAdapter.verifyWebhook()`
- `instagramMessagingAdapter.sendMessage()`
- `instagramAdapter.createMediaContainer()`
- `instagramAdapter.publishMedia()`
- `twentyAdapter.createTaskForBooking()`

All adapters:

- Run only from worker/server.
- Use encrypted tokens/secrets.
- Log request type and response summary.
- Redact tokens and PII from logs.
- Retry transient failures.
- Expose admin retry action.

## 11. Acceptance criteria

- User can book a visit without Google Calendar being connected.
- Connected Google Calendar receives event after booking confirmation.
- Gmail confirmation sends through OAuth API.
- Failed email/calendar sync is retryable.
- Website, WhatsApp, and Instagram messages can enter the same EGI conversation pipeline when credentials/permissions are configured.
- Human handoff can pause or override automated channel replies.
- Approved Instagram post can publish through direct API when permissions are valid.
- No social post bypasses approval.
