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
 * Distribution Build ID: MSGF-f70c13c-20260519T044237Z-internal
 */
import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import path from "path";

import { determineBranch, determineCategory } from "@/lib/services/IngestService";
import { sweepAndIngest } from "@/lib/msgf-ingest";
import { deriveProjectOrigin } from "@/lib/services/tenant-ingest-metadata";
import {
  bootstrapTenantBrain,
  computeBrainReadiness,
} from "@/lib/services/brain-readiness";
import { createAdminClient } from "@/utils/supabase/admin";
import { getVertexGenerativeModelForId } from "@/packages/core/src/msgf-vertex";
import {
  isTenantApiKeyConfigured,
  resolveTenantIdFromApiKey,
} from "@/lib/api-key-tenant";
import { assertPathsAllowedForTenant } from "@/lib/tenant-silo";
import { logIdentityViolation } from "@/lib/identity-violation-log";
import { resolveCreditGuardGeminiModelId } from "@/lib/creditGuard";
import {
  endTenantCreditReservation,
  shouldReserveForIngestWithFiles,
  startTenantCreditReservation,
  type CreditReservationStart,
} from "@/lib/credit-reservation";
import { isCostRunawayError, runWithLlmTimeoutSimple } from "@/lib/services/cost-runaway-guard";
import { recordCostRunawayDeadLetterSafe } from "@/lib/services/llm-dead-letter";

type IngestFile = { path: string; content: string };

type IngestBody = {
  tenant_id?: string;
  /** Repo / monorepo tag for dashboard log filters (e.g. `apps/author-ecosystem`). */
  project_origin?: string;
  files?: IngestFile[];
};

function normalizeRelPath(p: string): string | null {
  const x = p.replace(/\\/g, "/").replace(/^\.\/+/, "");
  if (!x || x.includes("..") || x.startsWith("/")) return null;
  return x;
}

function getApiKey(req: NextRequest): string | null {
  const h = req.headers.get("x-msgf-api-key");
  if (h?.trim()) return h.trim();
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer "))
    return auth.slice(7).trim();
  return null;
}

function buildLineageMap(files: IngestFile[]) {
  return files.map((file) => ({
    path: file.path,
    category_1_0: determineCategory(file.path),
    branch_1_1: determineBranch(file.path),
    instance_1_1_1: "1.1.1",
  }));
}

async function summarizeForAudit(
  req: NextRequest,
  files: IngestFile[],
  lineageMap: ReturnType<typeof buildLineageMap>
) {
  const model = getVertexGenerativeModelForId(resolveCreditGuardGeminiModelId(req));
  const joined = files
    .map((f) => `## ${f.path}\n${f.content}`)
    .join("\n\n")
    .slice(0, 120000);

  const prompt = `Create a markdown report titled "pre_ingestion_audit.md" for MSGF V3.2 ULTRA.

Include:
1) Codebase overview by module
2) Risk hotspots for refactor
3) Suggested shard strategy for 1.0 / 1.1 / 1.1.1
4) Data-safety notes
5) Immediate next steps

Lineage map draft:
${JSON.stringify(lineageMap, null, 2)}

Codebase content:
${joined}
`;

  const result = await runWithLlmTimeoutSimple("ingest.pre_audit_summary", () =>
    model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
    })
  );
  return result.response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
}

