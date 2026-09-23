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
import type { SupabaseClient } from "@supabase/supabase-js";
import type { KeystrokeEvent } from "@/lib/P4";
import { fromPillarVectors } from "@/lib/msgf-pillar-table";
import { normalizeTenantId } from "@/lib/services/msgf-metadata-scope";
import {
  filterPillarRowsByTenant,
  resolveTenantIdForQuery,
} from "@/lib/services/tenant-query-scope";
import { filterVaultRowsForRetrieval } from "@/lib/services/vault-quarantine";
import type { SourceHit } from "@/lib/schemas/source-audit";
import {
  applyReputationToHits,
  hitFromLedgerRow,
  loadReputationMap,
} from "@/lib/services/source-audit";

export type ShadowTier = "GREEN" | "YELLOW" | "RED";

export interface ShadowPulse {
  text: string;
  keystrokes?: KeystrokeEvent[];
  contextTag?: string;
}

interface LedgerRow {
  id: string;
  content: string;
  metadata: Record<string, unknown> | null;
}

export interface ShadowPreflightResult {
  tier: ShadowTier;
  blocked: boolean;
  reason: string;
  vaultMatch: LedgerRow | null;
  hallMatch: LedgerRow | null;
  /** Top scored hits after reputation boost (includes pruned for audit). */
  scoredHits: SourceHit[];
  /** Low-reputation hits removed from auto-GREEN context. */
  prunedHits: SourceHit[];
  /** Hits remaining in auto-GREEN / safe prior context. */
  contextHits: SourceHit[];
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function tokenize(text: string): string[] {
  return normalize(text)
    .split(" ")
    .filter((t) => t.length > 2);
}

function overlapScore(a: string, b: string): number {
  const at = new Set(tokenize(a));
  const bt = new Set(tokenize(b));
  if (!at.size || !bt.size) return 0;
  let overlap = 0;
  for (const token of at) {
    if (bt.has(token)) overlap++;
  }
  return overlap / Math.max(at.size, bt.size);
}

function scoreAll(
  pulseText: string,
  rows: LedgerRow[],
  ledger: "vault" | "hall"
): SourceHit[] {
  const scored: SourceHit[] = [];
  for (const row of rows) {
    const score = overlapScore(pulseText, row.content || "");
    if (score <= 0) continue;
    scored.push(
      hitFromLedgerRow({
        id: row.id,
        content: row.content || "",
        metadata: row.metadata,
        ledger,
        score,
      })
    );
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 8);
}

function bestLedgerRow(
  pulseText: string,
  rows: LedgerRow[]
): { row: LedgerRow | null; score: number } {
  let best: LedgerRow | null = null;
  let bestScore = 0;
  for (const row of rows) {
    const score = overlapScore(pulseText, row.content || "");
    if (score > bestScore) {
      bestScore = score;
      best = row;
    }
  }
  return { row: best, score: bestScore };
}

export type ShadowPreflightOptions = {
  /** Required — Hall / Vault candidates are limited to this tenant silo. */
  tenantId: string;
};

/**
 * Shadow Mode preflight (tenant-scoped) + P7 reputation prune/boost:
 * 1) Cross-ref Vault for relevant 1.1.1 instances (this tenant only)
 * 2) Check Hall of Hallucinations for rejected patterns (this tenant only)
 * 3) Immediate RED tier if Hall match is strong
 * 4) Prune low-reputation sources from auto-GREEN context; escalate on copyleft/untrusted
 */
export async function preFlightCheck(
  supabase: SupabaseClient,
  pulse: ShadowPulse,
  options: ShadowPreflightOptions
): Promise<ShadowPreflightResult> {
  const empty: ShadowPreflightResult = {
    tier: "YELLOW",
    blocked: false,
    reason: "Empty pulse text; preflight inconclusive.",
    vaultMatch: null,
    hallMatch: null,
    scoredHits: [],
    prunedHits: [],
    contextHits: [],
  };

  const tenantId = resolveTenantIdForQuery(options.tenantId);
  const pulseText = normalize(pulse.text);
  if (!pulseText) return empty;

  const seed = tokenize(pulseText).slice(0, 8).join(" ");
  const tid = normalizeTenantId(tenantId);

  const vaultQuery = fromPillarVectors(supabase, tenantId)
    .select("id, content, metadata")
    .eq("metadata->>tenant_id", tid)
    .eq("metadata->>pillar", "P6")
    .eq("metadata->>ledger", "vault")
    .eq("metadata->>instance", "1.1.1")
    .ilike("content", `%${seed}%`)
    .limit(30);

  const hallQuery = fromPillarVectors(supabase, tenantId)
    .select("id, content, metadata")
    .eq("metadata->>tenant_id", tid)
    .eq("metadata->>pillar", "P6")
    .eq("metadata->>ledger", "hall")
    .ilike("content", `%${seed}%`)
    .limit(30);

  const [{ data: vaultRows, error: vaultError }, { data: hallRows, error: hallError }] =
    await Promise.all([vaultQuery, hallQuery]);

  if (vaultError) throw vaultError;
  if (hallError) throw hallError;

  const vaultCandidates = filterVaultRowsForRetrieval(
    filterPillarRowsByTenant((vaultRows ?? []) as LedgerRow[], tenantId)
  );
  const hallCandidates = filterPillarRowsByTenant(
    (hallRows ?? []) as LedgerRow[],
    tenantId
  );

  const vaultScored = scoreAll(pulseText, vaultCandidates, "vault");
  const hallScored = scoreAll(pulseText, hallCandidates, "hall");
  const rawHits = [...vaultScored, ...hallScored].sort((a, b) => b.score - a.score);

  let reputation = new Map<string, number>();
  try {
    reputation = await loadReputationMap(
      supabase,
      tenantId,
      rawHits.map((h) => h.resource_key)
    );
  } catch {
    reputation = new Map();
  }

  const { contextHits, prunedHits, forceEscalate, escalateReason } =
    applyReputationToHits(rawHits, reputation);

  const scoredHits = [...contextHits, ...prunedHits];

  const { row: hallMatch, score: hallScore } = bestLedgerRow(
    pulseText,
    hallCandidates
  );
  // Prefer best hall hit that was not pruned for safety RED (Hall safety still applies).
  if (hallMatch && hallScore >= 0.28) {
    return {
      tier: "RED",
      blocked: true,
      reason:
        "RED Tier violation: proposed logic matches this tenant's Hall of Hallucinations.",
      vaultMatch: bestLedgerRow(pulseText, vaultCandidates).row,
      hallMatch,
      scoredHits,
      prunedHits,
      contextHits,
    };
  }

  // Vault-only auto-GREEN requires at least one non-pruned vault context hit (if any vault raw).
  const vaultContext = contextHits.filter((h) => h.kind === "vault" || h.ledger === "vault");
  const hadVaultRaw = vaultScored.length > 0;
  if (hadVaultRaw && vaultContext.length === 0) {
    return {
      tier: "YELLOW",
      blocked: false,
      reason:
        "Preflight escalate: only low-reputation Vault matches remain after P7 prune.",
      vaultMatch: bestLedgerRow(pulseText, vaultCandidates).row,
      hallMatch: null,
      scoredHits,
      prunedHits,
      contextHits,
    };
  }

  if (forceEscalate) {
    return {
      tier: "YELLOW",
      blocked: false,
      reason: `Preflight escalate: ${escalateReason ?? "attribution_class"} — human review required.`,
      vaultMatch: bestLedgerRow(pulseText, vaultCandidates).row,
      hallMatch: null,
      scoredHits,
      prunedHits,
      contextHits,
    };
  }

  return {
    tier: "GREEN",
    blocked: false,
    reason: "Preflight clear: no Hall match breach detected for this tenant.",
    vaultMatch: bestLedgerRow(pulseText, vaultCandidates).row,
    hallMatch: null,
    scoredHits,
    prunedHits,
    contextHits,
  };
}
