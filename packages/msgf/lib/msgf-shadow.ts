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
 * Distribution Build ID: MSGF-b4602b0-20260519T165710Z-internal
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { KeystrokeEvent } from "@/lib/P4";
import { fromPillarVectors } from "@/lib/msgf-pillar-table";
import { normalizeTenantId } from "@/lib/services/msgf-metadata-scope";
import {
  filterPillarRowsByTenant,
  resolveTenantIdForQuery,
} from "@/lib/services/tenant-query-scope";

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

function bestMatch(pulseText: string, rows: LedgerRow[]): LedgerRow | null {
  let best: LedgerRow | null = null;
  let bestScore = 0;
  for (const row of rows) {
    const score = overlapScore(pulseText, row.content || "");
    if (score > bestScore) {
      bestScore = score;
      best = row;
    }
  }
  return best;
}

export type ShadowPreflightOptions = {
  /** Required — Hall / Vault candidates are limited to this tenant silo. */
  tenantId: string;
};

/**
 * Shadow Mode preflight (tenant-scoped):
 * 1) Cross-ref Vault for relevant 1.1.1 instances (this tenant only)
 * 2) Check Hall of Hallucinations for rejected patterns (this tenant only)
 * 3) Immediate RED tier if Hall match is strong
 */
export async function preFlightCheck(
  supabase: SupabaseClient,
  pulse: ShadowPulse,
  options: ShadowPreflightOptions
): Promise<ShadowPreflightResult> {
  const tenantId = resolveTenantIdForQuery(options.tenantId);
  const pulseText = normalize(pulse.text);
  if (!pulseText) {
    return {
      tier: "YELLOW",
      blocked: false,
      reason: "Empty pulse text; preflight inconclusive.",
      vaultMatch: null,
      hallMatch: null,
    };
  }

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

  const vaultCandidates = filterPillarRowsByTenant(
    (vaultRows ?? []) as LedgerRow[],
    tenantId
  );
  const hallCandidates = filterPillarRowsByTenant(
    (hallRows ?? []) as LedgerRow[],
    tenantId
  );

  const vaultMatch = bestMatch(pulseText, vaultCandidates);
  const hallMatch = bestMatch(pulseText, hallCandidates);

  const hallScore = hallMatch ? overlapScore(pulseText, hallMatch.content || "") : 0;
  if (hallMatch && hallScore >= 0.28) {
    return {
      tier: "RED",
      blocked: true,
      reason:
        "RED Tier violation: proposed logic matches this tenant's Hall of Hallucinations.",
      vaultMatch,
      hallMatch,
    };
  }

  return {
    tier: "GREEN",
    blocked: false,
    reason: "Preflight clear: no Hall match breach detected for this tenant.",
    vaultMatch,
    hallMatch,
  };
}
