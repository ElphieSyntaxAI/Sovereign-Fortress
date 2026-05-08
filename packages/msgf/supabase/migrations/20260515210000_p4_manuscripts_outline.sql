-- Optional high-level outline text on manuscript (Planning dashboard).

ALTER TABLE public.p4_manuscripts
  ADD COLUMN IF NOT EXISTS outline TEXT;

COMMENT ON COLUMN public.p4_manuscripts.outline IS
  'Author-maintained outline / beat sheet text for Planning mode (distinct from ingested plot chunks).';
