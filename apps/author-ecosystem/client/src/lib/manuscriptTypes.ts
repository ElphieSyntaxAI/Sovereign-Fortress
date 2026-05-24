export type ProjectPhase = "working" | "editing" | "finished";

export type HubManuscript = {
  id: string;
  tenant_id: string;
  title: string | null;
  revision_status: string | null;
  updated_at: string | null;
  lock_expires_at?: string | null;
  revision_cooldown_until?: string | null;
  cooldown_revision_status?: string | null;
  locked_until?: string | null;
  cooldown_duration?: string | null;
  series_id: string | null;
  project_phase: ProjectPhase | string;
  google_doc_url: string | null;
  google_doc_id: string | null;
  hal_extension_enabled: boolean;
  linked_at: string | null;
  revisions_completed_at?: string | null;
  wiki_revision_locked_at?: string | null;
};

export type PhaseColumns = {
  working: HubManuscript[];
  editing: HubManuscript[];
  finished: HubManuscript[];
};

export type ManuscriptHubPayload = {
  unlinked: HubManuscript[];
  standalone: PhaseColumns;
  series: { series: { id: string; title: string }; columns: PhaseColumns }[];
};

export function normalizePhase(raw: string | null | undefined): ProjectPhase {
  const s = String(raw ?? "working").toLowerCase();
  if (s === "editing" || s === "wip") return "editing";
  if (s === "finished") return "finished";
  return "working";
}

export function hubRowToSelection(row: HubManuscript): import("../context/NarrativeContext").NarrativeSelection {
  return {
    manuscriptId: row.id,
    tenantId: row.tenant_id,
    title: row.title,
    revision_status: row.revision_status,
    cooldown_revision_status: row.cooldown_revision_status,
    locked_until: row.locked_until,
    lock_expires_at: row.lock_expires_at,
    revision_cooldown_until: row.revision_cooldown_until,
  };
}

export function displayTitle(row: { title?: string | null; id: string }): string {
  const t = row.title?.trim();
  return t || `Untitled (${row.id.slice(0, 8)}…)`;
}

export function hasRevisionCooldownLock(row: HubManuscript): boolean {
  return row.cooldown_revision_status === "LOCKED" || row.revision_status === "LOCKED";
}
