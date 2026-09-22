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
/**
 * DEFEND guards for document compiler commit (shadow preflight + dual structure review).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { generateCompilerBullets, hasGeminiCredentials } from "./llm-adapter";
import { parseJsonStripFences } from "./parse-json";
import type { CompilerBeatArtifact, CompilerWikiArtifact } from "./types";

export type DocumentCompilerShadowResult = {
  enabled: boolean;
  tier: "GREEN" | "YELLOW" | "RED";
  blocked: boolean;
  reason: string;
  vault_match: boolean;
  hall_match: boolean;
};

export type StructureMergeRisk = {
  risk: boolean;
  reason: string;
  table_row_estimate: number;
  wiki_count: number;
  beat_count: number;
};

export type DualStructureReview = {
  ran: boolean;
  structure_valid: boolean | null;
  models_disagree: boolean;
  reviewer_a: string | null;
  reviewer_b: string | null;
  reason: string;
};

function shadowEnabled(): boolean {
  const off = process.env.MSGF_DOCUMENT_INGEST_SHADOW?.trim().toLowerCase();
  return off !== "0" && off !== "false" && off !== "off";
}

function extractTableRowEstimate(sourceText: string): number {
  const tableBeats = (sourceText.match(/^[^\n]*\t[^\n\t]+\t/gm) ?? []).length;
  const markdownRows = (sourceText.match(/^\|.+\|$/gm) ?? []).filter(
    (l) => !/^\|\s*-+\s*\|/.test(l)
  ).length;
  const tabRows = (sourceText.match(/^[^\n]*\t[^\n\t]+\t/gm) ?? []).length;
  return Math.max(tableBeats, markdownRows, tabRows);
}

export function buildCommitPreviewText(params: {
  domain_profile: string;
  filename: string;
  sourceText: string;
  proposed: CompilerWikiArtifact[];
  outlineBeats: CompilerBeatArtifact[];
}): string {
  const wikiLines = params.proposed.slice(0, 12).map((p, i) => {
    const ex = p.excerpt.replace(/\s+/g, " ").trim().slice(0, 220);
    return `${i + 1}. ${p.title}: ${ex}`;
  });
  const beatLines = params.outlineBeats.slice(0, 12).map((b, i) => {
    const syn = b.synopsis.replace(/\s+/g, " ").trim().slice(0, 180);
    return `${i + 1}. ${syn}`;
  });
  return [
    `document_compiler domain=${params.domain_profile} file=${params.filename}`,
    `wiki_entries=${params.proposed.length} outline_beats=${params.outlineBeats.length}`,
    "",
    "PROPOSED_WIKI:",
    ...wikiLines,
    "",
    "OUTLINE_BEATS:",
    ...beatLines,
    "",
    "SOURCE_EXCERPT:",
    params.sourceText.slice(0, 6000),
  ].join("\n");
}

export function detectStructureMergeRisk(
  sourceText: string,
  proposed: CompilerWikiArtifact[],
  outlineBeats: CompilerBeatArtifact[]
): StructureMergeRisk {
  const tableRowEstimate = extractTableRowEstimate(sourceText);
  const wiki_count = proposed.length;
  const beat_count = outlineBeats.length;

  if (tableRowEstimate >= 3 && wiki_count <= 2 && beat_count <= 2) {
    return {
      risk: true,
      reason:
        "Tabular document (tables/tabs) mapped to very few wiki entries and beats — likely merged into one blob.",
      table_row_estimate: tableRowEstimate,
      wiki_count,
      beat_count,
    };
  }

  if (
    tableRowEstimate >= 4 &&
    beat_count >= 3 &&
    wiki_count > 0 &&
    wiki_count < Math.max(2, Math.floor(beat_count / 2))
  ) {
    return {
      risk: true,
      reason: "Many table rows detected but wiki entries do not cover row-level facts.",
      table_row_estimate: tableRowEstimate,
      wiki_count,
      beat_count,
    };
  }

  return {
    risk: false,
    reason: "",
    table_row_estimate: tableRowEstimate,
    wiki_count,
    beat_count,
  };
}

function parseStructureVerdict(raw: string): { structure_valid: boolean; reason: string } {
  let s = String(raw || "").trim();
  const fence = s.match(/^```(?:json)?\s*([\s\S]*?)```/im);
  if (fence) s = fence[1].trim();
  try {
    const j = parseJsonStripFences(s) as { structure_valid?: boolean; reason?: string };
    return {
      structure_valid: j.structure_valid !== false,
      reason: String(j.reason ?? "").slice(0, 500),
    };
  } catch {
    const lower = s.toLowerCase();
    if (/structure_valid\s*[:=]\s*false/.test(lower) || /\bnot valid\b/.test(lower)) {
      return { structure_valid: false, reason: s.slice(0, 500) };
    }
    return { structure_valid: true, reason: s.slice(0, 500) };
  }
}

const DUAL_REVIEW_SYSTEM = [
  "You review document ingest mappings.",
  "Check whether proposed wiki entries and outline beats preserve tabular/table row structure (one row → one beat/entry when appropriate).",
  'Output ONLY JSON: {"structure_valid":true|false,"reason":"string"}',
].join("\n");

export async function runDualStructureReview(params: {
  sourceText: string;
  preview: string;
}): Promise<DualStructureReview> {
  if (!hasGeminiCredentials()) {
    return {
      ran: false,
      structure_valid: null,
      models_disagree: false,
      reviewer_a: null,
      reviewer_b: null,
      reason: "Dual review skipped — no LLM key.",
    };
  }

  const userPrompt = [
    "Document excerpt:",
    params.sourceText.slice(0, 8000),
    "",
    "Proposed mapping preview:",
    params.preview.slice(0, 8000),
  ].join("\n");

  try {
    const [rawA, rawB] = await Promise.all([
      generateCompilerBullets({
        system: `${DUAL_REVIEW_SYSTEM}\nReviewer role: strict table-row preservation.`,
        user: userPrompt,
      }),
      generateCompilerBullets({
        system: `${DUAL_REVIEW_SYSTEM}\nReviewer role: conservative — flag only clear table-merge failures.`,
        user: userPrompt,
      }),
    ]);
    const a = parseStructureVerdict(rawA);
    const b = parseStructureVerdict(rawB);
    const disagree = a.structure_valid !== b.structure_valid;
    const structure_valid = disagree ? false : a.structure_valid && b.structure_valid;
    return {
      ran: true,
      structure_valid,
      models_disagree: disagree,
      reviewer_a: a.reason || null,
      reviewer_b: b.reason || null,
      reason: disagree
        ? "Dual reviewers disagree on whether tabular structure was preserved."
        : structure_valid
          ? "Dual review: structure mapping acceptable."
          : a.reason || b.reason || "Dual review: structure mapping invalid.",
    };
  } catch (e) {
    return {
      ran: false,
      structure_valid: null,
      models_disagree: false,
      reviewer_a: null,
      reviewer_b: null,
      reason: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function runDocumentCompilerShadowPreflight(
  supabase: SupabaseClient,
  tenantId: string,
  previewText: string
): Promise<DocumentCompilerShadowResult> {
  if (!shadowEnabled()) {
    return {
      enabled: false,
      tier: "GREEN",
      blocked: false,
      reason: "Shadow preflight disabled (MSGF_DOCUMENT_INGEST_SHADOW=off).",
      vault_match: false,
      hall_match: false,
    };
  }

  try {
    const { runDefendPreflight } = await import("@/lib/defend-preflight");
    const result = await runDefendPreflight(supabase, { text: previewText }, { tenantId });
    return {
      enabled: true,
      tier: result.tier,
      blocked: result.blocked,
      reason: result.reason,
      vault_match: Boolean(result.vaultMatch),
      hall_match: Boolean(result.hallMatch),
    };
  } catch (e) {
    console.warn("[document-compiler/defend-guard] shadow preflight unavailable", e);
    return {
      enabled: false,
      tier: "YELLOW",
      blocked: false,
      reason: "Shadow preflight skipped (MSGF module unavailable).",
      vault_match: false,
      hall_match: false,
    };
  }
}

export type DocumentCompilerDefendResult = {
  shadow: DocumentCompilerShadowResult;
  merge_risk: StructureMergeRisk;
  dual_review: DualStructureReview;
  blocked: boolean;
  block_reason: string;
};

export async function runDocumentCompilerDefend(params: {
  supabase: SupabaseClient;
  tenantId: string;
  sourceText: string;
  previewText: string;
  proposed: CompilerWikiArtifact[];
  outlineBeats: CompilerBeatArtifact[];
  forceCommit?: boolean;
}): Promise<DocumentCompilerDefendResult> {
  const shadow = await runDocumentCompilerShadowPreflight(
    params.supabase,
    params.tenantId,
    params.previewText
  );
  const merge_risk = detectStructureMergeRisk(params.sourceText, params.proposed, params.outlineBeats);
  const dual_review = await runDualStructureReview({
    sourceText: params.sourceText,
    preview: params.previewText,
  });

  let blocked = false;
  let block_reason = "";

  if (!params.forceCommit) {
    if (shadow.blocked) {
      blocked = true;
      block_reason = shadow.reason || "Shadow preflight blocked commit.";
    } else if (merge_risk.risk) {
      blocked = true;
      block_reason = merge_risk.reason;
    } else if (dual_review.ran && dual_review.structure_valid === false) {
      blocked = true;
      block_reason = dual_review.reason || "Dual structure review failed.";
    }
  }

  return { shadow, merge_risk, dual_review, blocked, block_reason };
}