export async function POST(req: NextRequest) {
  const ingestRequestId = randomUUID();
  try {
    const body = (await req.json()) as IngestBody;
    const files = Array.isArray(body?.files) ? body.files : [];

    const normalizedPaths: string[] = [];
    for (const f of files) {
      const np = normalizeRelPath(f.path);
      if (!np) {
        return NextResponse.json(
          { error: `Invalid or unsafe path: ${f.path}` },
          { status: 400 }
        );
      }
      normalizedPaths.push(np);
    }

    const tenantId =
      body.tenant_id?.trim() ||
      process.env.MSGF_INGEST_DEFAULT_AUTHOR_ID ||
      "00000000-0000-4000-8000-000000000001";

    if (!body.tenant_id?.trim() && isTenantApiKeyConfigured()) {
      return NextResponse.json(
        { error: "tenant_id is required when MSGF_TENANT_API_KEYS is set." },
        { status: 400 }
      );
    }

    if (isTenantApiKeyConfigured()) {
      const claimed = body.tenant_id?.trim();
      if (!claimed) {
        await logIdentityViolation({
          source: "ingest_api",
          reason: "missing_tenant_id",
        });
        return NextResponse.json(
          { error: "tenant_id is required when MSGF_TENANT_API_KEYS is set." },
          { status: 400 }
        );
      }
      const apiKey = getApiKey(req);
      const resolved = resolveTenantIdFromApiKey(apiKey);
      if (!apiKey || !resolved || resolved !== claimed) {
        await logIdentityViolation({
          source: "ingest_api",
          reason: "tenant_api_key_mismatch",
          claimed_tenant_id: claimed,
          resolved_tenant_id: resolved ?? null,
        });
        return NextResponse.json(
          { error: "Identity violation: tenant_id does not match API key." },
          { status: 403 }
        );
      }
      if (normalizedPaths.length > 0) {
        const silo = assertPathsAllowedForTenant(resolved, normalizedPaths);
        if (!silo.ok) {
        await logIdentityViolation({
          source: "ingest_api",
          reason: "path_silo_violation",
          tenant_id: resolved,
          violations: silo.violations,
        });
        return NextResponse.json(
          {
            error: "Identity violation: one or more paths are outside this tenant silo.",
            violations: silo.violations,
          },
          { status: 403 }
        );
        }
      }
    }

    const admin = createAdminClient();
    const pillarBootstrap = await bootstrapTenantBrain(admin, tenantId);

    const idempotencyKey =
      req.headers.get("Idempotency-Key")?.trim() ||
      req.headers.get("x-msgf-idempotency-key")?.trim() ||
      ingestRequestId;

    let creditStart: CreditReservationStart = { enabled: false };
    if (shouldReserveForIngestWithFiles(normalizedPaths.length)) {
      creditStart = await startTenantCreditReservation(admin, tenantId, idempotencyKey);
      if (creditStart.enabled && creditStart.insufficient) {
        return NextResponse.json({ error: "INSUFFICIENT_FUNDS" }, { status: 402 });
      }
    }

    try {
      const lineageMap = buildLineageMap(files);
      let ingestAudit = "- [SKIP] No files provided — pillar bootstrap only.\n";
      let ingestedCount = 0;
      let skippedBaseline = true;

      const ingestFiles: IngestFile[] = normalizedPaths.map((path, i) => ({
        path,
        content: files[i]?.content ?? "",
      }));
      const projectOrigin = deriveProjectOrigin(ingestFiles, body.project_origin);

      if (normalizedPaths.length > 0) {
        const sweep = await sweepAndIngest({
          files: ingestFiles,
          tenantId,
          supabase: admin,
          projectOrigin,
        });
        ingestAudit = sweep.auditLog;
        ingestedCount = sweep.ingested;
        skippedBaseline = sweep.skippedBaseline;
      }

      const readiness = await computeBrainReadiness(admin, tenantId);

      if (normalizedPaths.length > 0) {
        const aiAudit = await summarizeForAudit(req, files, lineageMap);
        const finalAuditDoc = [
          "# pre_ingestion_audit.md",
          "",
          "## Lineage Map",
          "```json",
          JSON.stringify(lineageMap, null, 2),
          "```",
          "",
          "## SWEEP Ingestion Log",
          ingestAudit,
          "",
          "## Gemini 2.5 Flash Audit Summary",
          aiAudit || "_No summary generated._",
          "",
          "## Brain Readiness",
          JSON.stringify(
            {
              readiness_score: readiness.readiness_score,
              brain_fully_initialized: readiness.brain_fully_initialized,
            },
            null,
            2
          ),
          "",
        ].join("\n");

        await writeFile(path.join(process.cwd(), "pre_ingestion_audit.md"), finalAuditDoc, "utf8");
      }

      const message =
        normalizedPaths.length > 0
          ? "SWEEP complete. pre_ingestion_audit.md saved to project root."
          : "Pillar bootstrap complete (no files ingested).";

      const response = NextResponse.json({
        ok: true,
        message,
        tenant_id: tenantId,
        project_origin: projectOrigin,
        lineage_map: lineageMap,
        readiness_score: readiness.readiness_score,
        brain_fully_initialized: readiness.brain_fully_initialized,
        is_pillar_baseline_set: readiness.is_pillar_baseline_set,
        pillars_present: readiness.pillars_present,
        pillars_required: readiness.pillars_required,
        missing_pillars: readiness.missing_pillars,
        baseline_training_required: readiness.baseline_training_required,
        baseline_training_remaining: readiness.baseline_training_remaining,
        pledge_signed: readiness.pledge_signed,
        skipped_baseline_creation: skippedBaseline,
        ingested_count: ingestedCount,
        pillars_created: pillarBootstrap.pillars_created,
      });

      await endTenantCreditReservation(admin, creditStart, response.status);
      return response;
    } catch (inner: unknown) {
      await endTenantCreditReservation(admin, creditStart, 500);
      if (isCostRunawayError(inner)) {
        await recordCostRunawayDeadLetterSafe({
          adminSupabase: admin,
          tenantId,
          entityId: tenantId,
          traceId: ingestRequestId,
          operation: "ingest.summarize_for_audit",
          error: inner,
        });
        return NextResponse.json(
          {
            error: "INGEST_LLM_GUARD",
            detail:
              inner instanceof Error ? inner.message : "LLM request aborted or recursion cap exceeded.",
          },
          { status: 503 }
        );
      }
      throw inner;
    }
  } catch (err: any) {
    console.error("MSGF ingest route error", err);
    return NextResponse.json(
      { error: err?.message || "Failed to run SWEEP protocol." },
      { status: 500 }
    );
  }
}

