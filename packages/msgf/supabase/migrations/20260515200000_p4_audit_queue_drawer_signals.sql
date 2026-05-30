-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-48a02b8-20260530T050749Z-internal
-- =============================================================================
-- Slow-time audit queue + manuscript status + lightweight author "Drawer" signals.

-- ---------------------------------------------------------------------------
-- Extend revision_status for post-queue audit completion
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  ALTER TYPE public.p4_revision_status ADD VALUE 'AUDITING_COMPLETE';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- p4_audit_queue: nightly / batch consistency jobs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.p4_audit_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  manuscript_id UUID NOT NULL REFERENCES public.p4_manuscripts (id) ON DELETE CASCADE,
  /** Higher runs first within the same batch window. */
  priority INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (
    status IN ('PENDING', 'PROCESSING', 'COMPLETE', 'FAILED')
  ),
  /** Librarian output + metadata (see `AuditQueueProcessor` types in app). */
  comprehensive_report JSONB,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_p4_audit_queue_pending_prio
  ON public.p4_audit_queue (status, priority DESC, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_p4_audit_queue_tenant
  ON public.p4_audit_queue (tenant_id, created_at DESC);

COMMENT ON TABLE public.p4_audit_queue IS
  'Slow-time batch queue for comprehensive Librarian consistency reports per manuscript.';

ALTER TABLE public.p4_audit_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "p4_audit_queue_select_tenant" ON public.p4_audit_queue;
CREATE POLICY "p4_audit_queue_select_tenant"
ON public.p4_audit_queue
FOR SELECT
TO authenticated
USING (
  tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')
);

DROP POLICY IF EXISTS "p4_audit_queue_insert_tenant" ON public.p4_audit_queue;
CREATE POLICY "p4_audit_queue_insert_tenant"
ON public.p4_audit_queue
FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')
);

DROP POLICY IF EXISTS "p4_audit_queue_update_tenant" ON public.p4_audit_queue;
CREATE POLICY "p4_audit_queue_update_tenant"
ON public.p4_audit_queue
FOR UPDATE
TO authenticated
USING (
  tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')
)
WITH CHECK (
  tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')
);

-- ---------------------------------------------------------------------------
-- p4_author_signal: inbox / toast payloads (e.g. Drawer progress)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.p4_author_signal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  manuscript_id UUID REFERENCES public.p4_manuscripts (id) ON DELETE SET NULL,
  kind TEXT NOT NULL DEFAULT 'DRAWER_PROGRESS',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_p4_author_signal_tenant_unread
  ON public.p4_author_signal (tenant_id, read_at NULLS FIRST, created_at DESC);

COMMENT ON TABLE public.p4_author_signal IS
  'Author-facing signals (Drawer milestones, audit completion, etc.).';

ALTER TABLE public.p4_author_signal ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "p4_author_signal_select_tenant" ON public.p4_author_signal;
CREATE POLICY "p4_author_signal_select_tenant"
ON public.p4_author_signal
FOR SELECT
TO authenticated
USING (
  tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')
);

DROP POLICY IF EXISTS "p4_author_signal_insert_tenant" ON public.p4_author_signal;
CREATE POLICY "p4_author_signal_insert_tenant"
ON public.p4_author_signal
FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')
);

DROP POLICY IF EXISTS "p4_author_signal_update_tenant" ON public.p4_author_signal;
CREATE POLICY "p4_author_signal_update_tenant"
ON public.p4_author_signal
FOR UPDATE
TO authenticated
USING (
  tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')
)
WITH CHECK (
  tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')
);
