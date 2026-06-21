# CMS and Content Pipeline Research / Design

## 1. Purpose

The CMS is the source of truth for the public website and omni-channel RAG chatbot content. It is not a generic blog CMS. It is a real-estate content operating system with staging, approval, compliance warnings, chatbot testing, and AI indexing.

## 2. Content types

### Project

Fields:

- Project name.
- Developer/promoter name.
- Project type.
- City, locality, address.
- Map coordinates.
- Map provider place/geocode metadata where available; never rely on live geocoding at page render time.
- Description.
- Status: upcoming, pre-launch, launched, under construction, ready-to-move, sold out, archived.
- RERA registration number.
- RERA registration URL or portal reference.
- Possession timeline.
- Amenities.
- Brochure.
- Gallery.
- FAQs.

### Property/unit/listing

Fields:

- Listing title.
- Project relation.
- Configuration: 1BHK/2BHK/3BHK/villa/plot/commercial/etc.
- Built-up/carpet/super built-up area fields as applicable.
- Price display mode: hidden, starting from, range, exact, contact sales.
- Availability state.
- Floor/stack/tower details if applicable.
- Images/floor plans.
- CTA settings.

### Locality guide

Fields:

- Locality name.
- Nearby landmarks.
- Connectivity.
- Schools/hospitals/offices.
- Market notes.
- SEO content.

### FAQ

Fields:

- Question.
- Answer.
- Related project/property.
- Visibility.
- AI-indexable flag.

### Social post draft

Fields:

- Related property/project.
- Caption.
- Media assets.
- Approval state.
- Platform.
- Publish status.
- Published post ID/permalink.

## 3. Content states

- Draft: editable, not public, not indexed.
- Staged: previewable, not public, not indexed.
- Approved: ready for publish.
- Published: public and indexed.
- Archived: hidden from public, removed from active index.

## 4. Versioning

Every publish creates immutable version rows:

- `content_version_id`
- `entity_type`
- `entity_id`
- `version_number`
- `snapshot_json`
- `published_by`
- `published_at`
- `change_summary`

Rollback publishes a previous version as a new version; it should not delete history.

## 5. RERA compliance checks

India real-estate marketing often requires project/agent registration and correct registration display where applicable. Official RERA portals emphasize project/agent registration and information disclosure; Telangana RERA exists for transparency and project registration/information dissemination. [S26] [S27]

CMS should warn before publishing when:

- Project status is marketable but RERA number is empty.
- Pre-launch status is selected without compliance confirmation.
- RERA number format is missing or inconsistent.
- Advertisement/social post draft does not include required RERA line when applicable.
- Price/possession data is changed without approver note.

The system should not claim legal compliance by itself. It should provide workflow checks and audit logs for business/legal review.

## 6. Staging preview

Preview URLs:

- Must require authenticated admin/approver access.
- Must be excluded from search indexing.
- Must show a visible “STAGED PREVIEW” banner.
- Must display diff against published version.

## 7. Publishing process

1. Editor creates draft.
2. Editor submits for approval.
3. Approver reviews field changes and compliance warnings.
4. Approver publishes.
5. System creates immutable published version.
6. Website cache is invalidated.
7. RAG indexing job is queued.
8. Admin can test website/WhatsApp/Instagram-style prompts in the chatbot lab before live channel exposure.
8. Audit event is created.

## 8. Media management

V1 stores uploaded files on VPS filesystem volume:

- `/data/uploads/tmp`
- `/data/uploads/originals`
- `/data/uploads/optimized`
- `/data/uploads/private`
- `/data/uploads/quarantine`

Upload pipeline:

1. Stream upload through Fastify multipart into private temporary storage.
2. Enforce size limits before final storage.
3. Validate extension and magic bytes; MIME headers are advisory only.
4. Scan with ClamAV before publishing or transforming.
5. Reject or quarantine non-clean files.
6. Process images with Sharp into web-friendly responsive variants.
7. Strip image metadata from public optimized variants.
8. Store media metadata and scan/transform status in the app database.

Allowed V1 uploads:

- Images: JPG, PNG, WebP, AVIF; default max 15 MB each.
- PDFs: floor plans and brochures; default max 25 MB each.
- Default max 20 files per property/project draft unless owner changes it.

Disallowed V1 uploads:

- SVG, HTML, JavaScript, archives, executables, Office macros, and video.

Image processing:

- Generate WebP/AVIF plus fallback variants where needed.
- Preserve original file in private storage.
- Add required alt text field before publish.
- Never use original filenames for storage paths; generate UUID v7 object names.

Do not introduce S3/MinIO unless local filesystem limits become painful. Twenty supports storage configuration including S3/local paths; the app should choose local paths for V1 unless the client approves object storage. [S11]

## 9. SEO requirements

- Per-property title and meta description.
- Canonical URLs.
- OpenGraph images.
- Structured data where appropriate.
- Sitemap generation.
- Robots rules for staged content.
- Fast public page rendering.

## 10. CMS acceptance criteria

- Admin can create/update/publish a property without developer support.
- Draft does not affect live website or chatbot.
- Publish queues RAG re-index job.
- Chatbot lab can validate updated source chunks before channel rollout.
- RERA warnings appear before publishing marketable property/project content.
- Version history can show who changed what and when.
- Rollback restores content safely.
