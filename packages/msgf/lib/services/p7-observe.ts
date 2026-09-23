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
 * Distribution Build ID: MSGF-1826a636-20260922T234439Z-internal
 */
/**
 * P7 observe / steer helpers — hashed resource keys only, no prompt text.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  REPUTATION_PRUNE_THRESHOLD,
  resourceKeyForFile,
  resourceKeyForMandateHash,
  resourceKeyForPack,
  resourceKeyForPromptHash,
  resourceKeyForVaultHall,
  type SourceHit,
} from "@/lib/schemas/source-audit";
import { preFlightCheck } from "@/lib/msgf-shadow";
import {
  applyReputationOutcome,
  loadReputationMap,
  p7AuditKeyLists,
  recordSourceAudit,
  uniqueResourceKeys,
} from "@/lib/services/source-audit";
import { hashOpaqueIdPrefix } from "@/lib/services/global-brain-swarm-telemetry";

export type P7DeferredHit = {
  resource_key: string;
  ledger: string;
  kind: SourceHit["kind"];
  outcome: "good" | "bad";
};

export type P7SteerHint = {
  prefer_small_brain: boolean;
  prefer_cache_or_pack: boolean;
  force_escalate: boolean;
};

export type P7ObserveResult = {
  promoteHits: SourceHit[];
  blockHits: SourceHit[];
  steer: P7SteerHint;
  deferred: P7DeferredHit[];
  lists: ReturnType<typeof p7AuditKeyLists>;
};

type SwarmTripLike = {
  identity: {
    agentId: string;
    parentAgentId?: string | null;
    mandateHash?: string | null;
  };
};

export function hitFromSwarmTrip(trip: SwarmTripLike): SourceHit {
  return {
    kind: "agent",
    ledger: "agent",
    resource_key: hashOpaqueIdPrefix(trip.identity.agentId),
    score: 0.2,
    attribution_class: "untrusted_external",
    pruned: true,
    label: "swarm_agent",
  };
}

export function hitFromMandate(mandateSha256: string | null | undefined): SourceHit | null {
  const raw = mandateSha256?.trim();
  if (!raw) return null;
  return {
    kind: "agent",
    ledger: "agent",
    resource_key: resourceKeyForMandateHash(raw),
    score: 0.2,
    attribution_class: "untrusted_external",
    pruned: true,
    label: "swarm_mandate",
  };
}

export function hitFromPromptHash(sha256: string | null | undefined): SourceHit | null {
  const raw = sha256?.trim();
  if (!raw) return null;
  return {
    kind: "prompt",
    ledger: "prompt",
    resource_key: resourceKeyForPromptHash(raw),
    score: 0.5,
    attribution_class: "unknown",
    content_hash: /^[0-9a-f]{64}$/i.test(raw) ? raw.toLowerCase() : undefined,
    label: "prompt_hash",
  };
}

export function hitFromVaultId(id: string, pruned = false): SourceHit {
  return {
    kind: "vault",
    ledger: "vault",
    resource_key: resourceKeyForVaultHall(id, "vault"),
    resource_id: id,
    score: 0.5,
    attribution_class: "unknown",
    pruned,
  };
}

export function hitFromHallId(id: string): SourceHit {
  return {
    kind: "hall",
    ledger: "hall",
    resource_key: resourceKeyForVaultHall(id, "hall"),
    resource_id: id,
    score: 0.8,
    attribution_class: "unknown",
    pruned: true,
  };
}

export function hitFromFilePath(filePath: string, pruned = false): SourceHit {
  return {
    kind: "file",
    ledger: "file",
    resource_key: resourceKeyForFile(filePath),
    file_path: filePath,
    score: 0.5,
    attribution_class: "unknown",
    pruned,
  };
}

export function hitFromPackId(packId: string, pruned = false): SourceHit {
  return {
    kind: "pack",
    ledger: "pack",
    resource_key: resourceKeyForPack(packId),
    score: 0.6,
    attribution_class: "unknown",
    pruned,
  };
}

/** Child agent + mandate only — never auto-bad the primary parent. */
export function swarmDetectedP7Hits(trip: SwarmTripLike): SourceHit[] {
  const hits: SourceHit[] = [hitFromSwarmTrip(trip)];
  const mandate = hitFromMandate(trip.identity.mandateHash);
  if (mandate) hits.push(mandate);
  return hits;
}

