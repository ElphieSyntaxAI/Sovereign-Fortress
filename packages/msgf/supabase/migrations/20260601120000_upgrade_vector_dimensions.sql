-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-2b663b7-20260519T155850Z-internal
-- =============================================================================
-- V3.2-ULTRA: normalize all pgvector columns to vector(1536) (OpenAI / Gemini class).
--
-- Safe for databases where pillar_vectors was created before 20260506200000 with
-- vector(768), or where msgf_legacy_rag_chunks still uses 768-dim Gemini embeddings.
--
-- RLS policies, triggers, and foreign keys are unchanged (ALTER COLUMN TYPE only).
-- HNSW indexes on embedding columns are dropped and recreated after the type change.
-- Rows with incompatible dimensions are set to NULL (re-embed via ingest / Librarian).

CREATE EXTENSION IF NOT EXISTS vector;

-- ---------------------------------------------------------------------------
-- Helper: upgrade one vector column to 1536 when it is not already
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.msgf_upgrade_vector_column_to_1536(
  p_schema text,
  p_table text,
  p_column text,
  p_recreate_hnsw boolean DEFAULT false,
  p_hnsw_index_name text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_rel regclass;
  v_type text;
  v_is_nullable boolean;
  v_idx record;
  v_index_name text;
BEGIN
  v_rel := to_regclass(format('%I.%I', p_schema, p_table));
  IF v_rel IS NULL THEN
    RAISE NOTICE 'msgf_upgrade_vector_column_to_1536: skip missing %.%', p_schema, p_table;
    RETURN;
  END IF;

  SELECT format_type(a.atttypid, a.atttypmod), NOT a.attnotnull
  INTO v_type, v_is_nullable
  FROM pg_attribute a
  WHERE a.attrelid = v_rel
    AND a.attname = p_column
    AND a.attnum > 0
    AND NOT a.attisdropped;

  IF v_type IS NULL THEN
    RAISE NOTICE 'msgf_upgrade_vector_column_to_1536: skip %.% (no column %)', p_schema, p_table, p_column;
    RETURN;
  END IF;

  IF v_type = 'vector(1536)' THEN
    RAISE NOTICE 'msgf_upgrade_vector_column_to_1536: %.% already vector(1536)', p_table, p_column;
    RETURN;
  END IF;

  IF v_type NOT IN ('vector', 'vector(768)') THEN
    RAISE NOTICE 'msgf_upgrade_vector_column_to_1536: %.%.% is % — not auto-migrated',
      p_schema, p_table, p_column, v_type;
    RETURN;
  END IF;

  -- Drop HNSW / ivfflat indexes that reference this column.
  FOR v_idx IN
    SELECT indexname AS index_name
    FROM pg_indexes
    WHERE schemaname = p_schema
      AND tablename = p_table
      AND indexdef ILIKE '%' || p_column || '%'
      AND (
        indexdef ILIKE '% USING hnsw %'
        OR indexdef ILIKE '% USING ivfflat %'
      )
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS %I.%I', p_schema, v_idx.index_name);
    RAISE NOTICE 'msgf_upgrade_vector_column_to_1536: dropped index % on %.%',
      v_idx.index_name, p_table, p_column;
  END LOOP;

  -- Known named HNSW indexes (idempotent drop if dynamic scan missed them).
  IF p_hnsw_index_name IS NOT NULL THEN
    EXECUTE format('DROP INDEX IF EXISTS %I.%I', p_schema, p_hnsw_index_name);
  END IF;

  -- Relax NOT NULL so legacy 768 rows can be nulled during cast (FKs unchanged).
  IF NOT v_is_nullable THEN
    EXECUTE format(
      'ALTER TABLE %I.%I ALTER COLUMN %I DROP NOT NULL',
      p_schema, p_table, p_column
    );
  END IF;

  EXECUTE format(
    $sql$
      ALTER TABLE %I.%I
        ALTER COLUMN %I TYPE vector(1536)
        USING (
          CASE
            WHEN %I IS NULL THEN NULL::vector(1536)
            WHEN vector_dims(%I) = 1536 THEN %I::vector(1536)
            ELSE NULL::vector(1536)
          END
        )
    $sql$,
    p_schema, p_table, p_column,
    p_column, p_column, p_column
  );

  EXECUTE format(
    'COMMENT ON COLUMN %I.%I.%I IS %L',
    p_schema,
    p_table,
    p_column,
    'pgvector embedding; dimension 1536 (text-embedding-3-small / OpenAI-Gemini class). Legacy 768-dim rows were cleared — re-embed to backfill.'
  );

  IF p_recreate_hnsw AND p_hnsw_index_name IS NOT NULL THEN
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %I.%I USING hnsw (%I vector_cosine_ops)',
      p_hnsw_index_name,
      p_schema,
      p_table,
      p_column
    );
  END IF;

  RAISE NOTICE 'msgf_upgrade_vector_column_to_1536: upgraded %.% from % to vector(1536)',
    p_table, p_column, v_type;
