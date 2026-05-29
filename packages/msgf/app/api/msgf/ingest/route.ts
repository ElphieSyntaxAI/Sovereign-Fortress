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
 * Distribution Build ID: MSGF-c103094-20260526T230730Z-internal
 */
import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import path from "path";

import {
  buildIngestLineageForFile,
  type IngestFile,
} from "@/lib/services/IngestService";
import { sweepAndIngest } from "@/lib/msgf-ingest";
import {
  IngestValidationError,
  parseIngestRequestBody,
} from "@/lib/schemas/ingest-metadata";
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
  resolveIngestCreditReserveAmount,
  shouldReserveForIngestWithFiles,
  startTenantCreditReservation,
  type CreditReservationStart,
} from "@/lib/credit-reservation";
import { incrementUsageMonitorTokens } from "@/lib/usage-monitor";
import {
  isIngestAuditSkipOnHashHit,
  partitionIngestFilesByContentHash,
  updateIngestHashesAfterSweep,
} from "@/lib/services/ingest-hash-cache";
import { recordSavingsFeatureCount } from "@/lib/services/savings-features-stats";
import { isCostRunawayError, runWithLlmTimeoutSimple } from "@/lib/services/cost-runaway-guard";
import { recordCostRunawayDeadLetterSafe } from "@/lib/services/llm-dead-letter";
import { preFlightCheck } from "@/lib/msgf-shadow";
import { verifyIdeToken } from "@/lib/services/ide-token-service";
import { MSGF_TENANT_KEY_HEADER } from "@/lib/msgf-http-headers";

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

async function resolveIngestEntityId(
  admin: ReturnType<typeof createAdminClient>,
  req: NextRequest,
  tenantId: string
): Promise<string | undefined> {
  const apiKey = getApiKey(req);
  if (!apiKey?.startsWith("msgf_ide_")) return undefined;
  const tenantKey =
    req.headers.get(MSGF_TENANT_KEY_HEADER)?.trim() || tenantId;
  const verified = await verifyIdeToken(admin, apiKey, tenantKey);
  return verified?.user_id;
}

