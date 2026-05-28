"use client";

import { MsgfSentinel } from "msgf/ui";

type Props = {
  tenantKey: string;
  userId: string;
};

/**
 * Gated AI workspace FAB — unified POST /api/msgf/report-issue (incident + optional self-heal).
 */
export function WorkspaceMsgfSentinel({ tenantKey, userId }: Props) {
  return (
    <MsgfSentinel
      tenantConfig={{
        productLabel: "Gated AI",
        accentButtonClass: "bg-emerald-600 hover:bg-emerald-500",
        accentRingClass: "ring-emerald-500/40 focus:border-emerald-600 focus:ring-2",
        accentTextClass: "text-emerald-300/90",
        fabIconClass: "text-emerald-300 hover:text-emerald-200",
        fabBorderHoverClass: "hover:border-emerald-500/60",
      }}
      collectDiagnosticSnapshot={async () => ({
        captured_at: new Date().toISOString(),
        source: "gatedai_workspace",
        tenant_id: tenantKey,
        entity_id: userId,
        editor: {
          location_href:
            typeof window !== "undefined" ? window.location.href : "/workspace",
          tenant_id: tenantKey,
        },
        keystrokes_last_10: [],
        pillar_health: {},
      })}
      getAuthHeaders={async () => ({})}
    />
  );
}
