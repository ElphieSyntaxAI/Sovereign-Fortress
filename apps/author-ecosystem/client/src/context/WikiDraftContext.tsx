import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  loadDraftsFromStorage,
  persistDraftsToStorage,
  type WikiSheetDraft,
} from "../lib/wikiDraftStore";
import type { OutlineLoreKind } from "../lib/outlineLoreKinds";

type WikiDraftContextValue = {
  drafts: WikiSheetDraft[];
  upsertDraft: (draft: WikiSheetDraft) => void;
  removeDraft: (draftId: string) => void;
  clearAllDrafts: () => void;
  getDraft: (draftId: string) => WikiSheetDraft | undefined;
  findDraftByKind: (kind: OutlineLoreKind) => WikiSheetDraft | undefined;
};

const WikiDraftContext = createContext<WikiDraftContextValue | null>(null);

export function WikiDraftProvider(props: { manuscriptId: string; children: ReactNode }) {
  const [drafts, setDrafts] = useState<WikiSheetDraft[]>([]);

  useEffect(() => {
    setDrafts(loadDraftsFromStorage(props.manuscriptId));
  }, [props.manuscriptId]);

  useEffect(() => {
    persistDraftsToStorage(props.manuscriptId, drafts);
  }, [props.manuscriptId, drafts]);

  const upsertDraft = useCallback((draft: WikiSheetDraft) => {
    setDrafts((prev) => {
      const i = prev.findIndex((d) => d.draftId === draft.draftId);
      if (i < 0) return [...prev, draft];
      const next = [...prev];
      next[i] = draft;
      return next;
    });
  }, []);

  const removeDraft = useCallback((draftId: string) => {
    setDrafts((prev) => prev.filter((d) => d.draftId !== draftId));
  }, []);

  const clearAllDrafts = useCallback(() => {
    setDrafts([]);
  }, []);

  const getDraft = useCallback((draftId: string) => drafts.find((d) => d.draftId === draftId), [drafts]);

  const findDraftByKind = useCallback(
    (kind: OutlineLoreKind) => drafts.find((d) => d.kind === kind),
    [drafts]
  );

  const value = useMemo(
    () => ({ drafts, upsertDraft, removeDraft, clearAllDrafts, getDraft, findDraftByKind }),
    [drafts, upsertDraft, removeDraft, clearAllDrafts, getDraft, findDraftByKind]
  );

  return <WikiDraftContext.Provider value={value}>{props.children}</WikiDraftContext.Provider>;
}

export function useWikiDrafts(): WikiDraftContextValue {
  const ctx = useContext(WikiDraftContext);
  if (!ctx) throw new Error("useWikiDrafts must be used within WikiDraftProvider");
  return ctx;
}

export function useWikiDraftsOptional(): WikiDraftContextValue | null {
  return useContext(WikiDraftContext);
}
