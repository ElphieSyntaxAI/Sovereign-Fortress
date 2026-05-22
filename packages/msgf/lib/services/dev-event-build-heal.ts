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
 * Distribution Build ID: MSGF-e356216-20260522T181226Z-internal
 */
/**
 * IDE build_failed → vault-first Heal Cheap (single Gemini Flash when needed).
 * Bypasses Pulse biometric / keystroke pipeline entirely.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { CURRENT_LEGAL_VERSION } from "@/lib/msgf-legal";
import { fromPillarVectors } from "@/lib/msgf-pillar-table";
import {
  buildGenealogicalBugIndex,
  type GenealogicalBugIndex,
} from "@/lib/schemas/vault-hall-metadata";
import type { DevEventBody } from "@/lib/schemas/dev-event";
import {
  DEV_EVENT_LOGIC_DELTA_SOURCE,
  MSGF_BRAIN_SMALL,
} from "@/lib/services/brain-routing-policy";
import { persistToVault } from "@/lib/services/constraint-ledger";
import { pulseEngine } from "@/lib/services/PulseEngine";
import {
  estimateHealTaskIndividualTokens,
  HEAL_INEXPENSIVE_LLM_OVERHEAD,
} from "@/lib/services/heal-token-estimate";
import { pathToGenealogicalBugIndex } from "@/lib/services/IngestService";
import type { VaultLineageRow } from "@/lib/services/p2-flow-roadmap";
import {
  applyPillarVectorsTenantFilter,
  filterPillarRowsByTenant,
  resolveTenantIdForQuery,
} from "@/lib/services/tenant-query-scope";
import { isCostRunawayError, runWithLlmTimeoutSimple } from "@/lib/services/cost-runaway-guard";
import { recordCostRunawayDeadLetterSafe } from "@/lib/services/llm-dead-letter";
import {
  recordSavingsFeatureCount,
  recordSavingsFeatureTokensSaved,
} from "@/lib/services/savings-features-stats";

const VAULT_MATCH_MIN_SCORE =
  Number(process.env.MSGF_DEV_EVENT_VAULT_MATCH_MIN?.trim()) || 0.22;

const FLASH_MODEL =
  process.env.MSGF_DEV_EVENT_GEMINI_MODEL?.trim() ||
  process.env.MSGF_TENANT_VALIDATION_GEMINI_MODEL?.trim() ||
  "gemini-2.0-flash";

/** Estimated tokens for a single inexpensive heal (naive baseline). */
const NAIVE_HEAL_CHEAP_TOKENS = 480;

export type DevEventResolutionSource = "vault_cache" | "gemini_flash" | "unresolved";

export type DevEventHealResult = {
  ok: true;
  resolved: boolean;
  resolution_source: DevEventResolutionSource;
  brain_tier: typeof MSGF_BRAIN_SMALL;
  global_promotion_status?: string;
  genealogical_bug_index: GenealogicalBugIndex;
  fix_summary: string | null;
  vault_match_id: string | null;
  narrative_log_id: string | undefined;
  token_usage_estimate: {
    without_msgf: number;
    with_msgf: number;
    tokens_saved: number;
    savings_pct: number;
  };
};

function normalizeRelPath(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\.\/+/, "").toLowerCase().slice(0, 512);
}

export function excerptTokens(excerpt: string): string[] {
  return excerpt
    .toLowerCase()
    .replace(/[^a-z0-9:_\-\.]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2)
    .slice(0, 40);
}

function rowHaystack(row: VaultLineageRow): string {
  const meta = row.metadata ? JSON.stringify(row.metadata) : "";
  return `${row.content}\n${meta}`.toLowerCase();
}

export function scoreVaultRow(row: VaultLineageRow, activeNorm: string, tokens: string[]): number {
  const hay = rowHaystack(row);
  let score = 0;
  const base = activeNorm.split("/").pop() ?? activeNorm;
  if (activeNorm.length > 2 && hay.includes(activeNorm)) score += 0.35;
  if (base.length > 2 && hay.includes(base)) score += 0.2;
  if (!tokens.length) return score;
  let hits = 0;
  for (const t of tokens) {
    if (hay.includes(t)) hits++;
  }
  score += hits / tokens.length;
  return Math.min(1, score);
}

/**
 * Silent tenant-scoped Vault vector lookup (lexical; no embedding RPC).
 */
