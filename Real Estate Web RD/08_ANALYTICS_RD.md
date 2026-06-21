# Analytics Dashboard Research / Design

## 1. Purpose

The analytics module helps owners and sales managers understand whether the website, omni-channel chatbot, listings, scheduler, social content, lead scoring, handoff queue, and CRM pipeline are producing business value.

V1 uses internal event tracking and PostgreSQL rollups instead of a third-party analytics service. This follows the single-VPS/no-extra-service constraint.

## 2. Key dashboards

### Executive dashboard

- Total leads by date range.
- Qualified leads.
- Booked site visits.
- Completed site visits.
- Opportunity value if entered in CRM.
- Won/lost summary from Twenty.
- Top converting properties.
- Lead source/channel breakdown.
- High-score leads and handoff queue.
- Response SLA and overdue follow-ups.

### Marketing dashboard

- Page views by property/project.
- CTA clicks.
- Chatbot engagement by channel.
- Form conversion rate.
- Source/medium/campaign/channel performance.
- Social publish activity.
- SEO landing pages.

### Sales dashboard

- New leads pending assignment.
- Leads by owner.
- Hot/warm/cold score bands.
- Follow-up due/overdue.
- Human handoff queue.
- Bookings by salesperson.
- Lost reasons.
- Pipeline stage summary from Twenty.

### AI dashboard

- Chat sessions by website/WhatsApp/Instagram.
- Questions asked.
- Lead capture from chat.
- Lead score distribution.
- Handoff reasons.
- Fallback/no-answer rate.
- Bad answer reports.
- Top missing content topics.
- RAG index freshness.

## 3. Event taxonomy

Events:

- `page_view`
- `property_view`
- `cta_click`
- `lead_form_started`
- `lead_form_submitted`
- `chat_opened`
- `chat_message_sent`
- `chat_answer_returned`
- `chat_fallback_returned`
- `chat_lead_captured`
- `channel_webhook_received`
- `lead_scored`
- `human_handoff_requested`
- `human_handoff_resolved`
- `booking_slot_viewed`
- `booking_requested`
- `booking_confirmed`
- `booking_cancelled`
- `social_draft_created`
- `social_post_published`
- `crm_sync_succeeded`
- `crm_sync_failed`

Common properties:

- `tenant_id`
- `anonymous_session_id`
- `lead_id` after capture
- `property_id`
- `project_id`
- `utm_source`
- `utm_medium`
- `utm_campaign`
- `channel`
- `external_channel_id`
- `lead_score`
- `lead_score_band`
- `referrer`
- `device_type`
- `created_at`

## 4. Privacy model

Before lead capture:

- Track anonymous session ID.
- Do not store names/phone/email.
- Hash IP if needed for abuse protection.

After lead capture:

- Link session to lead only after consent.
- Store consent timestamp and source.
- Limit raw chat retention.
- Support export/delete workflow under privacy policy.

## 5. Data aggregation

Use daily rollup tables:

- `analytics_daily_property`
- `analytics_daily_source`
- `analytics_daily_chatbot`
- `analytics_daily_booking`
- `analytics_daily_crm`

Raw events remain queryable for debugging, with retention policy.

## 6. Attribution model

V1 attribution:

- First-touch source.
- Last-touch source.
- Current session source.
- UTM capture on lead.

Do not over-engineer multi-touch revenue attribution in V1. Keep raw events so better attribution can be added later.

## 7. CRM analytics sync

Read/import from Twenty:

- Opportunity stage.
- Owner.
- Created date.
- Updated date.
- Won/lost status.
- Lost reason.
- Expected/actual value if used.

Do not duplicate pipeline management in the app. Analytics only summarizes.

## 8. KPI definitions

- Website lead conversion = valid leads / unique visitors.
- Chat conversion = chat leads / chat sessions.
- Channel conversion = channel leads / channel sessions.
- Hot lead rate = hot leads / scored leads.
- Human handoff completion = resolved handoffs / requested handoffs.
- Booking conversion = bookings / valid leads.
- Visit completion rate = completed visits / confirmed bookings.
- CRM sync success = successful sync jobs / total sync jobs after retries.
- AI fallback rate = fallback answers / total chatbot answers.
- Missing content count = unique fallback topics needing content.

## 9. Acceptance criteria

- Owner can see leads, lead scores, handoffs, bookings, chatbot channels, and CRM funnel on one dashboard.
- Marketing can identify top converting property pages.
- Sales manager can see unassigned and overdue leads.
- AI dashboard shows no-answer questions for content improvement.
- No third-party analytics runtime is required.
