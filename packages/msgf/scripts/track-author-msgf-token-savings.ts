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
 * Distribution Build ID: MSGF-92d026a-20260522T181651Z-internal
 */
/**
 * Compare estimated token spend **before MSGF** (naive dual-CONVERGE per HAL chunk)
 * vs **after MSGF** (actual Pulse routing from Author BFF or in-process PulseEngine).
 *
 * Usage (from packages/msgf):
 *   npm run track:author-tokens -w msgf
 *   npm run track:author-tokens -w msgf -- --live
 *   npm run track:author-tokens -w msgf -- --json
 *
 * Env:
 *   MSGF_APP_URL, MSGF_AUTHOR_PULSE_LICENSE_KEY or MSGF_CONTRACT_LICENSE_KEY
 *   AUTHOR_ECOSYSTEM_URL (default http://127.0.0.1:3002)
 *   AUTHOR_ECOSYSTEM_JWT — Bearer for BFF /api/msgf/pulse (optional with --in-process)
 *   AUTHOR_TENANT_ID — default author_ecosystem
 */

import { createClient } from "@supabase/supabase-js";

import { resolveMsgfLocalDevOrigin } from "../lib/runtime/msgf-dev-defaults.js";
import { buildChunkedAuthorPulseBodiesFromContent } from "../lib/hal-author-bridge.js";
import { bootstrapTenantBrain, createPledgeBeat } from "../lib/msgf-onboarding.js";
import { toUniversalP1PulseBody } from "../src/lib/universal/p1HalStandard.js";
import { pulseEngine } from "../lib/services/PulseEngine.js";
import {
  compareTokenUsage,
  estimateMsgfRoutedTokens,
  estimateNaiveUngatedTokens,
  routingFromPulseResponse,
  type TokenSavingsComparison,
} from "../lib/services/token-usage-estimate.js";

const AUTHOR_BASE = (
  process.env.AUTHOR_ECOSYSTEM_URL || "http://127.0.0.1:3002"
).replace(/\/$/, "");
const MSGF_BASE = resolveMsgfLocalDevOrigin().replace(
  /\/$/,
  ""
);
const AUTHOR_TENANT = process.env.AUTHOR_TENANT_ID?.trim() || "author_ecosystem";
const LICENSE =
  process.env.MSGF_AUTHOR_PULSE_LICENSE_KEY?.trim() ||
  process.env.MSGF_CONTRACT_LICENSE_KEY?.trim() ||
  "";
const AUTHOR_JWT = process.env.AUTHOR_ECOSYSTEM_JWT?.trim();

const args = new Set(process.argv.slice(2));
const LIVE = args.has("--live");
const IN_PROCESS = args.has("--in-process") || (!LIVE && !AUTHOR_JWT);
const JSON_OUT = args.has("--json");

type Scenario = {
  id: string;
  label: string;
  content: string;
  keystrokes: { ts: number; key: string; type: "keydown" | "input" }[];
};

function routineKeystrokes(text: string) {
  const base = Date.now();
  return text.split("").map((key, i) => ({
    ts: base + i * 95,
    key,
    type: "keydown" as const,
  }));
}

const SCENARIOS: Scenario[] = [
  {
    id: "routine_chapter",
    label: "Routine chapter edit (local gateway expected)",
    content:
      "She closed the ledger and listened to the rain. The rhythm of her typing had steadied after the vault pact, each sentence hers alone.",
    keystrokes: routineKeystrokes(
      "She closed the ledger and listened to the rain."
    ),
  },
  {
    id: "long_hal_chunk",
    label: "Long excerpt (~2 HAL chunks)",
    content: Array.from({ length: 400 }, (_, i) => `word${i}`).join(" "),
    keystrokes: routineKeystrokes("word"),
  },
];

function packetCountForContent(content: string): number {
  const packets = buildChunkedAuthorPulseBodiesFromContent({
    contentDelta: content,
    events: [{ key: "k", flightTime: 90 }],
    targetPrefix: "track:probe",
    lastSyncedChunkIndex: null,
  });
  return Math.max(1, packets.length);
}

async function pulseViaAuthorBff(
  scenario: Scenario,
  userId: string
): Promise<{ status: number; body: unknown }> {
  const body = toUniversalP1PulseBody({ keystrokes: scenario.keystrokes });
  const url = `${AUTHOR_BASE}/api/msgf/pulse`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (AUTHOR_JWT) headers.Authorization = `Bearer ${AUTHOR_JWT}`;
  else if (LICENSE) {
    headers.Authorization = `Bearer ${LICENSE}`;
    headers["x-msgf-license-key"] = LICENSE;
    headers["x-msgf-ide-pulse"] = "1";
    headers["x-msgf-entity-id"] = userId;
    headers["x-msgf-tenant-id"] = AUTHOR_TENANT;
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ tenantId: AUTHOR_TENANT, ...body }),
  });
  const json: unknown = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}

let inProcessAdmin: ReturnType<typeof createClient> | null = null;

async function ensureInProcessAdmin(): Promise<ReturnType<typeof createClient>> {
  if (inProcessAdmin) return inProcessAdmin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required for --in-process");
  }
  inProcessAdmin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return inProcessAdmin;
}

