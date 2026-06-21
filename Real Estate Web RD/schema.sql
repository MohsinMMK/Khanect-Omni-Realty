-- schema.sql - high-level sketch, not final migration file.
-- Real migrations should be generated with drizzle-kit and reviewed before applying.
-- IDs are UUID v7 stored in uuid columns. Generate with PostgreSQL 18 UUID v7 support when available, otherwise use one shared application UUID v7 utility.
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE tenant (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  domain text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE project (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenant(id),
  name text NOT NULL,
  slug text NOT NULL,
  status text NOT NULL,
  city text,
  locality text,
  address text,
  latitude numeric,
  longitude numeric,
  map_provider text,
  map_provider_place_id text,
  rera_number text,
  rera_url text,
  published_version_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, slug)
);

CREATE TABLE property_listing (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenant(id),
  project_id uuid REFERENCES project(id),
  title text NOT NULL,
  slug text NOT NULL,
  configuration text,
  price_display_mode text NOT NULL DEFAULT 'contact_sales',
  price_min numeric,
  price_max numeric,
  availability_status text,
  latitude numeric,
  longitude numeric,
  map_provider text,
  map_provider_place_id text,
  published_version_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, slug)
);

CREATE TABLE media_asset (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenant(id),
  entity_type text,
  entity_id uuid,
  purpose text NOT NULL,
  status text NOT NULL DEFAULT 'uploaded',
  scan_status text NOT NULL DEFAULT 'pending',
  original_filename text,
  storage_key text NOT NULL,
  original_private_path text NOT NULL,
  optimized_public_paths jsonb NOT NULL DEFAULT '[]',
  detected_mime text NOT NULL,
  size_bytes bigint NOT NULL,
  sha256 text NOT NULL,
  alt_text text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE content_version (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenant(id),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  version_number integer NOT NULL,
  state text NOT NULL,
  snapshot_json jsonb NOT NULL,
  change_summary text,
  created_by uuid,
  published_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);

CREATE TABLE channel_conversation (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenant(id),
  channel text NOT NULL,
  external_thread_id text,
  anonymous_session_id text,
  lead_id uuid,
  property_id uuid,
  project_id uuid,
  status text NOT NULL DEFAULT 'open',
  handoff_status text NOT NULL DEFAULT 'none',
  last_intent text,
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, channel, external_thread_id)
);

CREATE TABLE channel_message (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenant(id),
  conversation_id uuid NOT NULL REFERENCES channel_conversation(id),
  channel text NOT NULL,
  external_message_id text,
  direction text NOT NULL,
  message_type text NOT NULL DEFAULT 'text',
  content text,
  source_ids jsonb NOT NULL DEFAULT '[]',
  action_trace jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, channel, external_message_id)
);

CREATE INDEX channel_conversation_tenant_status_idx ON channel_conversation (tenant_id, channel, status, handoff_status);
CREATE INDEX channel_message_conversation_idx ON channel_message (tenant_id, conversation_id, created_at);

CREATE TABLE lead_capture (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenant(id),
  name text,
  email text,
  phone text,
  normalized_email text,
  normalized_phone text,
  source text NOT NULL,
  source_channel text,
  channel_conversation_id uuid REFERENCES channel_conversation(id),
  external_channel_user_id text,
  property_id uuid,
  project_id uuid,
  consent_text_version text,
  consent_accepted_at timestamptz,
  crm_person_id text,
  crm_opportunity_id text,
  crm_person_url text,
  crm_opportunity_url text,
  crm_sync_status text NOT NULL DEFAULT 'pending',
  crm_last_synced_at timestamptz,
  lead_score integer,
  lead_score_band text,
  lead_score_reasons jsonb NOT NULL DEFAULT '[]',
  handoff_required boolean NOT NULL DEFAULT false,
  handoff_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE lead_score_event (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenant(id),
  lead_id uuid REFERENCES lead_capture(id),
  conversation_id uuid REFERENCES channel_conversation(id),
  score integer NOT NULL,
  band text NOT NULL,
  reason_codes jsonb NOT NULL DEFAULT '[]',
  recommended_action text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE human_handoff (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenant(id),
  lead_id uuid REFERENCES lead_capture(id),
  conversation_id uuid REFERENCES channel_conversation(id),
  status text NOT NULL DEFAULT 'open',
  reason text,
  assigned_user_id uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX lead_capture_score_idx ON lead_capture (tenant_id, lead_score_band, handoff_required, created_at);
CREATE INDEX human_handoff_status_idx ON human_handoff (tenant_id, status, created_at);

CREATE TABLE booking (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenant(id),
  lead_id uuid REFERENCES lead_capture(id),
  property_id uuid REFERENCES property_listing(id),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL,
  google_event_id text,
  crm_task_id text,
  crm_task_url text,
  crm_sync_status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE rag_document (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenant(id),
  source_type text NOT NULL,
  source_id uuid NOT NULL,
  source_version_id uuid NOT NULL,
  title text NOT NULL,
  language text,
  published_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE rag_chunk (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenant(id),
  document_id uuid NOT NULL REFERENCES rag_document(id),
  property_id uuid,
  project_id uuid,
  section text,
  content text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  embedding vector(1024),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX rag_chunk_embedding_hnsw_idx ON rag_chunk USING hnsw (embedding vector_cosine_ops);
CREATE INDEX rag_chunk_tenant_project_idx ON rag_chunk (tenant_id, project_id);
CREATE INDEX rag_chunk_tenant_property_idx ON rag_chunk (tenant_id, property_id);

CREATE TABLE integration_outbox (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenant(id),
  type text NOT NULL,
  idempotency_key text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  run_after timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, type, idempotency_key)
);

CREATE TABLE analytics_event (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenant(id),
  event_name text NOT NULL,
  anonymous_session_id text,
  lead_id uuid,
  property_id uuid,
  project_id uuid,
  properties jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenant(id),
  actor_user_id uuid,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  before_json jsonb,
  after_json jsonb,
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);
