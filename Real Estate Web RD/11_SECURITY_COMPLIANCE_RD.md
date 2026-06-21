# Security, Privacy, Compliance, and AI Safety RD

## 1. Purpose

The platform handles lead PII, property marketing content, CRM records, OAuth tokens, channel tokens/webhooks, and omni-channel AI conversations. Security and compliance are not add-ons; they shape the architecture.

## 2. Privacy and DPDP readiness

India's MeitY lists Digital Personal Data Protection Rules, 2025 and related enforcement materials. [S25]

V1 should implement privacy basics from launch:

- Clear, standalone, easy-to-understand consent notice before collecting lead details.
- Purpose limitation: sales follow-up, viewing booking, support.
- Consent text versioning.
- Consent record with purpose, text version, timestamp, source page/channel, and IP hash or platform-safe identifier.
- Withdrawal/correction/removal request workflow visible from privacy/contact pages.
- Export/delete request workflow for app-side lead/chat/analytics data and CRM follow-up flag for Twenty-side data.
- PII minimization in logs.
- Data retention schedule.
- Breach response checklist.
- Vendor/integration inventory.

This document is not legal advice. The business should have counsel review final privacy policy, terms, consent copy, retention periods, and breach obligations.

## 3. RERA readiness

Official RERA portals emphasize real-estate project/agent registration and public information disclosure; Telangana RERA operates as an online project registration and information dissemination platform. [S26] [S27]

V1 should include:

- RERA number field.
- RERA URL/reference field.
- Project registration status field.
- Agent registration details where required.
- Publish warning for missing RERA fields.
- Social post warning for missing RERA line.
- Channel response warning for unsupported RERA/legal claims.
- Audit trail of property content, advertisements, and AI-assisted channel responses.

The app should not certify compliance. It should help the business avoid accidental non-compliant publishing.

## 4. Authentication and authorization

Main app:

- Better Auth with database-backed sessions.
- Role-based access: owner, admin, editor, approver, sales manager, sales executive, analyst, viewer.
- Optional Google sign-in if approved.
- 2FA/passkeys recommended for admins where available.

Twenty:

- Twenty manages CRM users/permissions.
- App uses service API key for sync.
- Do not expose service key to browser.

## 5. Role matrix

Owner:

- All dashboards.
- User management.
- Publish approval.
- Integration settings.
- Backup/health view.

Admin:

- CMS manage.
- Scheduler manage.
- Social drafts.
- CRM sync view.

Editor:

- Draft CMS content.
- Create social drafts.
- Cannot publish.

Approver:

- Approve/publish content and social posts.

Sales manager:

- View leads/bookings/analytics.
- Open CRM records.
- Retry CRM sync if permitted.

Sales executive:

- View assigned leads/bookings.
- Open CRM records.

Analyst:

- View analytics.

## 6. Web application security

- Input validation everywhere.
- Output encoding.
- CSRF protection.
- Secure cookies.
- Rate limiting.
- Bot protection on lead forms.
- Webhook verification and event deduplication for WhatsApp/Instagram channel events.
- File upload validation with extension and magic-byte checks.
- MIME sniffing prevention.
- ClamAV malware scan before public exposure.
- SVG, HTML, executable, archive, macro document, and video uploads disabled in V1.
- Public image variants generated through Sharp with metadata stripped.
- CSP/security headers.
- SQL injection prevention through parameterized queries/ORM.
- Secrets outside Git.
- Dependency scanning before release.

## 7. AI safety and security

OWASP GenAI guidance highlights prompt injection and other LLM app risks. [S28] [S29]

Controls:

- Treat user input as untrusted.
- Treat retrieved documents as untrusted content, not instructions.
- No hidden prompt disclosure.
- No tool execution from raw model output without policy checks.
- Answer only from source context.
- Red-team test prompt injection before launch.
- Store source references, channel, action trace, and lead score context for each answer.
- Human handoff for high-risk/high-intent conversations.
- Admin bad-answer feedback loop.

## 8. OAuth token security

- Store refresh/access tokens encrypted at rest.
- Limit OAuth scopes.
- Gmail V1 scope is `gmail.send` only unless mailbox sync is explicitly approved.
- Calendar V1 scope must be the narrowest scope needed for app-created booking events.
- Show connected account and scopes in admin.
- Provide disconnect/revoke action.
- Log token refresh failures without leaking tokens.
- Rotate client secrets after handover or suspected leak.

## 9. Audit logging

Audit events:

- Login/logout/admin access.
- User/role change.
- Content draft/edit/publish/rollback.
- RERA-sensitive field changes.
- Lead export/delete.
- Booking create/update/cancel.
- Integration connect/disconnect.
- Social approve/publish.
- AI-assisted image edit/generation approval.
- Channel webhook connect/disconnect and template/permission changes.
- Human handoff assign/resolve.
- CRM sync retry/manual override.
- Backup restore action.

Audit records should be append-only.

## 10. Incident response

Severity examples:

- Critical: exposed CRM/lead data, token leak, data deletion, public defacement.
- High: chatbot giving false legal/pricing claims, CRM sync outage, channel token leak, backup failure.
- Medium: social publishing failure, analytics delay, scheduler sync delay, WhatsApp/Instagram webhook delivery failure.
- Low: non-critical UI bug.

Incident steps:

1. Detect and classify.
2. Preserve logs.
3. Contain issue.
4. Notify owner.
5. Fix and verify.
6. Prepare customer/user notification if legally required.
7. Postmortem.

## 11. Acceptance criteria

- Consent is captured before PII storage with purpose, text version, timestamp, and source.
- Privacy request workflow exists for export/correction/removal.
- Admin roles prevent editors from publishing.
- OAuth tokens are encrypted.
- Chatbot passes prompt-injection and hallucination test cases across enabled channels.
- RERA warnings appear for applicable content/social drafts and sensitive chatbot answers.
- Audit logs show all sensitive admin actions.
