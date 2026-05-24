-- Series folders + manuscript project hub (idea / wip / finished, Google Doc link, HAL flag).

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'p4_project_phase' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.p4_project_phase AS ENUM ('idea', 'wip', 'finished');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.p4_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_p4_series_tenant_updated
  ON public.p4_series (tenant_id, updated_at DESC);

COMMENT ON TABLE public.p4_series IS
  'Author-defined series folders; manuscripts with series_id belong to the folder kanban.';

ALTER TABLE public.p4_series ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "p4_series_select_tenant" ON public.p4_series;
CREATE POLICY "p4_series_select_tenant"
ON public.p4_series FOR SELECT TO authenticated
USING (tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id'));

DROP POLICY IF EXISTS "p4_series_insert_tenant" ON public.p4_series;
CREATE POLICY "p4_series_insert_tenant"
ON public.p4_series FOR INSERT TO authenticated
WITH CHECK (tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id'));

DROP POLICY IF EXISTS "p4_series_update_tenant" ON public.p4_series;
CREATE POLICY "p4_series_update_tenant"
ON public.p4_series FOR UPDATE TO authenticated
USING (tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id'))
WITH CHECK (tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id'));

DROP POLICY IF EXISTS "p4_series_delete_tenant" ON public.p4_series;
CREATE POLICY "p4_series_delete_tenant"
ON public.p4_series FOR DELETE TO authenticated
USING (tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id'));

ALTER TABLE public.p4_manuscripts
  ADD COLUMN IF NOT EXISTS series_id UUID REFERENCES public.p4_series (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS project_phase public.p4_project_phase NOT NULL DEFAULT 'idea',
  ADD COLUMN IF NOT EXISTS google_doc_url TEXT,
  ADD COLUMN IF NOT EXISTS google_doc_id TEXT,
  ADD COLUMN IF NOT EXISTS hal_extension_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS linked_at TIMESTAMPTZ;

COMMENT ON COLUMN public.p4_manuscripts.project_phase IS
  'Author hub column: idea | wip | finished (kanban on Manuscripts page).';
COMMENT ON COLUMN public.p4_manuscripts.linked_at IS
  'Set when Google Doc is linked; manuscript appears in Current projects boards.';

CREATE INDEX IF NOT EXISTS idx_p4_manuscripts_series_phase
  ON public.p4_manuscripts (tenant_id, series_id, project_phase)
  WHERE linked_at IS NOT NULL;
