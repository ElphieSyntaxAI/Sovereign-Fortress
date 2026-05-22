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
 * Distribution Build ID: MSGF-e3b90d5-20260522T030006Z-internal
 */
/**
 * Strip project-identifying content before persisting logic as global Brain / vault DNA.
 */

import type { MitigationAction } from "@/lib/schemas/mitigation-action";
import type { GenealogicalBugIndex } from "@/lib/schemas/vault-hall-metadata";

/** Same shape as {@link MitigationPromotionSnapshot} in msgf-rule-submissions (avoid circular import). */
export type SanitizableMitigationSnapshot = {
  bug_index: GenealogicalBugIndex;
  mitigation_action: MitigationAction;
  human_reasoning?: string;
  final_fix_applied?: string;
};

const UUID_RE =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;

/** Paths: Unix, Windows, and simple `src/...` segments */
const PATHLIKE_RE =
  /(?:\b[a-z]:\\|\\|\/)(?:[\w._\-]+\/|\\)*(?:[\w._\-]+\.(?:tsx?|jsx?|mjs|cjs|vue|svelte|py|rs|go|java|kt|cs|rb|php|md|json|ya?ml))\b/gi;

const EMAIL_RE = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/gi;

/**
 * Best-effort redaction for cross-tenant promotion — keeps remediation intent, removes obvious PII/infra noise.
 */
export function redactProjectSensitiveText(input: string): string {
  const s = input.trim();
  if (!s) return s;
  return s
    .replace(UUID_RE, "[uuid]")
    .replace(PATHLIKE_RE, "[path]")
    .replace(EMAIL_RE, "[email]");
}

export function sanitizeGenealogicalBugIndexForGlobal(
  bug: GenealogicalBugIndex
): GenealogicalBugIndex {
  return {
    level_1_category: redactProjectSensitiveText(bug.level_1_category),
    level_1_1_branch: redactProjectSensitiveText(bug.level_1_1_branch),
    level_1_1_1_instance: redactProjectSensitiveText(bug.level_1_1_1_instance),
  };
}

export function sanitizeMitigationActionForGlobal(
  m: MitigationAction
): MitigationAction {
  const label = m.label?.trim() ? redactProjectSensitiveText(m.label) : undefined;
  const fix = m.fix_template?.trim() ? redactProjectSensitiveText(m.fix_template) : undefined;
  return {
    ...m,
    ...(label !== undefined ? { label } : {}),
    ...(fix !== undefined ? { fix_template: fix } : {}),
    ...(m.bug_index
      ? { bug_index: sanitizeGenealogicalBugIndexForGlobal(m.bug_index) }
      : {}),
  };
}

/**
 * Prefer operator fix templates / summary over raw session capture when promoting to global vault.
 */
export function extractGlobalSafeVaultContent(payload: Record<string, unknown>): {
  content: string;
  summaryBeat: string;
} {
  const meta =
    payload.metadata && typeof payload.metadata === "object"
      ? (payload.metadata as Record<string, unknown>)
      : {};
  const mitigation =
    meta.mitigation && typeof meta.mitigation === "object"
      ? (meta.mitigation as Record<string, unknown>)
      : {};
  const fromMitigation =
    typeof mitigation.fix_template === "string" ? mitigation.fix_template.trim() : "";
  const rawContent = typeof payload.content === "string" ? payload.content.trim() : "";
  const summaryRaw =
    typeof payload.summary_beat === "string"
      ? payload.summary_beat.trim()
      : "Global promotion — validated logic pattern";

  const primary = fromMitigation || summaryRaw;
  const fallback = rawContent ? redactProjectSensitiveText(rawContent) : "";

  const content = redactProjectSensitiveText(primary || fallback || "Validated logic pattern (redacted).");
  const summaryBeat = redactProjectSensitiveText(
    summaryRaw.slice(0, 2000) || content.slice(0, 500)
  );

  return { content, summaryBeat: summaryBeat.slice(0, 2000) };
}

export function sanitizeMetadataForGlobalAudit(
  metadata: unknown
): Record<string, unknown> | null {
  if (!metadata || typeof metadata !== "object") return null;
  const m = metadata as Record<string, unknown>;
  const human =
    typeof m.human_reasoning === "string"
      ? redactProjectSensitiveText(m.human_reasoning).slice(0, 2000)
      : undefined;
  const strat =
    typeof m.remediation_strategy_label === "string"
      ? redactProjectSensitiveText(m.remediation_strategy_label).slice(0, 512)
      : undefined;
  const out: Record<string, unknown> = {};
  if (human) out.human_reasoning = human;
  if (strat) out.remediation_strategy_label = strat;
  return Object.keys(out).length ? out : null;
}

const FILENAME_TOKEN_RE =
  /\b[\w][\w.-]{0,80}\.(tsx?|jsx?|mjs|cjs|vue|svelte|py|rs|go|java|kt|cs|rb|php|md|json|ya?ml)\b/gi;

const DOMAINLIKE_RE = /\b[a-z0-9][a-z0-9-]{1,48}\.(com|io|dev|net|org|app|co)\b/gi;

/**
 * Cross-tenant **Global Insight** copy — strips paths, filenames, emails, UUIDs, obvious org domains.
 */
export function anonymizeInsightText(input: string): string {
  const s = redactProjectSensitiveText(input);
  return s
    .replace(FILENAME_TOKEN_RE, "[file]")
    .replace(DOMAINLIKE_RE, "[domain]")
    .replace(/\s+/g, " ")
    .trim();
}

export function sanitizeMitigationPromotionSnapshotForGlobal(
  snap: SanitizableMitigationSnapshot
): SanitizableMitigationSnapshot {
  const human = snap.human_reasoning?.trim()
    ? redactProjectSensitiveText(snap.human_reasoning)
    : undefined;
  const finalFix = snap.final_fix_applied?.trim()
    ? redactProjectSensitiveText(snap.final_fix_applied)
    : undefined;
  return {
    bug_index: sanitizeGenealogicalBugIndexForGlobal(snap.bug_index),
    mitigation_action: sanitizeMitigationActionForGlobal(snap.mitigation_action),
    ...(human ? { human_reasoning: human } : {}),
    ...(finalFix ? { final_fix_applied: finalFix } : {}),
  };
}
