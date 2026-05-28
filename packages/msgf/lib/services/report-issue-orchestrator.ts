/**
 * Unified issue report — incident upsert + dev handoff metadata.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { computeDevHandoff, recommendDevHealPath } from "@/lib/dev-heal-config";
import { upsertActiveIncidentReport } from "@/lib/services/active-incident-report";

export type ReportIssueInput = {
  message: string;
  location: string;
  tenant_id: string;
  source?: "extension" | "web" | "api" | "sentinel";
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

  return {
    ok: true,
    dedupe_hash: upsert.dedupe_hash,
    occurrence_count: upsert.occurrence_count,
    deduplicated: upsert.deduplicated,
    incident_id: upsert.id,
    dev_handoff,
    recommended_path: recommendDevHealPath(dev_handoff),
    source: input.source ?? "api",
  };
}