export function p7SteerHint(input: {
  promoteHits: SourceHit[];
  blockHits: SourceHit[];
  forceEscalate?: boolean;
}): P7SteerHint {
  const force_escalate = Boolean(input.forceEscalate);
  const prefer_small_brain = input.blockHits.length > 0 || force_escalate;
  return {
    prefer_small_brain,
    prefer_cache_or_pack: !prefer_small_brain && input.promoteHits.length > 0,
    force_escalate,
  };
}

function byKey(hits: SourceHit[]): SourceHit[] {
  const seen = new Set<string>();
  const out: SourceHit[] = [];
  for (const h of hits) {
    const k = h.resource_key?.trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(h);
  }
  return out;
}

export function toDeferredP7(hits: SourceHit[], outcome: "good" | "bad"): P7DeferredHit[] {
  return byKey(hits).map((h) => ({
    resource_key: h.resource_key,
    ledger: h.ledger ?? h.kind,
    kind: h.kind,
    outcome,
  }));
}

export function hitsFromDeferredP7(deferred: P7DeferredHit[]): {
  goodHits: SourceHit[];
  badHits: SourceHit[];
} {
  const goodHits: SourceHit[] = [];
  const badHits: SourceHit[] = [];
  for (const d of deferred) {
    if (!d?.resource_key) continue;
    const hit: SourceHit = {
      kind: (d.kind as SourceHit["kind"]) || "file",
      ledger: (d.ledger as SourceHit["ledger"]) || "file",
      resource_key: d.resource_key,
      score: 0.5,
      attribution_class: "unknown",
      pruned: d.outcome === "bad",
    };
    if (d.outcome === "good") goodHits.push(hit);
    else badHits.push(hit);
  }
  return { goodHits, badHits };
}

export async function observeP7ForPrompt(input: {
  admin?: SupabaseClient | null;
  tenantId: string;
  promptText: string;
  swarmTrip?: SwarmTripLike | null;
  promptHash?: string | null;
  policyDrift?: boolean;
}): Promise<P7ObserveResult> {
  let promoteHits: SourceHit[] = [];
  let blockHits: SourceHit[] = [];
  let forceEscalate = false;
  if (input.admin) {
    try {
      const preflight = await preFlightCheck(
        input.admin,
        { text: (input.promptText || "").slice(0, 12_000) || "(empty)" },
        { tenantId: input.tenantId }
      );
      promoteHits = [...(preflight.contextHits ?? [])];
      blockHits = [...(preflight.prunedHits ?? [])];
      if (preflight.blocked || preflight.tier === "RED") {
        if (preflight.hallMatch) {
          blockHits.push(hitFromHallId(preflight.hallMatch.id));
        }
        forceEscalate = true;
      }
    } catch (e) {
      console.warn("[p7-observe] preflight failed:", e instanceof Error ? e.message : e);
    }
  }

  if (input.swarmTrip) {
    blockHits.push(...swarmDetectedP7Hits(input.swarmTrip));
  }

  const promptHit = hitFromPromptHash(input.promptHash);
  if (promptHit) {
    if (input.policyDrift || input.swarmTrip) {
      blockHits.push({ ...promptHit, pruned: true, attribution_class: "untrusted_external" });
    } else {
      promoteHits.push(promptHit);
    }
  }

  promoteHits = byKey(promoteHits).filter(
    (h) => !blockHits.some((b) => b.resource_key === h.resource_key)
  );
  blockHits = byKey(blockHits);
  const steer = p7SteerHint({ promoteHits, blockHits, forceEscalate });
  return {
    promoteHits,
    blockHits,
    steer,
    deferred: [...toDeferredP7(promoteHits, "good"), ...toDeferredP7(blockHits, "bad")],
    lists: p7AuditKeyLists(promoteHits, blockHits),
  };
}

