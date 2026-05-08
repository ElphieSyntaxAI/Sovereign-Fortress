import type { SupabaseClient } from "@supabase/supabase-js";
import type { KeystrokeEvent } from "@/lib/P4";

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

/**
 * Shadow Mode preflight:
 * 1) Cross-ref Vault for most relevant 1.1.1 instance
 * 2) Simultaneously check Hall of Hallucinations for rejected logic patterns
 * 3) Immediate RED tier if Hall match is strong
 */
export async function preFlightCheck(
  supabase: SupabaseClient,
  pulse: ShadowPulse
): Promise<ShadowPreflightResult> {
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

  const vaultQuery = supabase
    .from("pillar_vectors")
    .select("id, content, metadata")
    .eq("metadata->>pillar", "P6")
    .eq("metadata->>ledger", "vault")
    .eq("metadata->>instance", "1.1.1")
    .ilike("content", `%${seed}%`)
    .limit(30);

  const hallQuery = supabase
    .from("pillar_vectors")
    .select("id, content, metadata")
    .eq("metadata->>pillar", "P6")
    .eq("metadata->>ledger", "hall")
    .ilike("content", `%${seed}%`)
    .limit(30);

  const [{ data: vaultRows, error: vaultError }, { data: hallRows, error: hallError }] =
    await Promise.all([vaultQuery, hallQuery]);

  if (vaultError) throw vaultError;
  if (hallError) throw hallError;

  const vaultCandidates = (vaultRows ?? []) as LedgerRow[];
  const hallCandidates = (hallRows ?? []) as LedgerRow[];

  const vaultMatch = bestMatch(pulseText, vaultCandidates);
  const hallMatch = bestMatch(pulseText, hallCandidates);

  const hallScore = hallMatch ? overlapScore(pulseText, hallMatch.content || "") : 0;
  if (hallMatch && hallScore >= 0.28) {
    return {
      tier: "RED",
      blocked: true,
      reason: "RED Tier violation: proposed logic matches Hall of Hallucinations.",
      vaultMatch,
      hallMatch,
    };
  }

  return {
    tier: "GREEN",
    blocked: false,
    reason: "Preflight clear: no Hall match breach detected.",
    vaultMatch,
    hallMatch,
  };
}

