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
 * Distribution Build ID: MSGF-b4dfaf97-20260922T171835Z-internal
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  pickBestVaultMatch,
  resolveMatchThreshold,
  type SentryCrashSignal,
  type VaultMatchCandidate,
} from "@/lib/services/sentry-vault-match";
import { appendVaultLog } from "@/lib/services/tenant-onboarding-vault";
import { hitFromVaultId, writeLiveP7 } from "@/lib/services/p7-observe";

export type QuarantineFromSentryResult = {
  quarantined: boolean;
  vectorId: string | null;
  confidence: number;
  reason: string;
};

async function loadVaultCandidates(
  admin: SupabaseClient,
  signal: SentryCrashSignal
): Promise<VaultMatchCandidate[]> {
  // Prefer scoped reads; fall back to broader vault sample when scopes missing.
  let query = admin
    .from("pillar_vectors")
    .select("id, content, metadata, quarantine_status")
    .eq("metadata->>ledger", "vault")
    .or("quarantine_status.is.null,quarantine_status.eq.NONE,quarantine_status.eq.RESTORED")
    .limit(80);

  if (signal.companyId?.trim()) {
    query = query.eq("metadata->>company_id", signal.companyId.trim()) as typeof query;
  }
  if (signal.projectOrigin?.trim()) {
    query = query.eq("metadata->>project_origin", signal.projectOrigin.trim()) as typeof query;
  }

  const { data, error } = await query;
  if (error) {
    console.warn("[sentry-vault] candidate load failed:", error.message);
    return [];
  }
  return (data ?? []) as VaultMatchCandidate[];
}

/**
 * Match crash to Vault rows; if confidence ≥ threshold, set QUARANTINED and log ops alert.
 * Never demotes to Hall (HITL is A3).
 */
export async function quarantineVaultFromSentryCrash(
  admin: SupabaseClient,
  signal: SentryCrashSignal,
  opts?: { threshold?: number }
): Promise<QuarantineFromSentryResult> {
  if (!signal.issueId?.trim()) {
    return { quarantined: false, vectorId: null, confidence: 0, reason: "missing_issue_id" };
  }

  const threshold = opts?.threshold ?? resolveMatchThreshold();
  const candidates = await loadVaultCandidates(admin, signal);
  const match = pickBestVaultMatch(signal, candidates, threshold);

  if (!match) {
    return {
      quarantined: false,
      vectorId: null,
      confidence: 0,
      reason: candidates.length ? "below_threshold" : "no_candidates",
    };
  }

  const now = new Date().toISOString();
  const reason = `Sentry issue ${signal.issueId}: ${signal.title}`.slice(0, 500);

  const { error } = await admin
    .from("pillar_vectors")
    .update({
      quarantine_status: "QUARANTINED",
      quarantine_reason: reason,
      quarantine_sentry_issue_id: signal.issueId,
      quarantine_at: now,
    })
    .eq("id", match.vectorId);

  if (error) {
    console.warn("[sentry-vault] quarantine update failed:", error.message);
    return {
      quarantined: false,
      vectorId: match.vectorId,
      confidence: match.confidence,
      reason: `update_failed:${error.message}`,
    };
  }

  const matched = candidates.find((c) => c.id === match.vectorId);
  const md = (matched?.metadata ?? {}) as Record<string, unknown>;
  const tenantId =
    (typeof md.tenant_id === "string" && md.tenant_id.trim()) ||
    signal.companyId?.trim() ||
    "system";
  writeLiveP7({
    admin,
    tenantId,
    traceId: `sentry_quarantine_${signal.issueId}`,
    blockHits: [hitFromVaultId(match.vectorId, true)],
    outcome: "block",
    decisionKind: "defend",
    routing: "sentry_quarantine",
    highDrift: true,
    defendReason: reason,
  });

  if (signal.companyId?.trim()) {
    try {
      await appendVaultLog(admin, signal.companyId.trim(), "sentry_vault_quarantine", {
        sentry_issue_id: signal.issueId,
        vector_id: match.vectorId,
        confidence: match.confidence,
        match_reasons: match.reasons,
        title: signal.title,
        project_origin: signal.projectOrigin ?? null,
        project_slug: signal.projectSlug ?? null,
        note: "Quarantined pending HITL on /admin/ops (no auto-Hall).",
      });
    } catch (e) {
      console.warn("[sentry-vault] ops alert log failed:", e);
    }
  }

  return {
    quarantined: true,
    vectorId: match.vectorId,
    confidence: match.confidence,
    reason: "quarantined",
  };
}