async function pulseInProcess(
  scenario: Scenario,
  entityId: string,
  tenantId: string
): Promise<{ status: number; body: unknown }> {
  const admin = await ensureInProcessAdmin();

  const result = await pulseEngine.runFullPipeline({
    supabase: admin,
    adminSupabase: admin,
    entityId,
    tenantId,
    rawBody: { keystrokes: scenario.keystrokes },
    geminiModelId: process.env.MSGF_GEMINI_MODEL || "gemini-2.5-flash",
    license: {
      licenseId: "track-author-tokens",
      tenantId,
      tierId: "brain_contract",
    },
  });

  if (result.kind !== "ok") {
    return { status: 400, body: result };
  }
  return { status: 200, body: result.public };
}

async function runScenario(
  scenario: Scenario,
  userId: string
): Promise<TokenSavingsComparison & { scenario_id: string; label: string; routing: string | null; http_status: number }> {
  const packets = packetCountForContent(scenario.content);
  const before = estimateNaiveUngatedTokens({
    contentChars: scenario.content.length,
    keystrokeCount: scenario.keystrokes.length,
    packetCount: packets,
  });

  const { status, body } = IN_PROCESS
    ? await pulseInProcess(scenario, userId, AUTHOR_TENANT)
    : await pulseViaAuthorBff(scenario, userId);

  const routing = routingFromPulseResponse(body);
  const after = estimateMsgfRoutedTokens({
    contentChars: scenario.content.length,
    keystrokeCount: scenario.keystrokes.length,
    packetCount: packets,
    routing,
    authorHalTrusted: Boolean(
      typeof body === "object" &&
        body &&
        "x-msgf-author-hal" in (body as Record<string, unknown>)
    ),
  });

  const cmp = compareTokenUsage(before, after);
  return {
    scenario_id: scenario.id,
    label: scenario.label,
    routing,
    http_status: status,
    ...cmp,
  };
}

async function main() {
  const mappingRes = await fetch(`${AUTHOR_BASE}/api/status`).catch(() => null);
  const mappingJson = mappingRes?.ok
    ? ((await mappingRes.json()) as { msgf_mapping?: { ready?: boolean; missing?: string[] } })
    : null;

  const userId =
    process.env.MSGF_TRACK_ENTITY_ID?.trim() ||
    process.env.MSGF_VERIFY_AUTHOR_ID?.trim() ||
    "track-author-msgf-probe";

  if (IN_PROCESS) {
    const admin = await ensureInProcessAdmin();
    const readiness = await bootstrapTenantBrain(admin, AUTHOR_TENANT, userId);
    await createPledgeBeat(userId, { tenantId: AUTHOR_TENANT, supabase: admin });
    if (!readiness.is_pillar_baseline_set) {
      console.warn(
        `[track:author-tokens] pillar baseline ${readiness.pillars_present}/6 — some pulses may return baseline_required`
      );
    }
  }

  const results: Awaited<ReturnType<typeof runScenario>>[] = [];
  for (const scenario of SCENARIOS) {
    results.push(await runScenario(scenario, userId));
  }

  const totals = results.reduce(
    (acc, r) => ({
      before: acc.before + r.before_msgf.tokens,
      after: acc.after + r.after_msgf.tokens,
      saved: acc.saved + r.tokens_saved,
    }),
    { before: 0, after: 0, saved: 0 }
  );
  const totalPct =
    totals.before > 0 ? Math.round((totals.saved / totals.before) * 1000) / 10 : 0;

  const report = {
    generated_at: new Date().toISOString(),
    mode: IN_PROCESS ? "in-process" : LIVE ? "live-bff" : "bff-or-direct",
    author_base: AUTHOR_BASE,
    msgf_base: MSGF_BASE,
    tenant_id: AUTHOR_TENANT,
    author_msgf_mapping: mappingJson?.msgf_mapping ?? null,
    scenarios: results,
    totals: {
      before_msgf_tokens: totals.before,
      after_msgf_tokens: totals.after,
      tokens_saved: totals.saved,
      savings_pct: totalPct,
    },
    notes: [
      "before_msgf = naive dual-CONVERGE per HAL chunk (175 words, 10 overlap).",
      "after_msgf = estimate from Pulse routing (local_gateway vs global_converge).",
      "Not invoice-grade; tune via MSGF_NAIVE_DUAL_CONVERGE_TOKENS / MSGF_LOCAL_GATEWAY_BASE_TOKENS.",
    ],
  };

  if (JSON_OUT) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log("Author ↔ MSGF token savings tracker\n");
  console.log(`Mode: ${report.mode} · tenant: ${AUTHOR_TENANT}`);
  if (mappingJson?.msgf_mapping) {
    console.log(
      `BFF MSGF ready: ${mappingJson.msgf_mapping.ready ? "yes" : "no"}${
        mappingJson.msgf_mapping.missing?.length
          ? ` (missing: ${mappingJson.msgf_mapping.missing.join(", ")})`
          : ""
      }`
    );
  }
  console.log("");

  for (const r of results) {
    console.log(`— ${r.label} (${r.scenario_id})`);
    console.log(`  HTTP ${r.http_status} · routing: ${r.routing ?? "unknown"}`);
    console.log(`  Before MSGF (naive):  ${r.before_msgf.tokens.toLocaleString()} tokens (${r.before_msgf.model})`);
    console.log(`  After MSGF (routed):  ${r.after_msgf.tokens.toLocaleString()} tokens (${r.after_msgf.model})`);
    console.log(`  Saved: ${r.tokens_saved.toLocaleString()} (${r.savings_pct}%)`);
    console.log("");
  }

  console.log("Totals");
  console.log(`  Before: ${totals.before.toLocaleString()}`);
  console.log(`  After:  ${totals.after.toLocaleString()}`);
  console.log(`  Saved:  ${totals.saved.toLocaleString()} (${totalPct}%)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
