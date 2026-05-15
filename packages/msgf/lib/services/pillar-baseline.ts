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
 * Distribution Build ID: MSGF-7175065-20260515T200509Z-internal
 */
/**

 * Six-pillar governance baseline gate (P1–P6) on `pillar_vectors.metadata`.

 * Counts only rows where `metadata.tenant_id` matches the active tenant silo.

 */



import type { SupabaseClient } from "@supabase/supabase-js";



import { PULSE_BUG_INDEX } from "@/lib/schemas/vault-hall-metadata";

import {

  normalizeTenantId,

  withMsgfMetadataScope,

} from "@/lib/services/msgf-metadata-scope";

import { fromPillarVectors } from "@/lib/msgf-pillar-table";
import { applyPillarVectorsTenantFilter } from "@/lib/services/tenant-query-scope";



export const MSGF_GOVERNANCE_PILLARS = ["P1", "P2", "P3", "P4", "P5", "P6"] as const;

export type MsgfGovernancePillar = (typeof MSGF_GOVERNANCE_PILLARS)[number];



export const PILLAR_BASELINE_REQUIRED_COUNT = 6;



const CATEGORY_TO_GOVERNANCE_PILLAR: Record<string, MsgfGovernancePillar> = {

  Auth: "P1",

  API: "P2",

  UI: "P3",

  Data: "P4",

  Core: "P5",

};



export function governancePillarForCategory(category: string): MsgfGovernancePillar {

  return CATEGORY_TO_GOVERNANCE_PILLAR[category] ?? "P6";

}



export function listGovernancePillarsFromMetadata(

  rows: { metadata: Record<string, unknown> | null }[]

): Set<MsgfGovernancePillar> {

  const found = new Set<MsgfGovernancePillar>();

  for (const row of rows) {

    const meta = row.metadata;

    if (!meta) continue;

    const gov = meta.governance_pillar;

    if (

      typeof gov === "string" &&

      (MSGF_GOVERNANCE_PILLARS as readonly string[]).includes(gov)

    ) {

      found.add(gov as MsgfGovernancePillar);

    }

  }

  return found;

}



type BaselinePillarRow = { metadata: Record<string, unknown> | null };



/**

 * Baseline pillar rows for one tenant (`metadata.tenant_id` exact match only).

 */

export async function fetchTenantBaselinePillarRows(

  supabase: SupabaseClient,

  tenantId: string

): Promise<BaselinePillarRow[]> {

  const tid = normalizeTenantId(tenantId);



  type FilterEq = { eq: (column: string, value: string) => FilterEq };

  let query: FilterEq = fromPillarVectors(supabase, tid)
    .select("metadata")
    .eq("metadata->>is_baseline", "true") as unknown as FilterEq;



  query = applyPillarVectorsTenantFilter(query, tid);



  const { data, error } = await (query as unknown as Promise<{
    data: unknown;
    error: { message: string } | null;
  }>);



  if (error) {

    console.warn("[pillar-baseline] tenant query failed:", error.message);

    return [];

  }



  return (data ?? []) as BaselinePillarRow[];

}



/** @deprecated Use {@link fetchTenantBaselinePillarRows}. */

export async function fetchAuthorBaselinePillarRows(

  supabase: SupabaseClient,

  authorId: string

): Promise<BaselinePillarRow[]> {

  return fetchTenantBaselinePillarRows(supabase, authorId);

}



export async function isTenantPillarBaselineSet(

  supabase: SupabaseClient,

  tenantId: string

): Promise<boolean> {

  const rows = await fetchTenantBaselinePillarRows(supabase, tenantId);

  return listGovernancePillarsFromMetadata(rows).size >= PILLAR_BASELINE_REQUIRED_COUNT;

}



/** @deprecated Use {@link isTenantPillarBaselineSet}. */

export async function isAuthorPillarBaselineSet(

  supabase: SupabaseClient,

  authorId: string

): Promise<boolean> {

  return isTenantPillarBaselineSet(supabase, authorId);

}



export function buildPillarBaselineMetadata(input: {

  tenantId: string;

  governancePillar: MsgfGovernancePillar;

  summary?: string;

  projectOrigin?: string;

}): Record<string, unknown> {

  const bugIndex = PULSE_BUG_INDEX.vaultConsensusOk;

  return withMsgfMetadataScope(

    {

      pillar: "P6",

      ledger: "vault",

      index_type: "genealogical_bug_index",

      bug_index: bugIndex,

      instance: "1.1.1",

      category: bugIndex.level_1_category,

      branch: "1.1_SWEEP",

      instance_slug: `1.1.1_PILLAR_${input.governancePillar}_BASELINE`,

      governance_pillar: input.governancePillar,

      is_baseline: true,

      summary: input.summary ?? `Governance baseline ${input.governancePillar}`,

      persisted_at: new Date().toISOString(),

    },

    {

      tenantId: input.tenantId,

      entityId: input.tenantId,

      projectOrigin: input.projectOrigin,

    }

  );

}



/**

 * Seeds any missing P1–P6 baseline rows for a tenant (creation stage).

 */

export async function ensureTenantPillarBaseline(

  supabase: SupabaseClient,

  tenantId: string,

  options?: { projectOrigin?: string }

): Promise<{ created: MsgfGovernancePillar[]; skipped: boolean }> {

  const tid = normalizeTenantId(tenantId);

  const rows = await fetchTenantBaselinePillarRows(supabase, tid);

  const existing = listGovernancePillarsFromMetadata(rows);



  if (existing.size >= PILLAR_BASELINE_REQUIRED_COUNT) {

    return { created: [], skipped: true };

  }



  const created: MsgfGovernancePillar[] = [];



  for (const pillar of MSGF_GOVERNANCE_PILLARS) {

    if (existing.has(pillar)) continue;



    const metadata = buildPillarBaselineMetadata({

      tenantId: tid,

      governancePillar: pillar,

      projectOrigin: options?.projectOrigin,

    });



    const { error } = await fromPillarVectors(supabase, tid).insert({

      content: `MSGF governance baseline — ${pillar} (tenant ${tid})`,

      metadata,

    });



    if (error) {

      console.warn(`[pillar-baseline] insert ${pillar} failed:`, error.message);

      continue;

    }



    created.push(pillar);

    existing.add(pillar);

  }



  return { created, skipped: false };

}



/** @deprecated Use {@link ensureTenantPillarBaseline}. */

export async function ensureAuthorPillarBaseline(

  supabase: SupabaseClient,

  authorId: string,

  options?: { projectOrigin?: string }

): Promise<{ created: MsgfGovernancePillar[]; skipped: boolean }> {

  return ensureTenantPillarBaseline(supabase, authorId, options);

}