/** Parse common Sentry webhook / issue payload shapes into a crash signal. */
export function parseSentryWebhookPayload(
  body: unknown,
  headers?: Headers
): SentryCrashSignal | null {
  if (!body || typeof body !== "object") return null;
  const root = body as Record<string, unknown>;

  // Sentry issue alert: { action, data: { issue: {...} } } or event
  const data = (root.data && typeof root.data === "object" ? root.data : root) as Record<
    string,
    unknown
  >;
  const issue =
    (data.issue && typeof data.issue === "object" ? data.issue : null) ||
    (root.issue && typeof root.issue === "object" ? root.issue : null) ||
    (data.event && typeof data.event === "object" ? data.event : null) ||
    root;

  const issueObj = issue as Record<string, unknown>;
  const id =
    issueObj.id != null
      ? String(issueObj.id)
      : issueObj.issue_id != null
        ? String(issueObj.issue_id)
        : "";
  const title =
    typeof issueObj.title === "string"
      ? issueObj.title
      : typeof issueObj.message === "string"
        ? issueObj.message
        : "";
  if (!id || !title) return null;

  const project =
    issueObj.project && typeof issueObj.project === "object"
      ? (issueObj.project as { slug?: string })
      : null;

  const frames: SentryCrashSignal["frames"] = [];
  const entries =
    (issueObj.entries as unknown[]) ||
    ((issueObj.exception as { values?: unknown[] } | undefined)?.values as unknown[]) ||
    [];

  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const stacktrace =
      (e.stacktrace as { frames?: unknown[] } | undefined) ||
      ((e.data as { values?: Array<{ stacktrace?: { frames?: unknown[] } }> } | undefined)
        ?.values?.[0]?.stacktrace as { frames?: unknown[] } | undefined);
    const list = stacktrace?.frames ?? [];
    for (const fr of list) {
      if (!fr || typeof fr !== "object") continue;
      const f = fr as Record<string, unknown>;
      frames.push({
        filename: typeof f.filename === "string" ? f.filename : null,
        abs_path: typeof f.abs_path === "string" ? f.abs_path : null,
        function: typeof f.function === "string" ? f.function : null,
        module: typeof f.module === "string" ? f.module : null,
        context_line: typeof f.context_line === "string" ? f.context_line : null,
      });
    }
  }

  const tags = Array.isArray(issueObj.tags) ? issueObj.tags : [];
  let companyId: string | null = null;
  let projectOrigin: string | null = null;
  for (const t of tags) {
    if (!t || typeof t !== "object") continue;
    const tag = t as { key?: string; value?: string };
    if (tag.key === "company_id" && tag.value) companyId = tag.value;
    if (tag.key === "project_origin" && tag.value) projectOrigin = tag.value;
  }

  // Allow explicit fields on body for mock / ops inject
  if (typeof root.company_id === "string") companyId = root.company_id;
  if (typeof root.project_origin === "string") projectOrigin = root.project_origin;
  if (typeof headers?.get("x-msgf-company-id") === "string") {
    companyId = headers.get("x-msgf-company-id");
  }
  if (typeof headers?.get("x-msgf-project-origin") === "string") {
    projectOrigin = headers.get("x-msgf-project-origin");
  }

  return {
    issueId: id,
    title,
    culprit: typeof issueObj.culprit === "string" ? issueObj.culprit : null,
    projectSlug: project?.slug ?? (typeof root.project_slug === "string" ? root.project_slug : null),
    release: typeof issueObj.release === "string" ? issueObj.release : null,
    companyId,
    projectOrigin,
    frames,
  };
}

export function verifySentryWebhookAuth(rawBody: string, headers: Headers): boolean {
  const secret = process.env.SENTRY_WEBHOOK_SECRET?.trim();
  if (!secret) {
    const ops = process.env.MSGF_OPS_CRON_SECRET?.trim();
    const auth = headers.get("authorization")?.trim();
    return Boolean(ops && auth === `Bearer ${ops}`);
  }

  const auth = headers.get("authorization")?.trim();
  if (auth === `Bearer ${secret}`) return true;

  // Simple shared-secret header used by Sentry internal integrations / custom hooks
  const hdr = headers.get("sentry-hook-signature") || headers.get("x-sentry-webhook-secret");
  return Boolean(hdr && hdr === secret);
}
