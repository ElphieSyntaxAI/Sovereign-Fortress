import type { OutlineLoreKind } from "./outlineLoreKinds";
import type { WikiFormTier } from "./wikiEntityForms";

export type WikiSheetDraft = {
  draftId: string;
  kind: OutlineLoreKind;
  title: string;
  /** @deprecated use formAnswers — kept for older local drafts */
  details?: string;
  formTier: WikiFormTier;
  formAnswers: Record<string, string>;
  plotPoint: string;
  spoilerLevel: string;
  genres: string;
  chunkId: string | null;
  savedAt: number;
};

export type HumanEffortClient = {
  started_at: string;
  last_edit_at: string;
  title_chars: number;
  body_chars: number;
  edit_events: Array<{ at: string; field: string; chars: number }>;
  client: "author-wiki-sheet";
};

export function draftsStorageKey(manuscriptId: string): string {
  return `elphie:wiki:drafts:${manuscriptId}`;
}

export function loadDraftsFromStorage(manuscriptId: string): WikiSheetDraft[] {
  try {
    const raw = localStorage.getItem(draftsStorageKey(manuscriptId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return (parsed as WikiSheetDraft[]).map((d) => ({
      ...d,
      formTier: d.formTier ?? "blank",
      formAnswers:
        d.formAnswers ?? (d.details ? { freeform: d.details } : {}),
    }));
  } catch {
    return [];
  }
}

export function persistDraftsToStorage(manuscriptId: string, drafts: WikiSheetDraft[]): void {
  try {
    localStorage.setItem(draftsStorageKey(manuscriptId), JSON.stringify(drafts));
  } catch {
    /* ignore quota */
  }
}
