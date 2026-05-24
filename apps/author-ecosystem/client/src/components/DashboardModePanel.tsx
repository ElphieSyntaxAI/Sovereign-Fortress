import { useMemo } from "react";
import { DashboardRouter, type DashboardMode } from "@elphie-syntax/ui/dashboard";

import { useDashboardLoadView } from "../hooks/useDashboardLoadView";
import { getSupabaseBrowserClient } from "../lib/supabaseBrowser";

export function DashboardModePanel({
  manuscriptId,
  tenantId,
  mode,
}: {
  manuscriptId: string;
  tenantId: string;
  mode: DashboardMode;
}) {
  const loadView = useDashboardLoadView(manuscriptId);
  const supabase = useMemo(() => {
    const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
    if (!url?.trim() || !key?.trim()) return null;
    return getSupabaseBrowserClient();
  }, []);

  if (!supabase) {
    return (
      <p className="text-sm text-amber-300/90">
        Set <code className="text-amber-200">VITE_SUPABASE_URL</code> and{" "}
        <code className="text-amber-200">VITE_SUPABASE_ANON_KEY</code> for live dashboard data.
      </p>
    );
  }

  return (
    <DashboardRouter
      supabase={supabase}
      manuscriptId={manuscriptId}
      tenantId={tenantId}
      loadView={loadView}
      initialMode={mode}
      className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3"
    />
  );
}
