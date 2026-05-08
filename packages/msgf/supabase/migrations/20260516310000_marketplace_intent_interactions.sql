-- Marketplace: publishing intent on manuscripts + anonymized agent/publisher interest signals.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'p4_publishing_intent' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.p4_publishing_intent AS ENUM ('TRADITIONAL', 'SELF', 'UNDECIDED');
  END IF;
END $$;

ALTER TABLE public.p4_manuscripts
  ADD COLUMN IF NOT EXISTS publishing_intent public.p4_publishing_intent NOT NULL DEFAULT 'UNDECIDED',
  ADD COLUMN IF NOT EXISTS is_seeking_agent BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.p4_manuscripts.publishing_intent IS
  'TRADITIONAL = trade path (hide Helper Hub). SELF = indie path (hide Publisher Hub). UNDECIDED = show both.';

COMMENT ON COLUMN public.p4_manuscripts.is_seeking_agent IS
  'Author opt-in for representation discovery in marketplace surfaces.';

-- ---------------------------------------------------------------------------
-- p4_marketplace_interactions: LIKE / TRACK from agents or publishers (opaque actor_id)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.p4_marketplace_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id TEXT NOT NULL,
  manuscript_id UUID NOT NULL REFERENCES public.p4_manuscripts (id) ON DELETE CASCADE,
  interaction_type TEXT NOT NULL CHECK (interaction_type IN ('LIKE', 'TRACK')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (actor_id, manuscript_id, interaction_type)
);

CREATE INDEX IF NOT EXISTS idx_p4_marketplace_interactions_manuscript
  ON public.p4_marketplace_interactions (manuscript_id, created_at DESC);

COMMENT ON TABLE public.p4_marketplace_interactions IS
  'Agent/Publisher interest without exposing identities to competitors; aggregate via get_marketplace_interest_metrics.';

ALTER TABLE public.p4_marketplace_interactions ENABLE ROW LEVEL SECURITY;

-- Authors (tenant) can read interactions for their manuscripts (for dashboards / metrics).
DROP POLICY IF EXISTS "p4_marketplace_interactions_select_tenant_manuscript" ON public.p4_marketplace_interactions;
CREATE POLICY "p4_marketplace_interactions_select_tenant_manuscript"
ON public.p4_marketplace_interactions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.p4_manuscripts m
    WHERE m.id = manuscript_id
      AND m.tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')
  )
);

-- Writes are expected from trusted services (service role). No INSERT policy for authenticated by default.

-- ---------------------------------------------------------------------------
-- Anonymized aggregate (no actor names returned)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_marketplace_interest_metrics(p_manuscript_id uuid)
RETURNS TABLE (
  total_interactions bigint,
  like_count bigint,
  track_count bigint,
  unique_interested_parties bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    COUNT(*)::bigint AS total_interactions,
    COUNT(*) FILTER (WHERE i.interaction_type = 'LIKE')::bigint AS like_count,
    COUNT(*) FILTER (WHERE i.interaction_type = 'TRACK')::bigint AS track_count,
    COUNT(DISTINCT i.actor_id)::bigint AS unique_interested_parties
  FROM public.p4_marketplace_interactions i
  WHERE i.manuscript_id = p_manuscript_id;
$$;

COMMENT ON FUNCTION public.get_marketplace_interest_metrics(uuid) IS
  'Returns counts only — never exposes actor_id values to callers (professional privacy).';

GRANT EXECUTE ON FUNCTION public.get_marketplace_interest_metrics(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_marketplace_interest_metrics(uuid) TO service_role;
