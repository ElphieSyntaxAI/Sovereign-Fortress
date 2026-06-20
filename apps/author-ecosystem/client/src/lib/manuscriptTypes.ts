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
  companion_google_docs?: Array<{
    google_doc_id: string;
    google_doc_url: string;
    google_doc_title?: string;
  }>;
  hal_extension_enabled: boolean;
  linked_at: string | null;
  revisions_completed_at?: string | null;
  wiki_revision_locked_at?: string | null;
};

/** HAL-linked on manuscript row (link session confirm or google-doc/connect). */
export function isManuscriptGoogleLinked(row: {
  linked_at?: string | null;
  google_doc_id?: string | null;
  hal_extension_enabled?: boolean;
}): boolean {
  if (row.linked_at) return true;
  return Boolean(row.google_doc_id && row.hal_extension_enabled);
}

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

export function displayTitle(row: { title?: string | null; id: string }): string {
  const t = row.title?.trim();
  return t || `Untitled (${row.id.slice(0, 8)}…)`;
}

export function hasRevisionCooldownLock(row: HubManuscript): boolean {
  const until = row.revision_cooldown_until ?? row.locked_until;
  if (!until) return false;
  return new Date(until).getTime() > Date.now();
}

export function hubRowToSelection(row: HubManuscript) {
  return {
    manuscriptId: row.id,
    title: row.title,
    projectPhase: normalizePhase(row.project_phase),
  };
}

/** Locate a manuscript row anywhere in the hub payload (linked or unlinked). */
export function findHubManuscript(
  hub: ManuscriptHubPayload,
  manuscriptId: string
): HubManuscript | null {
  const buckets = [
    ...hub.unlinked,
    ...hub.standalone.working,
    ...hub.standalone.editing,
    ...hub.standalone.finished,
    ...hub.series.flatMap(({ columns }) => [
      ...columns.working,
      ...columns.editing,
      ...columns.finished,
    ]),
  ];
  return buckets.find((row) => row.id === manuscriptId) ?? null;
}