export async function fetchVaultResolutionsForActiveFile(
  supabase: SupabaseClient,
  tenantId: string,
  activeFile: string,
  excerpt: string
): Promise<{ rows: VaultLineageRow[]; best: { row: VaultLineageRow; score: number } | null }> {
  const tid = resolveTenantIdForQuery(tenantId);
  const activeNorm = normalizeRelPath(activeFile);
  const tokens = excerptTokens(excerpt);
  const patterns = [
    activeNorm,
    activeNorm.split("/").pop() ?? "",
    ...tokens.slice(0, 6),
  ].filter((p) => p.length > 2);

  const merged = new Map<string, VaultLineageRow>();

  for (const pattern of [...new Set(patterns)].slice(0, 8)) {
    type FilterEq = { eq: (column: string, value: string) => FilterEq };
    let query: FilterEq = fromPillarVectors(supabase, tid)
      .select("id, content, metadata")
      .eq("metadata->>ledger", "vault")
      .ilike("content", `%${pattern}%`)
      .order("id", { ascending: false })
      .limit(24) as unknown as FilterEq;

    query = applyPillarVectorsTenantFilter(query, tid);

    const { data, error } = await (query as unknown as Promise<{
      data: VaultLineageRow[] | null;
      error: { message: string } | null;
    }>);

    if (error) {
      console.warn("[dev-event] vault lookup:", error.message);
      continue;
    }

    for (const row of filterPillarRowsByTenant((data ?? []) as VaultLineageRow[], tid)) {
      merged.set(row.id, row);
    }
    if (merged.size >= 12) break;
  }

  const rows = [...merged.values()];
  let best: { row: VaultLineageRow; score: number } | null = null;
  for (const row of rows) {
    const score = scoreVaultRow(row, activeNorm, tokens);
    if (!best || score > best.score) best = { row, score };
  }

  return { rows, best };
}

export function buildFailureBugIndex(activeFile: string): GenealogicalBugIndex {
  const mapped = pathToGenealogicalBugIndex(activeFile);
  return buildGenealogicalBugIndex({
    level_1_category: mapped.level_1_category,
    level_1_1_branch: mapped.level_1_1_branch,
    level_1_1_1_instance: "1.1.1_IDE_BUILD_FAILED",
  });
}

function buildHealCheapPrompt(params: {
  body: DevEventBody;
  bugIndex: GenealogicalBugIndex;
  vaultHints: string;
}): string {
  const excerpt = params.body.excerpt.trim().slice(0, 4000);
  return `You are MSGF Heal Cheap for IDE build failures. Map the error to our 1.1.1 genealogical fix tree.

Genealogical index:
- category: ${params.bugIndex.level_1_category}
- branch: ${params.bugIndex.level_1_1_branch}
- instance: ${params.bugIndex.level_1_1_1_instance}

Active file: ${params.body.activeFile}
Exit code: ${params.body.exitCode}

Prior Vault resolutions (tenant-scoped hints):
${params.vaultHints || "(none)"}

Build log excerpt:
${excerpt}

Reply with JSON only:
{"resolved":true|false,"fix_summary":"2-4 sentences engineering-safe","confidence":0-100}`;
}

type FlashHealJson = {
  resolved?: boolean;
  fix_summary?: string;
  confidence?: number;
};

async function runHealCheapGeminiFlash(prompt: string): Promise<FlashHealJson | null> {
  const apiKey = process.env.GCP_API_KEY?.trim();
  if (!apiKey) return null;

  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const gen = new GoogleGenerativeAI(apiKey);
    const model = gen.getGenerativeModel({ model: FLASH_MODEL });
    const res = await runWithLlmTimeoutSimple("dev_event.heal_cheap.flash", () =>
      model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 280 },
      })
    );
    const text = res.response.text()?.trim() ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[0]) as FlashHealJson;
  } catch (e) {
    if (isCostRunawayError(e)) throw e;
    console.warn("[dev-event] flash heal failed:", e);
    return null;
  }
}

function tokenEstimate(resolved: boolean, source: DevEventResolutionSource): DevEventHealResult["token_usage_estimate"] {
  const without_msgf =
    estimateHealTaskIndividualTokens("build.log", "inexpensive") || NAIVE_HEAL_CHEAP_TOKENS;
  const with_msgf =
    source === "vault_cache"
      ? 0
      : resolved
        ? HEAL_INEXPENSIVE_LLM_OVERHEAD + 120
        : HEAL_INEXPENSIVE_LLM_OVERHEAD;
  const tokens_saved = Math.max(0, without_msgf - with_msgf);
  const savings_pct =
    without_msgf > 0 ? Math.round((tokens_saved / without_msgf) * 1000) / 10 : 0;
  return { without_msgf, with_msgf, tokens_saved, savings_pct };
}

function vaultHintsFromRows(rows: VaultLineageRow[], limit = 4): string {
  return rows
    .slice(0, limit)
    .map((r) => `- ${r.content.slice(0, 220).replace(/\s+/g, " ")}`)
    .join("\n");
}

