import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { getPreferredBffBearer } from "../lib/authAccessToken";
import {
  readStoredManuscriptSelection,
  storeManuscriptSelection,
} from "../lib/activeManuscriptStorage";
import { bffAuthHeaders, bffCredentials, bffUrl } from "../lib/bffFetch";

export type NarrativeSelection = {
  manuscriptId: string;
  tenantId: string;
  /** Series folder id when the book belongs to a series; null for standalone. */
  seriesId?: string | null;
  /** Optional series title for nav display when known. */
  seriesTitle?: string | null;
  title?: string | null;
  revision_status?: string | null;
  cooldown_revision_status?: string | null;
  locked_until?: string | null;
  lock_expires_at?: string | null;
  revision_cooldown_until?: string | null;
};

type NarrativeContextValue = {
  selection: NarrativeSelection | null;
  setSelection: (next: NarrativeSelection | null) => void;
  clearSelection: () => void;
  /** True after first active-manuscript fetch attempt (localStorage may already have selection). */
  hydrated: boolean;
};

const NarrativeContext = createContext<NarrativeContextValue | null>(null);

export function NarrativeProvider({ children }: { children: ReactNode }) {
  const [selection, setSelectionState] = useState<NarrativeSelection | null>(() =>
    readStoredManuscriptSelection()
  );
  const [hydrated, setHydrated] = useState(false);

  const setSelection = useCallback((next: NarrativeSelection | null) => {
    setSelectionState(next);
    storeManuscriptSelection(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getPreferredBffBearer();
        const res = await fetch(bffUrl("/api/manuscripts/active"), {
          ...bffCredentials,
          headers: { ...bffAuthHeaders(token) },
        });
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as {
          manuscript?: {
            id: string;
            tenant_id: string;
            title?: string | null;
            series_id?: string | null;
            revision_status?: string | null;
            cooldown_revision_status?: string | null;
            locked_until?: string | null;
            lock_expires_at?: string | null;
            revision_cooldown_until?: string | null;
          } | null;
        };
        const m = json.manuscript;
        if (!m || cancelled) return;
        const fromApi: NarrativeSelection = {
          manuscriptId: m.id,
          tenantId: m.tenant_id,
          seriesId: m.series_id ?? null,
          title: m.title,
          revision_status: m.revision_status,
          cooldown_revision_status: m.cooldown_revision_status,
          locked_until: m.locked_until,
          lock_expires_at: m.lock_expires_at,
          revision_cooldown_until: m.revision_cooldown_until,
        };
        setSelectionState((prev) => {
          // Same active book: backfill seriesId / tenantId if older localStorage omitted them.
          if (prev?.manuscriptId === fromApi.manuscriptId) {
            const needsSeries = prev.seriesId === undefined;
            const needsTenant = !prev.tenantId;
            if (needsSeries || needsTenant) {
              const merged: NarrativeSelection = {
                ...prev,
                seriesId: needsSeries ? (fromApi.seriesId ?? null) : prev.seriesId,
                tenantId: prev.tenantId || fromApi.tenantId,
                title: prev.title ?? fromApi.title,
              };
              storeManuscriptSelection(merged);
              return merged;
            }
            return prev;
          }
          if (prev && prev.manuscriptId !== fromApi.manuscriptId) return prev;
          storeManuscriptSelection(fromApi);
          return fromApi;
        });
      } catch {
        /* offline / logged out */
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const clearSelection = useCallback(() => {
    setSelectionState(null);
    storeManuscriptSelection(null);
  }, []);

  const value = useMemo(
    () => ({ selection, setSelection, clearSelection, hydrated }),
    [selection, setSelection, clearSelection, hydrated]
  );

  return <NarrativeContext.Provider value={value}>{children}</NarrativeContext.Provider>;
}

export function useNarrative(): NarrativeContextValue {
  const ctx = useContext(NarrativeContext);
  if (!ctx) {
    throw new Error("useNarrative must be used within a NarrativeProvider");
  }
  return ctx;
}