/** Real tenant silos only — never write reputation into a shared `system` bucket. */
export function isLiveP7Tenant(tenantId: string | null | undefined): boolean {
  const tid = tenantId?.trim().toLowerCase() ?? "";
  return tid.length > 0 && tid !== "system" && tid !== "global";
}

export function writeLiveP7(input: {
  admin: SupabaseClient;
  tenantId: string;
  entityId?: string | null;
  traceId: string;
  promoteHits?: SourceHit[];
  blockHits?: SourceHit[];
  outcome?: "pass" | "block" | "escalate" | "persist_vault" | "persist_hall" | "unknown";
  decisionKind?: "defend" | "cross_ref" | "converge" | "local_gateway" | "arbitrate";
  routing?: string | null;
  highDrift?: boolean;
  driftScore?: number | null;
  defendTier?: string | null;
  defendReason?: string | null;
}): void {
  const promoteHits = input.promoteHits ?? [];
  const blockHits = input.blockHits ?? [];
  const sources = byKey([...promoteHits, ...blockHits]);
  const tid = input.tenantId.trim();
  if (!isLiveP7Tenant(tid) || sources.length === 0) return;
  try {
    if (promoteHits.length) {
      applyReputationOutcome(input.admin, tid, promoteHits, { kind: "good" });
    }
    if (blockHits.length) {
      applyReputationOutcome(input.admin, tid, blockHits, {
        kind: "bad",
        highDrift: input.highDrift,
        driftScore: input.driftScore,
      });
    }
    recordSourceAudit(input.admin, {
      tenant_id: tid,
      entity_id: input.entityId ?? null,
      trace_id: input.traceId,
      decision_kind: input.decisionKind ?? "defend",
      routing: input.routing ?? null,
      defend_tier: input.defendTier ?? null,
      defend_reason: input.defendReason ?? null,
      sources,
      outcome: input.outcome ?? (blockHits.length ? "block" : "pass"),
    });
  } catch (e) {
    console.warn("[p7-observe] writeLiveP7 failed:", e instanceof Error ? e.message : e);
  }
}

export async function loadP7SteerForKeys(
  admin: SupabaseClient,
  tenantId: string,
  keys: string[]
): Promise<Map<string, number>> {
  return loadReputationMap(admin, tenantId, keys);
}

export function isP7PrunedScore(score: number | undefined | null): boolean {
  return typeof score === "number" && score < REPUTATION_PRUNE_THRESHOLD;
}

export async function applyDeferredShadowP7(
  admin: SupabaseClient,
  tenantId: string
): Promise<{ applied: number }> {
  const tid = tenantId.trim();
  if (!tid) return { applied: 0 };

  const { data, error } = await admin
    .from("msgf_shadow_evaluation_logs")
    .select("id, p7_deferred")
    .eq("tenant_id", tid)
    .is("p7_applied_at", null)
    .not("p7_deferred", "is", null)
    .limit(500);

  if (error) {
    console.warn("[p7-observe] load deferred failed:", error.message);
    return { applied: 0 };
  }

  const now = new Date().toISOString();
  let applied = 0;
  for (const row of data ?? []) {
    const id = row.id as number | string;
    const { data: claimed, error: claimErr } = await admin
      .from("msgf_shadow_evaluation_logs")
      .update({ p7_applied_at: now })
      .eq("id", id)
      .is("p7_applied_at", null)
      .select("id, p7_deferred")
      .maybeSingle();
    if (claimErr || !claimed) continue;

    const deferred = Array.isArray(claimed.p7_deferred)
      ? (claimed.p7_deferred as P7DeferredHit[])
      : [];
    const { goodHits, badHits } = hitsFromDeferredP7(deferred);
    if (goodHits.length) applyReputationOutcome(admin, tid, goodHits, { kind: "good" });
    if (badHits.length) applyReputationOutcome(admin, tid, badHits, { kind: "bad" });
    applied += 1;
  }
  return { applied };
}

export { uniqueResourceKeys, resourceKeyForFile, resourceKeyForPack, resourceKeyForPromptHash };
