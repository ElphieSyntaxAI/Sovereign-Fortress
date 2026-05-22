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
 * MSGF Tier Processor (background worker)
 *
 * Responsibilities:
 * 1) YELLOW (6h): aggregate beats for periodic calibration summaries
 * 2) GREEN (24h): generate cumulative style/token-efficiency reports
 * 3) Maintenance: purge LOW-tier Hall entries older than 30 days
 */
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
const monorepoRoot = path.join(__dirname, "..", "..", "..");
require("dotenv").config({ path: path.join(monorepoRoot, ".env") });
require("dotenv").config({ path: path.join(monorepoRoot, ".env.local"), override: true });
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
require("dotenv").config({ path: path.join(__dirname, "..", ".env.local"), override: true });

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error(
    "Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function hoursAgoISO(hours) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function daysAgoISO(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function avg(nums) {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

async function fetchRecentBeats(hours) {
  const { data, error } = await supabase
    .from("state_beats")
    .select("author_id, beat_text, sequence_index, metadata, created_at")
    .gte("created_at", hoursAgoISO(hours))
    .order("created_at", { ascending: false });

  if (error) {
    const msg = String(error.message || error);
    // Schema cache / missing table should not stop maintenance jobs.
    if (
      msg.includes("Could not find the table 'public.state_beats'") ||
      msg.includes("relation \"public.state_beats\" does not exist")
    ) {
      console.warn(
        "state_beats unavailable in schema cache; skipping YELLOW/GREEN batch jobs for this run."
      );
      return [];
    }
    throw error;
  }
  return data || [];
}

async function writeTierRecord({ tier, title, content, metadata }) {
  const { error } = await supabase.from("pillar_vectors").insert({
    content,
    metadata: {
      pillar: "P6",
      ledger: "vault",
      index_type: "tier_report",
      tier,
      title,
      generated_at: new Date().toISOString(),
      ...metadata,
    },
  });
  if (error) throw error;
}

async function processYellowTier() {
  const beats = await fetchRecentBeats(6);

  const byAuthor = new Map();
  for (const beat of beats) {
    const list = byAuthor.get(beat.author_id) || [];
    list.push(beat);
    byAuthor.set(beat.author_id, list);
  }

  const summaryLines = [
    "# YELLOW Tier Calibration Summary (6 Hours)",
    `Generated: ${new Date().toISOString()}`,
    `Total beats: ${beats.length}`,
    "",
  ];

  for (const [authorId, authorBeats] of byAuthor.entries()) {
    const halScores = authorBeats
      .map((b) => Number(b.metadata?.hal_score))
      .filter((n) => Number.isFinite(n));
    const retryCounts = authorBeats
      .map((b) => Number(b.metadata?.retry_count))
      .filter((n) => Number.isFinite(n));

    summaryLines.push(
      `- ${authorId}: beats=${authorBeats.length}, avg_hal=${avg(halScores).toFixed(
        1
      )}, avg_retry=${avg(retryCounts).toFixed(2)}`
    );
  }

  await writeTierRecord({
    tier: "YELLOW",
    title: "Periodic Calibration Batch",
    content: summaryLines.join("\n"),
    metadata: {
      window_hours: 6,
      beat_count: beats.length,
    },
  });

  return { beatCount: beats.length, authorCount: byAuthor.size };
}

async function processGreenTier() {
  const beats = await fetchRecentBeats(24);

  let totalChars = 0;
  let totalChunks = 0;
  let totalHal = 0;
  let halCount = 0;

  for (const beat of beats) {
    totalChars += (beat.beat_text || "").length;
    const chunks = Number(beat.metadata?.chunkCount);
    if (Number.isFinite(chunks)) totalChunks += chunks;
    const hal = Number(beat.metadata?.hal_score);
    if (Number.isFinite(hal)) {
      totalHal += hal;
      halCount++;
    }
  }

  const tokenEfficiency =
    totalChunks > 0 ? Number((totalChars / totalChunks).toFixed(2)) : 0;
  const avgHal = halCount > 0 ? Number((totalHal / halCount).toFixed(2)) : 0;

  const report = [
    "# GREEN Tier Cumulative Report (24 Hours)",
    `Generated: ${new Date().toISOString()}`,
    `Total beats: ${beats.length}`,
    `Total chars: ${totalChars}`,
    `Total chunks: ${totalChunks}`,
    `Style stability proxy (avg HAL): ${avgHal}`,
    `Token efficiency proxy (chars/chunk): ${tokenEfficiency}`,
  ].join("\n");

  await writeTierRecord({
    tier: "GREEN",
    title: "Cumulative Style & Token Efficiency",
    content: report,
    metadata: {
      window_hours: 24,
      beat_count: beats.length,
      avg_hal: avgHal,
      token_efficiency_chars_per_chunk: tokenEfficiency,
    },
  });

  return { beatCount: beats.length, avgHal, tokenEfficiency };
}

async function purgeHallLowTier() {
  const cutoff = daysAgoISO(30);
  const { data, error } = await supabase
    .from("pillar_vectors")
    .select("id, metadata")
    .eq("metadata->>pillar", "P6")
    .eq("metadata->>ledger", "hall")
    .eq("metadata->>severity", "LOW")
    ;

  if (error) throw error;
  const rows = data || [];
  const cutoffMs = new Date(cutoff).getTime();
  const idsToDelete = rows
    .filter((row) => {
      const stampedAt =
        row.metadata?.seeded_at ||
        row.metadata?.ingested_at ||
        row.metadata?.persisted_at ||
        null;
      if (!stampedAt) return false;
      const ms = new Date(stampedAt).getTime();
      return Number.isFinite(ms) && ms < cutoffMs;
    })
    .map((row) => row.id);

  if (!idsToDelete.length) {
    return { deleted: 0, cutoff };
  }

  const { error: deleteError, data: deletedRows } = await supabase
    .from("pillar_vectors")
    .delete()
    .in("id", idsToDelete)
    .select("id");
  if (deleteError) throw deleteError;

  return { deleted: (deletedRows || []).length, cutoff };
}

async function main() {
  console.log("MSGF Tier Processor starting...");
  const yellow = await processYellowTier();
  console.log("YELLOW complete:", yellow);

  const green = await processGreenTier();
  console.log("GREEN complete:", green);

  const purge = await purgeHallLowTier();
  console.log("Hall purge complete:", purge);

  console.log("MSGF Tier Processor finished.");
}

main().catch((err) => {
  console.error("MSGF Tier Processor failed:", err.message || err);
  process.exit(1);
});

