# Risk Register

## 1. Technical risks

### R1: Single VPS outage

Impact: Entire platform offline.

Mitigation: Daily VPS snapshots, documented restore process, fast redeploy runbook, future offsite backup option.

### R2: Local LLM too slow on CPU VPS

Impact: Chatbot feels poor and reduces conversions.

Mitigation: Size GPU VPS for production AI, allow chatbot lead-capture fallback mode, keep LLM adapter pluggable.

### R3: Twenty upgrade breaks custom integration

Impact: Lead sync or CRM workflows fail.

Mitigation: Test Twenty upgrades on copied data, use API not direct DB writes, keep rollback plan.

### R4: Vector retrieval returns wrong property context

Impact: Chatbot gives misleading answer.

Mitigation: Enforce property/tenant filters, source IDs, eval set, fallback rules.

### R5: Disk fills due uploads/logs/models/backups

Impact: Service failure or database corruption risk.

Mitigation: Disk monitoring, retention policies, upload optimization, backup rotation.

### R5a: Public map/tile dependency breaks or becomes expensive

Impact: Property maps fail, pages slow down, or provider bill spikes.

Mitigation: Use MapLibre with configurable paid/self-hosted provider, cache coordinates, do not depend on public OSM tile servers/Nominatim in production, set provider budget alerts.

## 2. Product risks

### R6: Admins do not maintain content quality

Impact: Chatbot and website become outdated.

Mitigation: Missing-content dashboard, content review calendar, fallback topic reports.

### R7: Sales team ignores Twenty CRM

Impact: Leads captured but not converted.

Mitigation: CRM training, owner dashboard for overdue/unassigned leads, simple workflows.

### R8: Too many features for V1

Impact: Delayed launch and unstable system.

Mitigation: Keep V1 strict; website chatbot and shared EGI pipeline first, then enable WhatsApp/Instagram only after official credentials, webhooks, tests, and business approval. No voice/multi-tenant SaaS/payment processing until core works.

## 3. Compliance risks

### R9: Incorrect RERA advertising data

Impact: Regulatory/reputation risk.

Mitigation: Required RERA fields, warnings, approval workflow, audit logs, business/legal sign-off.

### R10: DPDP/privacy process incomplete

Impact: Legal/privacy risk.

Mitigation: Consent logs, retention, export/delete workflow, privacy policy review.

### R11: Chatbot gives legal/financial advice

Impact: Liability risk.

Mitigation: Prompt policy, output validation, sensitive intent fallback, admin testing.

## 4. Integration risks

### R12: Meta/Instagram/WhatsApp permissions delayed

Impact: Instagram publishing, Instagram DM, or WhatsApp channel may not be available at launch.

Mitigation: Keep website chatbot and admin chat lab usable first; treat live social/messaging channel activation as credentials/approval-gated; keep drafts/approval ready; publish or respond manually until app review/setup passes.

### R13: Google OAuth verification/scope issues

Impact: Gmail/calendar sync delayed.

Mitigation: Use least scopes, configure consent early, keep booking functional without Google sync.

### R14: Gmail deliverability or account limits

Impact: Confirmation emails delayed/failed.

Mitigation: Retry logs, admin warning, manual fallback, email template approval.

## 5. AI/security risks

### R15: Prompt injection

Impact: Model may ignore policy or expose unsafe output across website, WhatsApp, or Instagram.

Mitigation: OWASP-aligned prompt injection tests, tool gating, untrusted content separation, channel-safe response validation, human handoff for sensitive/low-confidence cases.

### R16: PII leakage in logs

Impact: Privacy incident.

Mitigation: Log redaction, structured logging, no raw tokens or channel secrets, PII minimization, avoid storing unnecessary channel payload fields.

### R16a: Malicious or unsafe upload reaches public site

Impact: Malware distribution, defacement, user harm, or compliance incident.

Mitigation: Fastify multipart limits, magic-byte validation, ClamAV scan, Sharp transforms, no SVG/executable/archive/video V1 uploads, quarantine/delete non-clean files before public exposure.

## 6. Operational risks

### R17: Backups exist but restore fails

Impact: False sense of security.

Mitigation: Monthly restore tests and launch restore test.

### R18: Client loses admin/secret control

Impact: Handover failure.

Mitigation: Credential inventory, secret rotation, owner account transfer checklist.
