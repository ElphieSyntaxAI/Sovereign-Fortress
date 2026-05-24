import { useCallback } from "react";

import type { DashboardMode, DashboardViewPayload } from "@elphie-syntax/ui/dashboard";
import { getPreferredBffBearer } from "../lib/authAccessToken";
import { bffAuthHeaders, bffCredentials, bffUrl } from "../lib/bffFetch";

export function useDashboardLoadView(manuscriptId: string) {
  return useCallback(
    async (mode: DashboardMode): Promise<DashboardViewPayload> => {
      const token = await getPreferredBffBearer();
      const u = new URL(bffUrl("/api/dashboard/view"), window.location.origin);
      u.searchParams.set("mode", mode);
      u.searchParams.set("manuscript_id", manuscriptId);
      const res = await fetch(u.toString(), {
        ...bffCredentials,
        headers: bffAuthHeaders(token),
      });
      const json: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err =
          json && typeof json === "object" && "error" in json && typeof (json as { error: unknown }).error === "string"
            ? (json as { error: string }).error
            : res.statusText;
        throw new Error(err);
      }
      return json as DashboardViewPayload;
    },
    [manuscriptId]
  );
}
