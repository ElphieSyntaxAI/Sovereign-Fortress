-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-ee924ab-20260518T235305Z-internal
-- =============================================================================
-- Sovereign NDA / engagement receipts: dual digital signatures + manuscript integrity hashes.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'p4_legal_contract_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.p4_legal_contract_status AS ENUM (
      'PENDING_AUTHOR',
      'PENDING_HELPER',
      'FULLY_EXECUTED'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.p4_legal_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  manuscript_id UUID NOT NULL REFERENCES public.p4_manuscripts (id) ON DELETE CASCADE,
  helper_id UUID NOT NULL REFERENCES public.p4_helpers (id) ON DELETE CASCADE,
  contract_kind TEXT NOT NULL DEFAULT 'SOVEREIGN_NDA',
  template_version TEXT NOT NULL DEFAULT 'sovereign-nda.v1',
  nda_body_snapshot TEXT NOT NULL DEFAULT '',
  status public.p4_legal_contract_status NOT NULL DEFAULT 'PENDING_AUTHOR',
  author_signed_at TIMESTAMPTZ,
  author_signer_ip TEXT,
  author_manuscript_sha256 TEXT,
  helper_signed_at TIMESTAMPTZ,
  helper_signer_ip TEXT,
  helper_manuscript_sha256 TEXT,
  executed_at TIMESTAMPTZ,
  author_notify_email TEXT,
  helper_notify_email TEXT,
  receipt_pdf_sha256 TEXT,
  email_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (manuscript_id, helper_id)
);

CREATE INDEX IF NOT EXISTS idx_p4_legal_contracts_manuscript_helper
  ON public.p4_legal_contracts (manuscript_id, helper_id, status);

COMMENT ON TABLE public.p4_legal_contracts IS
  'Sovereign NDA + engagement receipt: dual click-sign with IP, timestamps, manuscript SHA-256 per party; gates editor forensic APIs.';

ALTER TABLE public.p4_legal_contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "p4_legal_contracts_select_tenant" ON public.p4_legal_contracts;
CREATE POLICY "p4_legal_contracts_select_tenant"
ON public.p4_legal_contracts
FOR SELECT
TO authenticated
USING (tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id'));

DROP POLICY IF EXISTS "p4_legal_contracts_insert_tenant" ON public.p4_legal_contracts;
CREATE POLICY "p4_legal_contracts_insert_tenant"
ON public.p4_legal_contracts
FOR INSERT
TO authenticated
WITH CHECK (tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id'));

DROP POLICY IF EXISTS "p4_legal_contracts_update_tenant" ON public.p4_legal_contracts;
CREATE POLICY "p4_legal_contracts_update_tenant"
ON public.p4_legal_contracts
FOR UPDATE
TO authenticated
USING (tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id'))
WITH CHECK (tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id'));
