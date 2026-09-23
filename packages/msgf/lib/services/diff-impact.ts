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
 * Distribution Build ID: MSGF-1826a636-20260922T234439Z-internal
 */
/**
 * Diff impact report — paths → P7 / Vault-Hall governance memory blast radius.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { emitPlatformAudit } from "@/lib/services/emit-platform-audit";

export type DiffImpactFile = { path: string; patch?: string | null };

export type DiffImpactReport = {
  id: string;
  tenant_id: string;
  project_origin: string | null;
  score: "green" | "yellow" | "red";
  touched_paths: string[];
  hall_risk: Array<{ resource_key: string; file_path: string | null }>;
  vault_at_risk: Array<{ resource_key: string; file_path: string | null }>;
  auto_green_blockers: string[];
  summary: string;
  created_at: string;
};

function scoreFromSignals(hallHits: number, blockers: string[]): DiffImpactReport["score"] {
  if (hallHits > 0 || blockers.length > 0) return "red";
  if (hallHits === 0 && blockers.length === 0) return "green";
  return "yellow";
}

export async function computeDiffImpact(
  admin: SupabaseClient,
  opts: {
    tenant_id: string;
    project_origin?: string | null;
    files: DiffImpactFile[];
    trace_id?: string | null;
  }
): Promise<DiffImpactReport> {
  const tid = opts.tenant_id.trim();
  const paths = opts.files.map((f) => f.path.trim()).filter(Boolean);
  const created_at = new Date().toISOString();

  const hall_risk: DiffImpactReport["hall_risk"] = [];
  const vault_at_risk: DiffImpactReport["vault_at_risk"] = [];
  const auto_green_blockers: string[] = [];

  if (paths.length > 0) {
    const { data: impact } = await admin
      .from("msgf_source_downstream_impact")
      .select("resource_key, file_path, attribution_class")
      .eq("tenant_id", tid)
      .in(
        "file_path",
        paths.slice(0, 40)
      )
      .limit(80);

    for (const row of impact ?? []) {
      const rk = typeof row.resource_key === "string" ? row.resource_key : "";
      const fp = typeof row.file_path === "string" ? row.file_path : null;
      const attr = typeof row.attribution_class === "string" ? row.attribution_class : "";
      if (attr === "copyleft_risk" || attr === "untrusted_external") {
        auto_green_blockers.push(`${rk}:${attr}`);
      }
      if (rk.startsWith("hall:") || attr === "untrusted_external") {
        hall_risk.push({ resource_key: rk, file_path: fp });
      } else {
        vault_at_risk.push({ resource_key: rk, file_path: fp });
      }
    }
  }

  // Reputation demotions touching same paths
  const { data: demoted } = await admin
    .from("msgf_resource_reputation")
    .select("resource_key, file_path, reputation_score")
    .eq("tenant_id", tid)
    .lt("reputation_score", -0.3)
    .limit(20);

  for (const row of demoted ?? []) {
    const fp = typeof row.file_path === "string" ? row.file_path : "";
    if (fp && paths.some((p) => p === fp || p.endsWith(fp) || fp.endsWith(p))) {
      hall_risk.push({
        resource_key: String(row.resource_key),
        file_path: fp || null,
      });
    }
  }

  const score = scoreFromSignals(hall_risk.length, auto_green_blockers);
  const id = createReportId(tid, opts.trace_id, created_at);
  const summary = `Diff impact ${score}: ${paths.length} paths, ${hall_risk.length} hall risks, ${auto_green_blockers.length} auto-GREEN blockers`;

  const report: DiffImpactReport = {
    id,
    tenant_id: tid,
    project_origin: opts.project_origin ?? null,
    score,
    touched_paths: paths,
    hall_risk: hall_risk.slice(0, 40),
    vault_at_risk: vault_at_risk.slice(0, 40),
    auto_green_blockers: [...new Set(auto_green_blockers)].slice(0, 20),
    summary,
    created_at,
  };

  emitPlatformAudit(admin, {
    product: "msgf",
    tenant_id: tid,
    kind: "diff_impact",
    severity: score === "red" ? "error" : score === "yellow" ? "warn" : "info",
    trace_id: opts.trace_id ?? null,
    ref_table: "diff_impact",
    ref_id: id,
    summary,
    metadata: {
      score,
      path_count: paths.length,
      project_origin: opts.project_origin ?? null,
    },
  });

  return report;
}

function createReportId(tenantId: string, traceId: string | null | undefined, ts: string): string {
  const base = `${tenantId}:${traceId ?? ""}:${ts}`;
  let h = 0;
  for (let i = 0; i < base.length; i++) h = (h * 31 + base.charCodeAt(i)) >>> 0;
  return `di_${h.toString(16)}_${Date.now().toString(36)}`;
}