/**
 * Main handler — vault cache first, then single Flash heal.
 */
export async function runDevEventBuildHeal(params: {
  adminSupabase: SupabaseClient;
  entityId: string;
  body: DevEventBody;
}): Promise<DevEventHealResult> {
  const tenantId = params.body.tenantId.trim();
  const bugIndex = buildFailureBugIndex(params.body.activeFile);
  const { rows, best } = await fetchVaultResolutionsForActiveFile(
    params.adminSupabase,
    tenantId,
    params.body.activeFile,
    params.body.excerpt
  );

  let resolution_source: DevEventResolutionSource = "unresolved";
  let resolved = false;
  let fix_summary: string | null = null;
  let vault_match_id: string | null = null;

  if (best && best.score >= VAULT_MATCH_MIN_SCORE) {
    resolved = true;
    resolution_source = "vault_cache";
    vault_match_id = best.row.id;
    fix_summary = best.row.content.slice(0, 600).replace(/\s+/g, " ").trim();
  } else {
    const prompt = buildHealCheapPrompt({
      body: params.body,
      bugIndex,
      vaultHints: vaultHintsFromRows(
        rows.sort((a, b) => {
          const sa = scoreVaultRow(a, normalizeRelPath(params.body.activeFile), excerptTokens(params.body.excerpt));
          const sb = scoreVaultRow(b, normalizeRelPath(params.body.activeFile), excerptTokens(params.body.excerpt));
          return sb - sa;
        })
      ),
    });

    try {
      const flash = await runHealCheapGeminiFlash(prompt);
      if (flash?.resolved === true && flash.fix_summary?.trim()) {
        resolved = true;
        resolution_source = "gemini_flash";
        fix_summary = flash.fix_summary.trim().slice(0, 800);
      }
    } catch (e) {
      if (isCostRunawayError(e)) {
        await recordCostRunawayDeadLetterSafe({
          adminSupabase: params.adminSupabase,
          tenantId,
          entityId: params.entityId,
          operation: "dev_event.heal_cheap",
          error: e,
        });
      } else {
        throw e;
      }
    }
  }

  let narrative_log_id: string | undefined;

  let global_promotion_status: string | undefined;

  if (resolved && fix_summary) {
    const gateResult = await pulseEngine.persistLogicDeltaWithGate({
      adminSupabase: params.adminSupabase,
      entityId: params.entityId,
      tenantId,
      isAdmin: false,
      globalize: false,
      delta: {
        tenantId,
        entityId: params.entityId,
        content: fix_summary,
        summaryBeat: `IDE build_failed healed (exit ${params.body.exitCode})`,
        bugIndex,
        source: DEV_EVENT_LOGIC_DELTA_SOURCE,
        globalize: false,
        metadata: {
          brain_tier: MSGF_BRAIN_SMALL,
          dev_event_kind: params.body.kind,
          active_file: params.body.activeFile,
          exit_code: params.body.exitCode,
          resolution_source,
          vault_match_id,
        },
      },
      vaultPersist: () =>
        persistToVault({
          supabase: params.adminSupabase,
          entityId: params.entityId,
          tenantId,
          content: fix_summary,
          bugIndex,
          summaryBeat: `IDE build_failed healed (exit ${params.body.exitCode})`,
          legalVersion: CURRENT_LEGAL_VERSION,
          halScore: 88,
          actionType: "DEV_EVENT_BUILD_HEAL",
          narrativeExtra: {
            dev_event_kind: params.body.kind,
            active_file: params.body.activeFile,
            exit_code: params.body.exitCode,
            resolution_source,
            vault_match_id,
            logic_drift_bypassed: true,
            brain_tier: MSGF_BRAIN_SMALL,
          },
        }),
    });
    global_promotion_status = gateResult.promotion_status;
    narrative_log_id = gateResult.vaultNarrativeLogId;
  }

  const token_usage_estimate = tokenEstimate(resolved, resolution_source);

  void recordSavingsFeatureCount(tenantId, "dev_event");
  if (resolution_source === "vault_cache") {
    void recordSavingsFeatureCount(tenantId, "dev_event_vault_hit");
    void recordSavingsFeatureTokensSaved(
      tenantId,
      "dev_event_vault_hit",
      token_usage_estimate.tokens_saved
    );
  }

  return {
    ok: true,
    resolved,
    resolution_source,
    brain_tier: MSGF_BRAIN_SMALL,
    global_promotion_status,
    genealogical_bug_index: bugIndex,
    fix_summary,
    vault_match_id,
    narrative_log_id,
    token_usage_estimate,
  };
}
