/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * This source code and associated documentation are the exclusive property of
 * Elphie Syntax LLC. Unauthorized copying, distribution, publication, or
 * reverse-engineering — including decompilation, disassembly, or derivative
 * works — is strictly prohibited without prior written consent.
 *
 * Distribution Build ID: MSGF-191e80fa-20260921T055901Z-internal
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { appendVaultLog } from "@/lib/services/tenant-onboarding-vault";
import type { ConvergeTier, TierConvergeAttempt } from "@/lib/services/converge-tier/types";

export type TierQuarantineParams = {
  tenantId: string;
  companyId?: string | null;
  projectOrigin?: string | null;
  paths?: string[];
  /** Prefer these Vault vector IDs (e.g. lineage hits from this pulse). */
  vectorIds?: string[];
  finalTier: ConvergeTier;
  attempts?: TierConvergeAttempt[];
  pulseTraceId?: string | null;
  entityId?: string | null;
};

export type TierQuarantineResult = {
  quarantined: boolean;
  vectorIds: string[];
  reason: string;
};

export type VaultTierCandidate = {
  id: string;
  content?: string | null;
  quarantine_status?: string | null;
  metadata?: Record<string, unknown> | null;
};

function normalizePath(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\.\/+/, "").toLowerCase();
}

/** True when candidate file_path overlaps any delta path (suffix / basename). */
export function pathsOverlap(candidatePath: string, deltaPaths: string[]): boolean {
  if (!deltaPaths.length) return false;
  const c = normalizePath(candidatePath);
  if (!c) return false;
  for (const raw of deltaPaths) {
    const d = normalizePath(raw);
    if (!d) continue;
    if (c === d || c.endsWith(`/${d}`) || d.endsWith(`/${c}`)) return true;
    const cBase = c.split("/").pop() ?? c;
    const dBase = d.split("/").pop() ?? d;
    if (cBase && cBase === dBase) return true;
  }
  return false;
}

/**
 * Prefer explicit vectorIds; else path-overlap against eligible Vault rows.
 * Caps at 20 ids.
 */
export function pickVaultIdsForTierQuarantine(
  candidates: VaultTierCandidate[],
  params: { vectorIds?: string[]; paths?: string[] }
): string[] {
  const explicit = (params.vectorIds ?? []).map((id) => id.trim()).filter(Boolean);
  if (explicit.length) {
    return [...new Set(explicit)].slice(0, 20);
  }

  const paths = params.paths ?? [];
  const picked: string[] = [];
  for (const row of candidates) {
    const status = (row.quarantine_status ?? "NONE").trim();
    if (status === "QUARANTINED" || status === "DEMOTED_HALL") continue;
    const meta = row.metadata ?? {};
    const filePath =
      typeof meta.file_path === "string"
        ? meta.file_path
        : typeof meta.path === "string"
          ? meta.path
          : "";
    if (paths.length && filePath && !pathsOverlap(filePath, paths)) continue;
    if (!paths.length && !filePath) {
      // No path filter — take scoped vault sample as poison candidates
      picked.push(row.id);
    } else if (filePath || !paths.length) {
      picked.push(row.id);
    }
    if (picked.length >= 20) break;
  }
  return [...new Set(picked)];
}

async function loadVaultCandidates(
  admin: SupabaseClient,
  params: TierQuarantineParams
): Promise<VaultTierCandidate[]> {
  let query = admin
    .from("pillar_vectors")
    .select("id, content, metadata, quarantine_status")
    .eq("metadata->>ledger", "vault")
    .or("quarantine_status.is.null,quarantine_status.eq.NONE,quarantine_status.eq.RESTORED")
    .limit(80);

  if (params.companyId?.trim()) {
    query = query.eq("metadata->>company_id", params.companyId.trim()) as typeof query;
  }
  if (params.projectOrigin?.trim()) {
    query = query.eq("metadata->>project_origin", params.projectOrigin.trim()) as typeof query;
  } else if (params.tenantId?.trim()) {
    query = query.eq("metadata->>tenant_id", params.tenantId.trim()) as typeof query;
  }

  const { data, error } = await query;
  if (error) {
    console.warn("[tier-quarantine] candidate load failed:", error.message);
    return [];
  }
  return (data ?? []) as VaultTierCandidate[];
}

/**
 * Mark matching Vault wins QUARANTINED after T3 dual-CONVERGE disagreement.
 * Never demotes to Hall — ops HITL on /admin/ops (A3).
 */
export async function quarantineVaultFromTierDisagreement(
  admin: SupabaseClient,
  params: TierQuarantineParams
): Promise<TierQuarantineResult> {
  if (params.finalTier !== "TIER_3") {
    return { quarantined: false, vectorIds: [], reason: "not_tier_3" };
  }

  const candidates =
    params.vectorIds?.length && params.vectorIds.every((id) => id.trim())
      ? params.vectorIds.map((id) => ({ id: id.trim() }))
      : await loadVaultCandidates(admin, params);

  const ids = pickVaultIdsForTierQuarantine(candidates, {
    vectorIds: params.vectorIds,
    paths: params.paths,
  });

  if (!ids.length) {
    return { quarantined: false, vectorIds: [], reason: "no_candidates" };
  }

  const now = new Date().toISOString();
  const reason =
    `T3 dual-CONVERGE disagreement (HITL). trace=${params.pulseTraceId ?? "n/a"}`.slice(0, 500);

  const { error } = await admin
    .from("pillar_vectors")
    .update({
      quarantine_status: "QUARANTINED",
      quarantine_reason: reason,
      quarantine_sentry_issue_id: null,
      quarantine_at: now,
    })
    .in("id", ids);

  if (error) {
    console.warn("[tier-quarantine] update failed:", error.message);
    return {
      quarantined: false,
      vectorIds: ids,
      reason: `update_failed:${error.message}`,
    };
  }

  if (params.companyId?.trim()) {
    try {
      await appendVaultLog(admin, params.companyId.trim(), "converge_tier_vault_quarantine", {
        vector_ids: ids,
        final_tier: params.finalTier,
        paths: params.paths ?? [],
        project_origin: params.projectOrigin ?? null,
        tenant_id: params.tenantId,
        entity_id: params.entityId ?? null,
        pulse_trace_id: params.pulseTraceId ?? null,
        attempts: (params.attempts ?? []).map((a) => ({
          tier: a.tier,
          agreement_score: a.agreementScore,
          agreed: a.agreed,
        })),
        note: "Quarantined pending HITL on /admin/ops (no auto-Hall).",
      });
    } catch (e) {
      console.warn("[tier-quarantine] ops alert log failed:", e);
    }
  }

  return { quarantined: true, vectorIds: ids, reason: "quarantined" };
}
