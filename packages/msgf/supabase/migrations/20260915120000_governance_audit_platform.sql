-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-fca2d532-20260923T201750Z-internal
-- =============================================================================
-- =============================================================================
-- Governance audit platform: resource usage, audit hub, prompt sessions,
-- model fitness, prompt templates, tenant budgets, SIEM config.
-- =============================================================================

-- Phase 1: resource usage events + cite rollup columns
CREATE TABLE IF NOT EXISTS public.msgf_resource_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  company_id TEXT,
  product TEXT NOT NULL DEFAULT 'msgf'
    CHECK (product IN ('msgf', 'author', 'educates', 'ide', 'gateway')),
  kind TEXT NOT NULL DEFAULT 'file'
    CHECK (kind IN ('vault', 'hall', 'file', 'tool', 'search', 'mcp', 'agent', 'citation', 'pack')),
  resource_key TEXT NOT NULL,
  content_hash TEXT,
  project_origin TEXT,
  trace_id TEXT,
  query_text_hash TEXT,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS msgf_resource_usage_events_tenant_observed_idx
  ON public.msgf_resource_usage_events (tenant_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS msgf_resource_usage_events_tenant_key_idx
  ON public.msgf_resource_usage_events (tenant_id, resource_key, observed_at DESC);
CREATE INDEX IF NOT EXISTS msgf_resource_usage_events_tenant_kind_idx
  ON public.msgf_resource_usage_events (tenant_id, kind, observed_at DESC);

ALTER TABLE public.msgf_resource_reputation
  ADD COLUMN IF NOT EXISTS cite_count INTEGER NOT NULL DEFAULT 0 CHECK (cite_count >= 0);
ALTER TABLE public.msgf_resource_reputation
  ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;

-- Widen reputation ledger kinds (drop old check if present, re-add)
ALTER TABLE public.msgf_resource_reputation DROP CONSTRAINT IF EXISTS msgf_resource_reputation_ledger_check;
ALTER TABLE public.msgf_resource_reputation
  ADD CONSTRAINT msgf_resource_reputation_ledger_check
  CHECK (ledger IN ('vault', 'hall', 'file', 'tool', 'search', 'mcp', 'agent', 'citation', 'pack'));

-- Phase 2: unified audit hub
CREATE TABLE IF NOT EXISTS public.platform_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product TEXT NOT NULL DEFAULT 'msgf',
  tenant_id TEXT NOT NULL,
  company_id TEXT,
  entity_id TEXT,
  kind TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info'
    CHECK (severity IN ('debug', 'info', 'warn', 'error', 'critical')),
  trace_id TEXT,
  ref_table TEXT,
  ref_id TEXT,
  summary TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS platform_audit_events_tenant_created_idx
  ON public.platform_audit_events (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS platform_audit_events_company_created_idx
  ON public.platform_audit_events (company_id, created_at DESC)
  WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS platform_audit_events_kind_idx
  ON public.platform_audit_events (tenant_id, kind, created_at DESC);
CREATE INDEX IF NOT EXISTS platform_audit_events_trace_idx
  ON public.platform_audit_events (trace_id)
  WHERE trace_id IS NOT NULL;

-- Phase 5: prompt sessions (canonical raw I/O + harm flags)
CREATE TABLE IF NOT EXISTS public.msgf_prompt_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  company_id TEXT,
  project_origin TEXT,
  trace_id TEXT NOT NULL,
  product TEXT NOT NULL DEFAULT 'msgf',
  system_prompt_version_hash TEXT,
  prompt_hash TEXT,
  prompt_text TEXT NOT NULL DEFAULT '',
  completion_text TEXT NOT NULL DEFAULT '',
  model_provider TEXT,
  model_id TEXT,
  tokens_in INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  retrieved_context_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  latency_ms INTEGER,
  harm_categories TEXT[] NOT NULL DEFAULT '{}',
  classifier_confidence NUMERIC,
  incident_id UUID,
  prev_hash TEXT,
  row_hash TEXT,
  signature TEXT
);

CREATE INDEX IF NOT EXISTS msgf_prompt_sessions_tenant_observed_idx
  ON public.msgf_prompt_sessions (tenant_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS msgf_prompt_sessions_tenant_trace_idx
  ON public.msgf_prompt_sessions (tenant_id, trace_id);
CREATE INDEX IF NOT EXISTS msgf_prompt_sessions_harm_idx
  ON public.msgf_prompt_sessions (tenant_id, observed_at DESC)
  WHERE cardinality(harm_categories) > 0;
CREATE INDEX IF NOT EXISTS msgf_prompt_sessions_prompt_fts_idx
  ON public.msgf_prompt_sessions
  USING gin (to_tsvector('english', coalesce(prompt_text, '') || ' ' || coalesce(completion_text, '')));

-- Phase 6: model fitness + prompt templates
CREATE TABLE IF NOT EXISTS public.msgf_model_fitness_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  product TEXT NOT NULL DEFAULT 'msgf',
  purpose TEXT,
  model_provider TEXT,
  model_id TEXT NOT NULL,
  prompt_class TEXT NOT NULL DEFAULT 'unknown',
  prompt_hash TEXT,
  label TEXT NOT NULL CHECK (label IN ('under_provisioned', 'over_provisioned', 'fit')),
  tokens_in INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  cost_usd_estimate NUMERIC,
  latency_ms INTEGER,
  logic_drift_score NUMERIC,
  escalated_from TEXT,
  escalated_to TEXT,
  trace_id TEXT,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS msgf_model_fitness_events_tenant_idx
  ON public.msgf_model_fitness_events (tenant_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS msgf_model_fitness_events_class_model_idx
  ON public.msgf_model_fitness_events (tenant_id, prompt_class, model_id, observed_at DESC);

CREATE TABLE IF NOT EXISTS public.msgf_model_fitness_rollup (
  scope_key TEXT NOT NULL,
  tenant_id TEXT,
  prompt_class TEXT NOT NULL,
  model_id TEXT NOT NULL,
  under_count INTEGER NOT NULL DEFAULT 0,
  over_count INTEGER NOT NULL DEFAULT 0,
  fit_count INTEGER NOT NULL DEFAULT 0,
  avg_cost_usd NUMERIC,
  sample_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (scope_key, prompt_class, model_id)
);

CREATE TABLE IF NOT EXISTS public.msgf_prompt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  prompt_hash TEXT NOT NULL,
  template_body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name, version)
);

CREATE INDEX IF NOT EXISTS msgf_prompt_templates_tenant_hash_idx
  ON public.msgf_prompt_templates (tenant_id, prompt_hash);

-- Phase 7: tenant budgets
CREATE TABLE IF NOT EXISTS public.msgf_tenant_budgets (
  tenant_id TEXT PRIMARY KEY,
  monthly_dollar_cap NUMERIC NOT NULL DEFAULT 0,
  current_month_spend NUMERIC NOT NULL DEFAULT 0,
  spend_month TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM'),
  max_session_tokens INTEGER NOT NULL DEFAULT 200000,
  rapid_retry_threshold INTEGER NOT NULL DEFAULT 10,
  budget_exceeded_action TEXT NOT NULL DEFAULT 'block'
    CHECK (budget_exceeded_action IN ('block', 'fallback_small_brain')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Phase 8: SIEM config
CREATE TABLE IF NOT EXISTS public.msgf_siem_integrations (
  tenant_id TEXT PRIMARY KEY,
  webhook_url TEXT NOT NULL,
  auth_secret_encrypted TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_export_at TIMESTAMPTZ,
  last_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: service_role only on all new tables
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'msgf_resource_usage_events',
    'platform_audit_events',
    'msgf_prompt_sessions',
    'msgf_model_fitness_events',
    'msgf_model_fitness_rollup',
    'msgf_prompt_templates',
    'msgf_tenant_budgets',
    'msgf_siem_integrations'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_service_role_all', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      t || '_service_role_all', t
    );
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM authenticated', t);
  END LOOP;
END $$;

COMMENT ON TABLE public.msgf_resource_usage_events IS
  'Phase 1 usage ledger; query_text_hash only — never raw search text.';
COMMENT ON TABLE public.platform_audit_events IS
  'Phase 2 unified audit hub across products.';
COMMENT ON TABLE public.msgf_prompt_sessions IS
  'Phase 5 Session Replay + harm flags; exempt from 30-day HAL purge.';
COMMENT ON TABLE public.msgf_tenant_budgets IS
  'Phase 7 hard dollar/token quotas and circuit-breaker knobs.';
COMMENT ON TABLE public.msgf_siem_integrations IS
  'Phase 8 per-tenant SIEM webhook config.';
