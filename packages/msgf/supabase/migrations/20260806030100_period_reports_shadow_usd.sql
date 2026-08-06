-- Add shadow projected USD column if period reports table already existed without it.
ALTER TABLE public.msgf_period_savings_reports
  ADD COLUMN IF NOT EXISTS shadow_projected_usd DOUBLE PRECISION NOT NULL DEFAULT 0
  CHECK (shadow_projected_usd >= 0);
