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
 * Distribution Build ID: MSGF-7175065-20260515T200509Z-internal
 */
/**
 * V3.2 BATCH — daily Logic Drift reporting from `p4_narrative_logs` (1.1.1 genealogical index).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  GenealogicalBugIndexSchema,
  PULSE_BUG_INDEX,
  type GenealogicalBugIndex,
} from "@/lib/schemas/vault-hall-metadata";

export type DriftTier = "RED" | "YELLOW" | "GREEN";

export type IndexCountMap = Record<string, number>;

export type DriftTierSummary = {
  total: number;
  by_index: IndexCountMap;
};

export type DailySummaryWindow = {
  from: string;
  to: string;
  hours: number;
};

export type DailySummaryResult = {
  window: DailySummaryWindow;
  scanned_rows: number;
  classified_rows: number;
  unclassified_rows: number;
  RED: DriftTierSummary;
  YELLOW: DriftTierSummary;
  GREEN: DriftTierSummary;
};

export const HALL_RED_RETAIN_INSTANCES = new Set<string>([
  PULSE_BUG_INDEX.hallHitlRequired.level_1_1_1_instance,
  PULSE_BUG_INDEX.hallLomRecursion.level_1_1_1_instance,
]);

const RED_INSTANCES = HALL_RED_RETAIN_INSTANCES;

const GREEN_INSTANCES = new Set<string>([
  PULSE_BUG_INDEX.vaultConsensusOk.level_1_1_1_instance,
]);

type NarrativeRow = {
  id: string;
  created_at: string;
  metadata: unknown;
};

function emptyTierSummary(): DriftTierSummary {
  return { total: 0, by_index: {} };
}

function bump(map: IndexCountMap, instance: string): void {
  map[instance] = (map[instance] ?? 0) + 1;
}

function bugIndexKey(index: GenealogicalBugIndex): string {
  return index.level_1_1_1_instance;
}

/**
 * Classify a pulse narrative log into BATCH drift tiers (no double-count across RED/YELLOW).
 */
/**
 * V3.2 Automatic Purge — retain RED-tier Hall rows (critical training corpus).
 * Matches metadata `tier: RED` or ARBITRATE / DEFEND critical 1.1.1 instances.
 */
export function isRedTierHallRecord(metadata: unknown): boolean {
  if (metadata == null || typeof metadata !== "object") return false;
  const record = metadata as Record<string, unknown>;
  const vaultHall = record.vault_hall as Record<string, unknown> | undefined;

  const tier = record.tier ?? vaultHall?.tier;
  if (tier === "RED") return true;

  const rawIndex = record.bug_index ?? vaultHall?.bug_index;
  const parsed = GenealogicalBugIndexSchema.safeParse(rawIndex);
  if (parsed.success && HALL_RED_RETAIN_INSTANCES.has(parsed.data.level_1_1_1_instance)) {
    return true;
  }

  return false;
}

export function classifyDriftTier(params: {
  ledger?: string;
  instance: string;
}): DriftTier | null {
  const { ledger, instance } = params;

  if (GREEN_INSTANCES.has(instance) || ledger === "vault") {
    return "GREEN";
  }

  if (RED_INSTANCES.has(instance)) {
    return "RED";
  }

  if (ledger === "hall") {
    return "YELLOW";
  }

  return null;
}

function parseRowMetadata(metadata: unknown): {
  ledger?: string;
  bugIndex?: GenealogicalBugIndex;
} | null {
  if (metadata == null || typeof metadata !== "object") return null;
  const record = metadata as Record<string, unknown>;
  const rawIndex = record.bug_index;
  if (rawIndex == null || typeof rawIndex !== "object") return null;

  const parsed = GenealogicalBugIndexSchema.safeParse(rawIndex);
  if (!parsed.success) return null;

  const ledger =
    typeof record.ledger === "string"
      ? record.ledger
      : typeof (record.vault_hall as Record<string, unknown> | undefined)?.ledger === "string"
        ? String((record.vault_hall as Record<string, unknown>).ledger)
        : undefined;

  return { ledger, bugIndex: parsed.data };
}

export function aggregateDailySummary(rows: NarrativeRow[], window: DailySummaryWindow): DailySummaryResult {
  const RED = emptyTierSummary();
  const YELLOW = emptyTierSummary();
  const GREEN = emptyTierSummary();

  let classified = 0;

  for (const row of rows) {
    const parsed = parseRowMetadata(row.metadata);
    if (!parsed?.bugIndex) continue;

    const instance = bugIndexKey(parsed.bugIndex);
    const tier = classifyDriftTier({ ledger: parsed.ledger, instance });
    if (!tier) continue;

    classified += 1;
    const bucket = tier === "RED" ? RED : tier === "YELLOW" ? YELLOW : GREEN;
    bucket.total += 1;
    bump(bucket.by_index, instance);
  }

  return {
    window,
    scanned_rows: rows.length,
    classified_rows: classified,
    unclassified_rows: rows.length - classified,
    RED,
    YELLOW,
    GREEN,
  };
}

export function formatLogicDriftSummary(summary: DailySummaryResult): string {
  const lines: string[] = [
    "══════════════════════════════════════════════════════════════",
    "  MSGF Logic Drift Summary (V3.2 BATCH — last 24h)",
    "══════════════════════════════════════════════════════════════",
    `  Window : ${summary.window.from} → ${summary.window.to}`,
    `  Scanned: ${summary.scanned_rows} narrative logs (${summary.classified_rows} classified)`,
    "",
    `  RED    : ${summary.RED.total}  (HITL tie-breaker + LOM recursion)`,
    ...formatIndexLines(summary.RED.by_index, "    "),
    "",
    `  YELLOW : ${summary.YELLOW.total}  (Hall rejections)`,
    ...formatIndexLines(summary.YELLOW.by_index, "    "),
    "",
    `  GREEN  : ${summary.GREEN.total}  (Vault consensus successes)`,
    ...formatIndexLines(summary.GREEN.by_index, "    "),
    "",
    "══════════════════════════════════════════════════════════════",
  ];
  return lines.join("\n");
}

function formatIndexLines(byIndex: IndexCountMap, indent: string): string[] {
  const entries = Object.entries(byIndex).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return [`${indent}(none)`];
  return entries.map(([key, count]) => `${indent}${key}: ${count}`);
}

export class ReportingEngine {
  constructor(private readonly hours = 24) {}

  /**
   * Scans `p4_narrative_logs` for the trailing window and groups counts by 1.1.1 instance.
   */
  async generateDailySummary(
    adminSupabase: SupabaseClient,
    options?: { hours?: number; now?: Date }
  ): Promise<DailySummaryResult> {
    const hours = options?.hours ?? this.hours;
    const now = options?.now ?? new Date();
    const from = new Date(now.getTime() - hours * 60 * 60 * 1000);

    const window: DailySummaryWindow = {
      from: from.toISOString(),
      to: now.toISOString(),
      hours,
    };

    const { data, error } = await adminSupabase
      .from("p4_narrative_logs")
      .select("id, created_at, metadata")
      .gte("created_at", window.from)
      .lte("created_at", window.to)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`p4_narrative_logs scan failed: ${error.message}`);
    }

    return aggregateDailySummary((data ?? []) as NarrativeRow[], window);
  }
}
