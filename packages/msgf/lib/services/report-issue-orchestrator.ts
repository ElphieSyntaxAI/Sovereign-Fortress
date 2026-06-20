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
 * Distribution Build ID: MSGF-a7aa881-20260620T084430Z-internal
 */
/**
 * Unified issue report — incident upsert + dev handoff metadata.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { computeDevHandoff, recommendDevHealPath } from "@/lib/dev-heal-config";
import { SelfHealReportBodySchema } from "@/lib/schemas/diagnostic-snapshot";
import { upsertActiveIncidentReport } from "@/lib/services/active-incident-report";
import { persistSelfHealReport } from "@/lib/services/self-heal-report";
import { buildTenantSentinelSelfHealBody } from "@/lib/services/tenant-sentinel-response";

export type ReportIssueInput = {
  message: string;
  location: string;
  tenant_id: string;
  source?: "extension" | "web" | "api" | "sentinel";
  operator_note?: string;
  entity_id?: string;
  diagnostic_snapshot?: Record<string, unknown>;
};

export type ReportIssueResult =
  | {
      ok: true;
      dedupe_hash: string;
      occurrence_count: number;
      deduplicated: boolean;
      incident_id: string | null;
      dev_handoff: ReturnType<typeof computeDevHandoff>;
      recommended_path: "self" | "cloud";
      source: string;
      user_resume_message?: string;
      escalated_to_arbitrate?: boolean;
      reasoning_summary?: { headline: string; detail: string | null };
      logic_drift?: { band: string; escalated: boolean; score: number };
    }
  | { ok: false; error: string; detail?: string };

export async function orchestrateReportIssue(
  admin: SupabaseClient,
  input: ReportIssueInput
): Promise<ReportIssueResult> {
  const upsert = await upsertActiveIncidentReport(admin, {
    message: input.message,
    location: input.location,
    tenantId: input.tenant_id,
  });

  if (!upsert.ok) {
    return { ok: false, error: upsert.error, detail: upsert.detail };
  }

  const dev_handoff = computeDevHandoff({
    max_occurrence_count: upsert.occurrence_count,
    incident_id: upsert.id,
  });

  const base = {
    ok: true as const,
    dedupe_hash: upsert.dedupe_hash,
    occurrence_count: upsert.occurrence_count,
    deduplicated: upsert.deduplicated,
    incident_id: upsert.id,
    dev_handoff,
    recommended_path: recommendDevHealPath(dev_handoff),
    source: input.source ?? "api",
  };

  if (!input.diagnostic_snapshot) {
    return base;
  }

  const mergedSnapshot = {
    ...input.diagnostic_snapshot,
    operator_note: input.operator_note ?? input.message,
    tenant_id: input.tenant_id,
    source:
      typeof input.diagnostic_snapshot.source === "string"
        ? input.diagnostic_snapshot.source
        : "msgf_sentinel",
  };

  const parsed = SelfHealReportBodySchema.safeParse(mergedSnapshot);
  if (!parsed.success) {
    return {
      ...base,
      user_resume_message:
        "Incident recorded. Diagnostic snapshot could not run self-heal (invalid snapshot shape).",
    };
  }

  const entityId =
    parsed.data.entity_id ??
    parsed.data.author_id ??
    input.entity_id ??
    null;

  if (!entityId) {
    return {
      ...base,
      user_resume_message:
        "Incident recorded. Add entity_id to the snapshot for automatic self-heal.",
    };
  }

  try {
    const report = await persistSelfHealReport({
      adminSupabase: admin,
      body: parsed.data,
      entityId,
      tenantId: input.tenant_id,
    });
    const ui = buildTenantSentinelSelfHealBody(report);
    return {
      ...base,
      user_resume_message: ui.user_resume_message,
      escalated_to_arbitrate: report.escalated_to_arbitrate,
      reasoning_summary: ui.reasoning_summary,
      logic_drift: ui.logic_drift,
    };
  } catch (e) {
    console.error("[report-issue] self-heal branch failed", e);
    return {
      ...base,
      user_resume_message:
        "Incident recorded. Self-heal could not complete — ops may follow up in ARBITRATE.",
    };
  }
}
