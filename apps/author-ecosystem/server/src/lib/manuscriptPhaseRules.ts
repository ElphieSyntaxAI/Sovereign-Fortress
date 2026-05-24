export type ProjectPhase = "working" | "editing" | "finished";

export type ManuscriptPhaseRow = {
  project_phase: string;
  cooldown_revision_status?: string | null;
  revision_status?: string | null;
  revisions_completed_at?: string | null;
  wiki_revision_locked_at?: string | null;
  linked_at?: string | null;
};

export function parseProjectPhase(raw: unknown): ProjectPhase | null {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "working" || s === "editing" || s === "finished") return s;
  if (s === "idea") return "working";
  if (s === "wip") return "editing";
  return null;
}

/** Vault / tier revision cooldown is active (required to enter Editing). */
export function hasActiveRevisionCooldownLock(row: ManuscriptPhaseRow): boolean {
  if (row.cooldown_revision_status === "LOCKED") return true;
  if (row.revision_status === "LOCKED") return true;
  return false;
}

export function canMoveToEditing(row: ManuscriptPhaseRow): { ok: true } | { ok: false; error: string } {
  if (row.wiki_revision_locked_at) {
    return { ok: false, error: "Wiki is revision-locked. Request an admin unlock to change phase." };
  }
  if (!hasActiveRevisionCooldownLock(row)) {
    return {
      ok: false,
      error:
        "Start the revision cooldown lock first (Revision passes → complete reports and seal the vault) before moving to Editing.",
    };
  }
  return { ok: true };
}

export function canSetPhase(
  row: ManuscriptPhaseRow,
  next: ProjectPhase
): { ok: true } | { ok: false; error: string } {
  const current = parseProjectPhase(row.project_phase) ?? "working";

  if (next === "finished") {
    return {
      ok: false,
      error: "Use Finished revisions to complete a project — you cannot drag a card to Finished directly.",
    };
  }

  if (current === "finished" || row.wiki_revision_locked_at) {
    return { ok: false, error: "This project is finished and wiki-locked." };
  }

  if (next === "editing") {
    const gate = canMoveToEditing(row);
    if (!gate.ok) return gate;
  }

  if (current === "editing" && next === "working") {
    if (hasActiveRevisionCooldownLock(row)) {
      return {
        ok: false,
        error: "Release or complete the revision cooldown lock before moving back to Working.",
      };
    }
  }

  return { ok: true };
}

export function canFinishRevisions(row: ManuscriptPhaseRow): { ok: true } | { ok: false; error: string } {
  if (row.wiki_revision_locked_at) {
    return { ok: false, error: "Revisions are already finished and the wiki is locked." };
  }
  if (!row.revisions_completed_at) {
    return {
      ok: false,
      error:
        "Complete revision passes first: seal the vault cooldown and review Librarian + Critic reports, then try again.",
    };
  }
  const phase = parseProjectPhase(row.project_phase);
  if (phase === "finished") {
    return { ok: false, error: "Already marked finished." };
  }
  return { ok: true };
}
