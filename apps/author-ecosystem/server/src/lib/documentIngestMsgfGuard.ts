import { createRequire } from "node:module";

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  DocumentIngestSlot,
  IngestOutlineBeat,
  ProposedWikiEntry,
} from "./documentIngestGate.js";
import { extractBeatsFromTables } from "./documentIngestOutline.js";
import type { ClarifyingQuestion, IngestConflict } from "./documentIngestStructure.js";

const require = createRequire(import.meta.url);
const { generateBullets, hasGeminiCredentials } = require("../services/geminiClient.js") as {
  generateBullets: (opts: { system: string; user: string; model?: string }) => Promise<string>;
  hasGeminiCredentials: () => boolean;
};

export type DocumentIngestShadowResult = {
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

export function buildCommitPreviewText(params: {
  slot: DocumentIngestSlot;
  filename: string;
  sourceText: string;
  proposed: ProposedWikiEntry[];
  outlineBeats: IngestOutlineBeat[];
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
    `author_document_ingest slot=${params.slot} file=${params.filename}`,
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
  proposed: ProposedWikiEntry[],
  outlineBeats: IngestOutlineBeat[]
): StructureMergeRisk {
  const tableBeats = extractBeatsFromTables(sourceText);
  const markdownRows = (sourceText.match(/^\|.+\|$/gm) ?? []).filter(
    (l) => !/^\|\s*-+\s*\|/.test(l)
  ).length;
  const tabRows = (sourceText.match(/^[^\n]*\t[^\n\t]+\t/gm) ?? []).length;
  const tableRowEstimate = Math.max(tableBeats.length, markdownRows, tabRows);

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
    const j = JSON.parse(s) as { structure_valid?: boolean; reason?: string };
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
  "You review AUTHOR document ingest mappings.",
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
      generateBullets({
        system: `${DUAL_REVIEW_SYSTEM}\nReviewer role: strict table-row preservation.`,
        user: userPrompt,
      }),
      generateBullets({
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

export async function runDocumentIngestShadowPreflight(
  supabase: SupabaseClient,
  tenantId: string,
  previewText: string
): Promise<DocumentIngestShadowResult> {
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
    const { preFlightCheck } = await import("msgf/lib/msgf-shadow");
    const result = await preFlightCheck(supabase, { text: previewText }, { tenantId });
    return {
      enabled: true,
      tier: result.tier,
      blocked: result.blocked,
      reason: result.reason,
      vault_match: Boolean(result.vaultMatch),
      hall_match: Boolean(result.hallMatch),
    };
  } catch (e) {
    console.warn("[documentIngestMsgfGuard] shadow preflight unavailable", e);
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

export async function recordIngestHallRejection(params: {
  supabase: SupabaseClient;
  tenantId: string;
  entityId: string;
  manuscriptId: string;
  slot: DocumentIngestSlot;
  sessionId: string;
  reason: string;
  previewText: string;
  code:
    | "user_reject"
    | "commit_failed"
    | "shadow_block"
    | "structure_dual_fail"
    | "structure_merge_risk";
}): Promise<{ recorded: boolean; narrativeLogId?: string }> {
  try {
    const { persistToHall } = await import("msgf/lib/services/constraint-ledger");
    const { PULSE_BUG_INDEX } = await import("msgf/lib/schemas/vault-hall-metadata");

    const bugIndex =
      params.code === "shadow_block"
        ? PULSE_BUG_INDEX.authorIngestShadowBlock
        : PULSE_BUG_INDEX.authorIngestBadMapping;

    const content = [
      `author_document_ingest rejection code=${params.code}`,
      `manuscript=${params.manuscriptId} session=${params.sessionId} slot=${params.slot}`,
      `reason=${params.reason}`,
      "",
      params.previewText.slice(0, 4000),
    ].join("\n");

    const result = await persistToHall({
      supabase: params.supabase,
      entityId: params.entityId,
      tenantId: params.tenantId,
      content,
      bugIndex,
      reason: params.reason,
      tier: params.code === "shadow_block" ? "RED" : "YELLOW",
      actionType: "AUTHOR_DOCUMENT_INGEST_HALL",
      severity: params.code === "shadow_block" ? "Violation" : "Warning",
      narrativeExtra: {
        ingest_session_id: params.sessionId,
        manuscript_id: params.manuscriptId,
        slot: params.slot,
        rejection_code: params.code,
      },
    });

    return { recorded: true, narrativeLogId: result.narrativeLogId };
  } catch (e) {
    console.warn("[documentIngestMsgfGuard] Hall persist failed", e);
    return { recorded: false };
  }
}

export function sessionHadBlockingClarification(
  clarifyingQuestions: ClarifyingQuestion[] | null | undefined
): boolean {
  return (clarifyingQuestions ?? []).some((q) => q.required);
}

export function sessionHadBlockingConflicts(
  conflicts: IngestConflict[] | null | undefined
): boolean {
  return (conflicts ?? []).some((c) => c.severity === "blocking");
}
