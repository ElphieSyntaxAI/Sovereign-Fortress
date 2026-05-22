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
 * Distribution Build ID: MSGF-1013d7a-20260522T022234Z-internal
 */
/**
 * V3.2 tier batching — YELLOW (6h) + GREEN (24h) reports into pillar_vectors (P6 vault).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type TierMaintenanceResult = {
  yellow: { beatCount: number; authorCount: number };
  green: { beatCount: number; avgHal: number; tokenEfficiency: number };
};

function hoursAgoIso(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

async function fetchRecentBeats(admin: SupabaseClient, hours: number) {
  const { data, error } = await admin
    .from("state_beats")
    .select("author_id, beat_text, sequence_index, metadata, created_at")
    .gte("created_at", hoursAgoIso(hours))
    .order("created_at", { ascending: false });

  if (error) {
    const msg = String(error.message);
    if (msg.includes("state_beats") && (msg.includes("does not exist") || msg.includes("Could not find"))) {
      return [];
    }
    throw error;
  }
  return data ?? [];
}

async function writeTierRecord(
  admin: SupabaseClient,
  params: {
    tier: "YELLOW" | "GREEN";
    title: string;
    content: string;
    metadata: Record<string, unknown>;
  }
) {
  const { error } = await admin.from("pillar_vectors").insert({
    content: params.content,
    metadata: {
      pillar: "P6",
      ledger: "vault",
      index_type: "tier_report",
      tier: params.tier,
      title: params.title,
      generated_at: new Date().toISOString(),
      ...params.metadata,
    },
  });
  if (error) throw error;
}

export async function runV32TierMaintenance(admin: SupabaseClient): Promise<TierMaintenanceResult> {
  const yellowBeats = await fetchRecentBeats(admin, 6);
  const byAuthor = new Map<string, typeof yellowBeats>();
  for (const beat of yellowBeats) {
    const id = String(beat.author_id ?? "unknown");
    const list = byAuthor.get(id) ?? [];
    list.push(beat);
    byAuthor.set(id, list);
  }

  if (yellowBeats.length > 0) {
    const summary = [...byAuthor.entries()]
      .map(([authorId, beats]) => `${authorId}: ${beats.length} beats (6h window)`)
      .join("\n");
    await writeTierRecord(admin, {
      tier: "YELLOW",
      title: "Periodic Calibration Summary (6h)",
      content: `YELLOW tier batch — ${yellowBeats.length} beats across ${byAuthor.size} entities.\n\n${summary}`,
      metadata: { window_hours: 6, beat_count: yellowBeats.length, entity_count: byAuthor.size },
    });
  }

  const greenBeats = await fetchRecentBeats(admin, 24);
  const halScores = greenBeats
    .map((b) => {
      const meta = b.metadata as Record<string, unknown> | null;
      const hal = meta?.hal_score ?? meta?.halScore;
      return typeof hal === "number" && Number.isFinite(hal) ? hal : null;
    })
    .filter((n): n is number => n != null);

  const avgHal = halScores.length
    ? halScores.reduce((a, b) => a + b, 0) / halScores.length
    : 0;
  const charCount = greenBeats.reduce((sum, b) => sum + String(b.beat_text ?? "").length, 0);
  const tokenEfficiency = greenBeats.length ? charCount / greenBeats.length : 0;

  if (greenBeats.length > 0) {
    await writeTierRecord(admin, {
      tier: "GREEN",
      title: "Cumulative Style & Token Efficiency (24h)",
      content: [
        `GREEN tier batch — ${greenBeats.length} beats (24h).`,
        `Average HAL proxy: ${avgHal.toFixed(3)}`,
        `Token efficiency proxy (chars/beat): ${tokenEfficiency.toFixed(1)}`,
      ].join("\n"),
      metadata: {
        window_hours: 24,
        beat_count: greenBeats.length,
        avg_hal: avgHal,
        token_efficiency_chars_per_beat: tokenEfficiency,
      },
    });
  }

  return {
    yellow: { beatCount: yellowBeats.length, authorCount: byAuthor.size },
    green: { beatCount: greenBeats.length, avgHal, tokenEfficiency },
  };
}
