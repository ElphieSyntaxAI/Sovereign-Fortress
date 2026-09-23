-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-08289e1a-20260923T172846Z-internal
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.msgf_source_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  entity_id TEXT,
  trace_id TEXT NOT NULL,
  pulse_beat_id UUID,
  decision_kind TEXT NOT NULL DEFAULT 'defend'
    CHECK (decision_kind IN ('defend', 'cross_ref', 'converge', 'local_gateway', 'arbitrate')),
  routing TEXT,
  logic_drift_score NUMERIC,
  defend_tier TEXT,
  defend_reason TEXT,
  sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  outcome TEXT NOT NULL DEFAULT 'unknown'
    CHECK (outcome IN ('pass', 'block', 'escalate', 'persist_vault', 'persist_hall', 'unknown')),
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS msgf_source_audit_events_tenant_trace_idx
  ON public.msgf_source_audit_events (tenant_id, trace_id);

CREATE INDEX IF NOT EXISTS msgf_source_audit_events_tenant_observed_idx
  ON public.msgf_source_audit_events (tenant_id, observed_at DESC);

COMMENT ON TABLE public.msgf_source_audit_events IS
  'P7 append-only source audit: which Vault/Hall/file hits influenced a Pulse decision (hashed chunks).';

CREATE TABLE IF NOT EXISTS public.msgf_resource_reputation (
  tenant_id TEXT NOT NULL,
  resource_key TEXT NOT NULL,
  ledger TEXT NOT NULL CHECK (ledger IN ('vault', 'hall', 'file')),
  resource_id UUID,
  file_path TEXT,
  good_count INTEGER NOT NULL DEFAULT 0 CHECK (good_count >= 0),
  bad_count INTEGER NOT NULL DEFAULT 0 CHECK (bad_count >= 0),
  high_drift_count INTEGER NOT NULL DEFAULT 0 CHECK (high_drift_count >= 0),
  last_drift_score NUMERIC,
  reputation_score NUMERIC NOT NULL DEFAULT 0,
  last_content_hash TEXT,
  last_seen_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, resource_key)
);

CREATE INDEX IF NOT EXISTS msgf_resource_reputation_tenant_score_idx
  ON public.msgf_resource_reputation (tenant_id, reputation_score);

COMMENT ON TABLE public.msgf_resource_reputation IS
  'P7 per-tenant resource reputation rollup (-1..1) for prune/boost on DEFEND.';

CREATE TABLE IF NOT EXISTS public.msgf_source_downstream_impact (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  audit_event_id UUID NOT NULL REFERENCES public.msgf_source_audit_events (id) ON DELETE CASCADE,
  trace_id TEXT NOT NULL,
  pulse_beat_id UUID,
  project_origin TEXT,
  resource_key TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  attribution_class TEXT NOT NULL DEFAULT 'unknown',
  file_path TEXT,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT msgf_source_downstream_impact_unique
    UNIQUE (tenant_id, audit_event_id, resource_key, content_hash)
);

CREATE INDEX IF NOT EXISTS msgf_source_downstream_impact_hash_idx
  ON public.msgf_source_downstream_impact (tenant_id, content_hash, observed_at DESC);

CREATE INDEX IF NOT EXISTS msgf_source_downstream_impact_resource_idx
  ON public.msgf_source_downstream_impact (tenant_id, resource_key, observed_at DESC);

CREATE INDEX IF NOT EXISTS msgf_source_downstream_impact_project_idx
  ON public.msgf_source_downstream_impact (tenant_id, project_origin, observed_at DESC)
  WHERE project_origin IS NOT NULL;

COMMENT ON TABLE public.msgf_source_downstream_impact IS
  'P7 inverted index: content_hash / resource_key → traces that cited that source.';

ALTER TABLE public.msgf_source_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.msgf_resource_reputation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.msgf_source_downstream_impact ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "msgf_source_audit_events_service_role_all" ON public.msgf_source_audit_events;
CREATE POLICY "msgf_source_audit_events_service_role_all"
  ON public.msgf_source_audit_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "msgf_resource_reputation_service_role_all" ON public.msgf_resource_reputation;
CREATE POLICY "msgf_resource_reputation_service_role_all"
  ON public.msgf_resource_reputation
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "msgf_source_downstream_impact_service_role_all" ON public.msgf_source_downstream_impact;
CREATE POLICY "msgf_source_downstream_impact_service_role_all"
  ON public.msgf_source_downstream_impact
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON public.msgf_source_audit_events FROM PUBLIC;
REVOKE ALL ON public.msgf_source_audit_events FROM anon;
REVOKE ALL ON public.msgf_source_audit_events FROM authenticated;
GRANT ALL ON public.msgf_source_audit_events TO service_role;

REVOKE ALL ON public.msgf_resource_reputation FROM PUBLIC;
REVOKE ALL ON public.msgf_resource_reputation FROM anon;
REVOKE ALL ON public.msgf_resource_reputation FROM authenticated;
GRANT ALL ON public.msgf_resource_reputation TO service_role;

REVOKE ALL ON public.msgf_source_downstream_impact FROM PUBLIC;
REVOKE ALL ON public.msgf_source_downstream_impact FROM anon;
REVOKE ALL ON public.msgf_source_downstream_impact FROM authenticated;
GRANT ALL ON public.msgf_source_downstream_impact TO service_role;