END;
$$;

COMMENT ON FUNCTION public.msgf_upgrade_vector_column_to_1536(text, text, text, boolean, text) IS
  'Idempotent pgvector dimension upgrade to 1536; drops/recreates HNSW when requested.';

-- ---------------------------------------------------------------------------
-- Primary cold-layer tables (Vault / Hall / sandbox)
-- ---------------------------------------------------------------------------
SELECT public.msgf_upgrade_vector_column_to_1536('public', 'pillar_vectors', 'embedding', false, NULL);

SELECT public.msgf_upgrade_vector_column_to_1536('public', 'msgf_sandbox', 'embedding', false, NULL);

-- Optional HNSW for dense Vault/Hall search (no-op if column missing or already indexed).
CREATE INDEX IF NOT EXISTS idx_pillar_vectors_embedding_hnsw
  ON public.pillar_vectors USING hnsw (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_msgf_sandbox_embedding_hnsw
  ON public.msgf_sandbox USING hnsw (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Legacy Express RAG (was vector(768) NOT NULL in 20260516900000)
-- ---------------------------------------------------------------------------
SELECT public.msgf_upgrade_vector_column_to_1536(
  'public',
  'msgf_legacy_rag_chunks',
  'embedding',
  true,
  'idx_msgf_legacy_rag_chunks_embedding_hnsw'
);

COMMENT ON TABLE public.msgf_legacy_rag_chunks IS
  'Legacy Librarian RAG chunks (1536-dim after upgrade). Prefer p4_narrative_library_chunks for the TypeScript BFF ingest path. Re-embed legacy rows cleared during migration.';

-- ---------------------------------------------------------------------------
-- Catch-all: any remaining public vector(768) columns (e.g. pre-migration drift)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT
      n.nspname AS schema_name,
      c.relname AS table_name,
      a.attname AS column_name
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND a.attnum > 0
      AND NOT a.attisdropped
      AND format_type(a.atttypid, a.atttypmod) = 'vector(768)'
      AND NOT (
        c.relname = 'pillar_vectors' AND a.attname = 'embedding'
      )
      AND NOT (
        c.relname = 'msgf_sandbox' AND a.attname = 'embedding'
      )
      AND NOT (
        c.relname = 'msgf_legacy_rag_chunks' AND a.attname = 'embedding'
      )
  LOOP
    PERFORM public.msgf_upgrade_vector_column_to_1536(
      r.schema_name,
      r.table_name,
      r.column_name,
      false,
      NULL
    );
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- Re-assert 1536 comments on tables already defined at 1536 (documentation only)
-- ---------------------------------------------------------------------------
COMMENT ON COLUMN public.pillar_vectors.embedding IS
  'pgvector embedding; dimension 1536 (text-embedding-3-small / OpenAI-Gemini class).';

COMMENT ON COLUMN public.msgf_sandbox.embedding IS
  'pgvector embedding; dimension 1536; DEV_TEST cold layer mirror of pillar_vectors.';

COMMENT ON COLUMN public.p4_narrative_library_chunks.embedding IS
  'pgvector embedding; dimension 1536 (Librarian semantic search).';
