import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type NarrativeSelection = {
  manuscriptId: string;
  tenantId: string;
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
};

const NarrativeContext = createContext<NarrativeContextValue | null>(null);

export function NarrativeProvider({ children }: { children: ReactNode }) {
  const [selection, setSelectionState] = useState<NarrativeSelection | null>(null);

  const setSelection = useCallback((next: NarrativeSelection | null) => {
    setSelectionState(next);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectionState(null);
  }, []);

  const value = useMemo(
    () => ({ selection, setSelection, clearSelection }),
    [selection, setSelection, clearSelection]
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
