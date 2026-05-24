import { useCallback } from "react";

import type { NarrativeSelection } from "../context/NarrativeContext";
import { useNarrative } from "../context/NarrativeContext";
import { getPreferredBffBearer } from "../lib/authAccessToken";
import { storeManuscriptSelection } from "../lib/activeManuscriptStorage";
import { bffAuthHeaders, bffCredentials, bffUrl } from "../lib/bffFetch";

/** Persist selection, bump active manuscript on BFF (RLS scope for HAL / extension). */
export function useActivateManuscript() {
  const { setSelection } = useNarrative();

  return useCallback(
    async (next: NarrativeSelection) => {
      setSelection(next);
      storeManuscriptSelection(next);
      try {
        const token = await getPreferredBffBearer();
        await fetch(bffUrl(`/api/manuscripts/${encodeURIComponent(next.manuscriptId)}/touch`), {
          method: "POST",
          ...bffCredentials,
          headers: { ...bffAuthHeaders(token) },
        });
      } catch {
        /* non-fatal */
      }
    },
    [setSelection]
  );
}