function buildLineageMap(files: IngestFile[]) {
  return files.map((file) => buildIngestLineageForFile(file));
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
    let body;
    try {
      body = parseIngestRequestBody(await req.json());
    } catch (e) {
      if (e instanceof IngestValidationError) {
        return NextResponse.json(
          { error: e.code, message: e.message, issues: e.issues },
          { status: e.status }
        );
      }
      throw e;
    }

    const files = body.files ?? [];
    const normalizedPaths: string[] = [];
    const ingestFiles: IngestFile[] = [];

    for (const f of files) {
      const np = normalizeRelPath(f.path);
      if (!np) {
        return NextResponse.json(
          {
            error: "INGEST_VALIDATION_ERROR",
            message: `Invalid or unsafe path: ${f.path}`,
            issues: [{ path: "files.path", message: "Path must be relative and must not contain .." }],
          },
          { status: 400 }
        );
      }
      normalizedPaths.push(np);
      ingestFiles.push({
        path: np,
        content: f.content,
        ...(f.bug_index ? { bug_index: f.bug_index } : {}),
      });
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

    const hashPartition =
      normalizedPaths.length > 0
        ? await partitionIngestFilesByContentHash(tenantId, ingestFiles)
        : { changed: [], unchanged: [], skipped_paths: [] };

    if (hashPartition.skipped_paths.length > 0) {
      void recordSavingsFeatureCount(
        tenantId,
        "ingest_hash_files_skipped",
        hashPartition.skipped_paths.length
      );
    }

    const filesToSweep = hashPartition.changed;
    const runGeminiAudit =
      filesToSweep.length > 0 ||
      (hashPartition.unchanged.length === 0 && normalizedPaths.length > 0);

    const idempotencyKey =
      req.headers.get("Idempotency-Key")?.trim() ||
      req.headers.get("x-msgf-idempotency-key")?.trim() ||
      ingestRequestId;

    let creditStart: CreditReservationStart = { enabled: false };
    if (shouldReserveForIngestWithFiles(normalizedPaths.length)) {
      const reserveAmount = resolveIngestCreditReserveAmount(
        filesToSweep.length,
        runGeminiAudit && !(isIngestAuditSkipOnHashHit() && hashPartition.changed.length === 0)
      );
      creditStart = await startTenantCreditReservation(
        admin,
        tenantId,
        idempotencyKey,
        reserveAmount
      );
      if (creditStart.enabled && creditStart.insufficient) {
        void recordSavingsFeatureCount(tenantId, "credit_reserve_denied");
        return NextResponse.json({ error: "INSUFFICIENT_FUNDS" }, { status: 402 });
      }
      if (creditStart.enabled && !creditStart.insufficient) {
        void recordSavingsFeatureCount(tenantId, "credit_reserve_ok");
      }
    }

    try {
      const lineageMap = buildLineageMap(ingestFiles);
      let ingestAudit = "- [SKIP] No files provided — pillar bootstrap only.\n";
      if (hashPartition.skipped_paths.length > 0) {
        ingestAudit += `- [HASH SKIP] Unchanged content (${hashPartition.skipped_paths.length}): ${hashPartition.skipped_paths.join(", ")}\n`;
      }
      let ingestedCount = 0;
      let skippedBaseline = true;

      const projectOrigin = deriveProjectOrigin(ingestFiles, body.project_origin);

      if (filesToSweep.length > 0) {
        const ingestPreview = filesToSweep
          .map((f) => f.content)
          .join("\n")
          .slice(0, 12_000);
        const shadow = await preFlightCheck(
          admin,
          { text: ingestPreview || "(empty ingest batch)" },
          { tenantId }
        );
        if (shadow.blocked) {
          return NextResponse.json(
            {
              error: "INGEST_DEFEND_BLOCKED",
              tier: shadow.tier,
              reason: shadow.reason,
              v32_directive: {
                sweep: "pre_ingestion_audit_ref",
                defend: { tier: shadow.tier, blocked: true },
                cross_ref: {
                  vault_match: Boolean(shadow.vaultMatch),
                  hall_match: Boolean(shadow.hallMatch),
                },
              },
            },
            { status: 403 }
          );
        }

        const sweep = await sweepAndIngest({
          files: filesToSweep,
          tenantId,
          supabase: admin,
          projectOrigin,
        });
        ingestAudit += sweep.auditLog;
        ingestedCount = sweep.ingested;
        skippedBaseline = sweep.skippedBaseline;
        await updateIngestHashesAfterSweep(tenantId, filesToSweep);
      }

      const ingestEntityId = await resolveIngestEntityId(admin, req, tenantId);
      const readiness = await computeBrainReadiness(
        admin,
        tenantId,
        ingestEntityId
      );

      const skipAudit =
        isIngestAuditSkipOnHashHit() &&
        hashPartition.changed.length === 0 &&
        hashPartition.skipped_paths.length > 0;

      if (normalizedPaths.length > 0 && runGeminiAudit && !skipAudit) {
        const aiAudit = await summarizeForAudit(req, filesToSweep.length ? filesToSweep : ingestFiles, lineageMap);
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
        skipped_unchanged_hash_count: hashPartition.skipped_paths.length,
        pillars_created: pillarBootstrap.pillars_created,
        audit_skipped_hash_unchanged: skipAudit,
      });

      await endTenantCreditReservation(admin, creditStart, response.status);
      const usageTokens = Math.max(
        80,
        Math.floor(
          filesToSweep.reduce((s, f) => s + f.content.length, 0) / 4
        ) + (skipAudit ? 0 : 400)
      );
      void incrementUsageMonitorTokens(`tenant:${tenantId}`, usageTokens);
      return response;
    } catch (inner: unknown) {
      await endTenantCreditReservation(admin, creditStart, 500);
      if (inner instanceof IngestValidationError) {
        return NextResponse.json(
          { error: inner.code, message: inner.message, issues: inner.issues },
          { status: inner.status }
        );
      }
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

