import type { NarrativeSelection } from "../context/NarrativeContext";

export const ACTIVE_MANUSCRIPT_STORAGE_KEY = "elphie_active_manuscript_v1";

export function readStoredManuscriptSelection(): NarrativeSelection | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ACTIVE_MANUSCRIPT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NarrativeSelection;
    if (!parsed?.manuscriptId || !parsed?.tenantId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function storeManuscriptSelection(sel: NarrativeSelection | null): void {
  try {
    if (!sel) {
      localStorage.removeItem(ACTIVE_MANUSCRIPT_STORAGE_KEY);
      return;
    }
    localStorage.setItem(ACTIVE_MANUSCRIPT_STORAGE_KEY, JSON.stringify(sel));
  } catch {
    /* private mode */
  }
}
