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
 * Distribution Build ID: MSGF-5e9b050-20260519T172718Z-internal
 */
/**
 * SWEEP ingestion — tenant-scoped `pillar_vectors` writes (metadata JSONB only).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { generateEmbedding } from "@/lib/ai-utils";
import {
  buildGenealogicalBugIndex,
  buildVaultHallMetadata,
  type GenealogicalBugIndex,
} from "@/lib/schemas/vault-hall-metadata";
import {
  ensureTenantPillarBaseline,
  governancePillarForCategory,
  isTenantPillarBaselineSet,
  type MsgfGovernancePillar,
} from "@/lib/services/pillar-baseline";
import { fromPillarVectors } from "@/lib/msgf-pillar-table";
import {
  deriveProjectOrigin,
  normalizeTenantId,
  withMsgfMetadataScope,
} from "@/lib/services/msgf-metadata-scope";

export type IngestFile = { path: string; content: string };

export type IngestServiceOptions = {
  files: IngestFile[];
  /** Tenant / project silo UUID — never conflated with a human author profile elsewhere. */
  tenantId: string;
  supabase: SupabaseClient;
  /** Repo tag for dashboard filters; derived from paths when omitted. */
  projectOrigin?: string;
};

export type SweepIngestResult = {
  auditLog: string;
  ingested: number;
  skippedBaseline: boolean;
  isPillarBaselineSet: boolean;
  tenantId: string;
  projectOrigin: string;
};

export function determineCategory(filePath: string): string {
  const p = filePath.toLowerCase();
  if (p.includes("auth")) return "Auth";
  if (p.includes("api")) return "API";
  if (p.includes("ui") || p.includes("component") || p.includes("app/")) return "UI";
  if (p.includes("db") || p.includes("sql") || p.includes("migration")) return "Data";
  return "Core";
}

export function determineBranch(filePath: string): string {
  const parts = filePath.replace(/\\/g, "/").split("/").filter(Boolean);
  if (parts.length >= 2) return `${parts[parts.length - 2]}_${parts[parts.length - 1]}`;
  return parts[0] || "root";
}

function slugifyGenealogicalSegment(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
}

export function pathToGenealogicalBugIndex(filePath: string): GenealogicalBugIndex {
  const category = determineCategory(filePath);
  const branch = determineBranch(filePath);
  return buildGenealogicalBugIndex({
    level_1_category: `1.0_${slugifyGenealogicalSegment(category)}`,
    level_1_1_branch: `1.1_${slugifyGenealogicalSegment(branch)}`,
    level_1_1_1_instance: "1.1.1_INGEST_BASELINE",
  });
}

function buildIngestMetadata(input: {
  tenantId: string;
  projectOrigin: string;
  filePath: string;
  bugIndex: GenealogicalBugIndex;
  governancePillar: MsgfGovernancePillar;
}): Record<string, unknown> {
  const vaultMeta = buildVaultHallMetadata({
    ledger: "vault",
    bugIndex: input.bugIndex,
    tenantId: input.tenantId,
    entityId: input.tenantId,
    summary: `SWEEP ingest: ${input.filePath}`,
  });

  return withMsgfMetadataScope(
    {
      ...vaultMeta,
      // SWEEP repository shards use the canonical V3.0 engineering pillar.
      // Vault/Hall consensus rows keep `pillar: P6` via buildVaultHallMetadata.
      pillar: input.governancePillar,
      governance_pillar: input.governancePillar,
      is_baseline: true,
      ingest_source: "sweep",
      original_path: input.filePath,
      ingested_at: new Date().toISOString(),
    },
    {
      tenantId: input.tenantId,
      entityId: input.tenantId,
      projectOrigin: input.projectOrigin,
    }
  );
}

async function insertIngestVector(
  supabase: SupabaseClient,
  tenantId: string,
  content: string,
  metadata: Record<string, unknown>,
  embedding: number[]
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await fromPillarVectors(supabase, tenantId).insert({
    content,
    metadata,
    embedding,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export class IngestService {
  /**
   * SWEEP: shard files into the P6 cold layer using tenant-scoped metadata JSONB.
   * Skips vector creation when this tenant already has six governance pillar baselines.
   */
  async sweepAndIngest(options: IngestServiceOptions): Promise<SweepIngestResult> {
    const tenantId = normalizeTenantId(options.tenantId);
    const projectOrigin = deriveProjectOrigin(options.files, options.projectOrigin);
    const { files, supabase } = options;

    const auditLogs: string[] = [
      "# MSGF V3.2 ULTRA - Pre-Ingestion Audit\n",
      `- [TENANT] ${tenantId}`,
      `- [PROJECT_ORIGIN] ${projectOrigin}`,
    ];

    const isPillarBaselineSet = await isTenantPillarBaselineSet(supabase, tenantId);
    const skipCreation = isPillarBaselineSet;
    if (skipCreation) {
      auditLogs.push(
        `- [SKIP] Pillar baseline set (tenant ${tenantId}) — skipping SWEEP vector creation stage.`
      );
    }

    let ingested = 0;

    if (!skipCreation) {
      for (const file of files) {
        const bugIndex = pathToGenealogicalBugIndex(file.path);
        const category = determineCategory(file.path);
        const governancePillar = governancePillarForCategory(category);
        const metadata = buildIngestMetadata({
          tenantId,
          projectOrigin,
          filePath: file.path,
          bugIndex,
          governancePillar,
        });

        const embedding = await generateEmbedding(file.content);

        const result = await insertIngestVector(
          supabase,
          tenantId,
          file.content,
          metadata,
          embedding
        );

        if (result.ok) {
          ingested += 1;
          auditLogs.push(
            `- [MATCH] Ingested ${file.path} → ${bugIndex.level_1_category}.${bugIndex.level_1_1_branch}.${bugIndex.level_1_1_1_instance} (${governancePillar})`
          );
        } else {
          auditLogs.push(`- [ERROR] Failed to ingest ${file.path}: ${result.error}`);
        }
      }
    } else {
      for (const file of files) {
        auditLogs.push(`- [SKIP] ${file.path} (baseline pillars already present for tenant)`);
      }
    }

    if (!isPillarBaselineSet) {
      const seeded = await ensureTenantPillarBaseline(supabase, tenantId, {
        projectOrigin,
      });
      if (seeded.created.length > 0) {
        auditLogs.push(
          `- [BASELINE] Filled governance pillars: ${seeded.created.join(", ")}`
        );
      }
    }

    const pillarBaselineNow = await isTenantPillarBaselineSet(supabase, tenantId);

    return {
      auditLog: auditLogs.join("\n"),
      ingested,
      skippedBaseline: skipCreation,
      isPillarBaselineSet: pillarBaselineNow,
      tenantId,
      projectOrigin,
    };
  }
}

export const ingestService = new IngestService();
