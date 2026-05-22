-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-e3b90d5-20260522T030006Z-internal
-- =============================================================================
-- Cold layer: pillar_vectors with OpenAI/Gemini text-embedding-3 / ada-class 1536 dims (not 768).

create extension if not exists vector;

create table if not exists public.pillar_vectors (
  id uuid primary key default gen_random_uuid(),
  content text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  embedding vector(1536),
  created_at timestamptz not null default now()
);

comment on column public.pillar_vectors.embedding is 'pgvector embedding; dimension 1536 (text-embedding-004 / 3-large style).';

-- Older deployments may already have pillar_vectors without embedding; add 1536 column only if missing.
alter table public.pillar_vectors
  add column if not exists embedding vector(1536);

-- Fast JSON containment / key paths for metadata->>instance, pillar, ledger (e.g. 1.1.1 lineage filters).
create index if not exists pillar_vectors_metadata_gin
  on public.pillar_vectors using gin (metadata jsonb_path_ops);
