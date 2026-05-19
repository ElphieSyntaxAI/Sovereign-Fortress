-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-b4602b0-20260519T165710Z-internal
-- =============================================================================
-- MSG-F Core Framework Initialization
-- Table: Narrative Logs (The System's Memory)

CREATE TABLE IF NOT EXISTS public.p4_narrative_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    tenant_id TEXT NOT NULL,
    actor_id TEXT, 
    action_type TEXT,
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    severity TEXT CHECK (severity IN ('Info', 'Warning', 'Violation')) DEFAULT 'Info'
);

-- Indexing for performance
CREATE INDEX IF NOT EXISTS idx_logs_tenant_time ON public.p4_narrative_logs (tenant_id, created_at DESC);

-- Enable Security
ALTER TABLE public.p4_narrative_logs ENABLE ROW LEVEL SECURITY;
