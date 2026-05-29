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
 * Distribution Build ID: MSGF-3ea5d0e-20260529T033030Z-internal
 */
/**
 * Syntax Education — Admin curriculum catalog controller.
 *
 * Masterdoc §4.1 (Master Inventory Vault + Recommendation Engine).
 * Pillars §2.1.4 (cross-tenant guardrail — only district admins can mutate catalog rows).
 *
 * Persistence target: `public.education_district_curriculum_catalog`
 * Recommendation source: `public.education_district_friction_hotspots` RPC over P6 Hall rows.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { EducationPolicyHaltError } from "@/lib/education/p1-static-ledger";

// ============================================================================
// Layout / catalog row schemas
// ============================================================================

export const CatalogSectionSchema = z.object({
  sectionId: z.string().min(1).max(128),
  sectionTitle: z.string().min(1).max(256),
  pageStart: z.number().int().min(0).optional(),
  pageEnd: z.number().int().min(0).optional(),
});

export const CatalogChapterSchema = z.object({
  chapterId: z.string().min(1).max(96),
  chapterTitle: z.string().min(1).max(256),
  pageStart: z.number().int().min(0).optional(),
  pageEnd: z.number().int().min(0).optional(),
  sections: z.array(CatalogSectionSchema).max(64).default([]),
});

export const CatalogUnitSchema = z.object({
  unitId: z.string().min(1).max(64),
  unitTitle: z.string().min(1).max(256),
  chapters: z.array(CatalogChapterSchema).max(48).default([]),
});

export const CatalogLayoutSchema = z.array(CatalogUnitSchema).max(64);
export type CatalogLayout = z.infer<typeof CatalogLayoutSchema>;
export type CatalogUnit = z.infer<typeof CatalogUnitSchema>;
export type CatalogChapter = z.infer<typeof CatalogChapterSchema>;
export type CatalogSection = z.infer<typeof CatalogSectionSchema>;

export const CatalogSourceTypeSchema = z.enum([
  "local_pdf",
  "local_epub",
  "lti_publisher",
  "clever",
  "classlink",
]);
export type CatalogSourceType = z.infer<typeof CatalogSourceTypeSchema>;

export const CatalogUpsertSchema = z
  .object({
    id: z.string().uuid().optional(),
    title: z.string().min(1).max(256),
    publisher: z.string().max(128).optional(),
    isbn: z.string().max(32).optional(),
    subjectDomain: z
      .enum(["ela", "history", "math", "science", "general"])
      .default("general"),
    sourceType: CatalogSourceTypeSchema,
    storageObjectPath: z.string().max(1024).optional(),
    externalResourceUrl: z.string().url().optional(),
    ltiDeploymentId: z.string().uuid().optional(),
    layout: CatalogLayoutSchema.default([]),
    totalPageCount: z.number().int().min(0).optional(),
    isActive: z.boolean().default(true),
  })
  .strict()
  .refine(
    (b) =>
      (b.sourceType === "local_pdf" || b.sourceType === "local_epub"
        ? !!b.storageObjectPath
        : !!b.externalResourceUrl),
    { message: "Local sources require storageObjectPath; external sources require externalResourceUrl." }
  );

export type CatalogUpsertInput = z.infer<typeof CatalogUpsertSchema>;

export const CatalogListQuerySchema = z
  .object({
    subjectDomain: z
      .enum(["ela", "history", "math", "science", "general"])
      .optional(),
    activeOnly: z.boolean().default(true),
    limit: z.number().int().min(1).max(100).default(50),
  })
  .strict();

// ============================================================================
// DB row + recommendation types
// ============================================================================

export type DistrictCatalogRow = {
  id: string;
  district_tenant_id: string;
  title: string;
  publisher: string | null;
  isbn: string | null;
  subject_domain: string;
  source_type: CatalogSourceType;
  storage_object_path: string | null;
  external_resource_url: string | null;
  lti_deployment_id: string | null;
  layout: CatalogLayout;
  total_page_count: number | null;
  is_active: boolean;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type FrictionHotspot = {
  level_1_category: string;
  level_1_1_branch: string;
  level_1_1_1_instance: string;
  incident_count: number;
  last_seen: string;
};

export type CatalogRowWithRecommendation = DistrictCatalogRow & {
  recommendation: {
    isRecommended: boolean;
    matchedHotspots: FrictionHotspot[];
    matchedKeywords: string[];
  };
};

// ============================================================================
// Cross-tenant guardrail (pillars §2.1.4)
// ============================================================================

export type CatalogActor = {
  role: string;
  districtTenantId: string;
  userId?: string;
};

const ADMIN_ROLES = new Set([
  "super_admin",
  "district_super_admin",
  "administration_it",
  "admin",
]);

export function assertAdminForCatalogMutation(actor: CatalogActor): void {
  if (!ADMIN_ROLES.has(actor.role)) {
    throw new EducationPolicyHaltError(
      `Catalog mutations require an administrative role (got: ${actor.role}).`,
      "P1_CATALOG_GOVERNANCE"
    );
  }
  if (!actor.districtTenantId || actor.districtTenantId.trim().length === 0) {
    throw new EducationPolicyHaltError(
      "Catalog mutations require an explicit district_tenant_id.",
      "P1_CATALOG_GOVERNANCE"
    );
  }
}

function assertTenantMatch(rowTenant: string, actor: CatalogActor): void {
  if (rowTenant !== actor.districtTenantId) {
    throw new EducationPolicyHaltError(
      "Cross-tenant catalog access denied — admins may only manage their own district's inventory.",
      "P1_CATALOG_GOVERNANCE"
    );
  }
}

// ============================================================================
// Read / write API
// ============================================================================

export async function listCatalog(params: {
  admin: SupabaseClient;
  districtTenantId: string;
  query?: z.input<typeof CatalogListQuerySchema>;
}): Promise<DistrictCatalogRow[]> {
  const q = CatalogListQuerySchema.parse(params.query ?? {});
  let query = params.admin
    .from("education_district_curriculum_catalog")
    .select("*")
    .eq("district_tenant_id", params.districtTenantId)
    .order("title", { ascending: true })
    .limit(q.limit);

  if (q.activeOnly) query = query.eq("is_active", true);
  if (q.subjectDomain) query = query.eq("subject_domain", q.subjectDomain);

  const { data, error } = await query;
  if (error) {
    throw new Error(`curriculum catalog list: ${error.message}`);
  }
  return (data ?? []) as unknown as DistrictCatalogRow[];
}

export async function getCatalogRow(params: {
  admin: SupabaseClient;
  catalogId: string;
  actor: CatalogActor;
}): Promise<DistrictCatalogRow> {
  const { data, error } = await params.admin
    .from("education_district_curriculum_catalog")
    .select("*")
    .eq("id", params.catalogId)
    .maybeSingle();

  if (error) throw new Error(`curriculum catalog read: ${error.message}`);
  if (!data) {
    throw new EducationPolicyHaltError("Catalog row not found.", "EDU_CATALOG_NOT_FOUND");
  }
  assertTenantMatch(String(data.district_tenant_id), params.actor);
  return data as unknown as DistrictCatalogRow;
}

export async function upsertCatalogRow(params: {
  admin: SupabaseClient;
  actor: CatalogActor;
  input: unknown;
}): Promise<DistrictCatalogRow> {
  assertAdminForCatalogMutation(params.actor);
  const parsed = CatalogUpsertSchema.parse(params.input);

  const row = {
    id: parsed.id ?? undefined,
    district_tenant_id: params.actor.districtTenantId,
    title: parsed.title,
    publisher: parsed.publisher ?? null,
    isbn: parsed.isbn ?? null,
    subject_domain: parsed.subjectDomain,
    source_type: parsed.sourceType,
    storage_object_path: parsed.storageObjectPath ?? null,
    external_resource_url: parsed.externalResourceUrl ?? null,
    lti_deployment_id: parsed.ltiDeploymentId ?? null,
    layout: parsed.layout,
    total_page_count: parsed.totalPageCount ?? deriveTotalPages(parsed.layout),
    is_active: parsed.isActive,
    approved_by: params.actor.userId ?? null,
    approved_at: parsed.isActive ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };

  if (parsed.id) {
    const existing = await getCatalogRow({
      admin: params.admin,
      catalogId: parsed.id,
      actor: params.actor,
    });
    assertTenantMatch(existing.district_tenant_id, params.actor);
  }

  const { data, error } = await params.admin
    .from("education_district_curriculum_catalog")
    .upsert(row, { onConflict: "id" })
    .select("*")
    .single();

  if (error) {
    throw new Error(`curriculum catalog upsert: ${error.message}`);
  }
  return data as unknown as DistrictCatalogRow;
}

export async function deactivateCatalogRow(params: {
  admin: SupabaseClient;
  actor: CatalogActor;
  catalogId: string;
}): Promise<DistrictCatalogRow> {
  assertAdminForCatalogMutation(params.actor);
  const existing = await getCatalogRow({
    admin: params.admin,
    catalogId: params.catalogId,
    actor: params.actor,
  });

  // Block delete / deactivate when an active assignment slice still references this catalog.
  const { count, error: refErr } = await params.admin
    .from("education_assignment_resources")
    .select("resource_context_id", { count: "exact", head: true })
    .eq("catalog_id", params.catalogId);
  if (refErr) throw new Error(`assignment resource ref check: ${refErr.message}`);
  if ((count ?? 0) > 0) {
    throw new EducationPolicyHaltError(
      `Cannot deactivate '${existing.title}' — ${count} active assignment slice(s) still reference it.`,
      "EDU_CATALOG_IN_USE"
    );
  }

  const { data, error } = await params.admin
    .from("education_district_curriculum_catalog")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", params.catalogId)
    .select("*")
    .single();
  if (error) throw new Error(`curriculum catalog deactivate: ${error.message}`);
  return data as unknown as DistrictCatalogRow;
}

// ============================================================================
// Friction-gap recommendation engine (masterdoc §4.1)
// ============================================================================

export async function loadDistrictFrictionHotspots(params: {
  admin: SupabaseClient;
  districtTenantId: string;
  lookbackDays?: number;
  limit?: number;
}): Promise<FrictionHotspot[]> {
  const { data, error } = await params.admin.rpc("education_district_friction_hotspots", {
    p_district_tenant_id: params.districtTenantId,
    p_lookback_days: params.lookbackDays ?? 30,
    p_limit: params.limit ?? 10,
  });
  if (error) {
    console.warn("[curriculum-catalog] friction hotspots RPC failed:", error.message);
    return [];
  }
  return (data ?? []) as FrictionHotspot[];
}

/**
 * Map a hotspot bug index slug → keywords likely to appear in catalog titles / subjects.
 * Tokenizes slugs like `1.1.1_INVERSE_SIGN_ERROR` → ["inverse", "sign", "error"].
 */
function hotspotKeywords(hotspot: FrictionHotspot): string[] {
  const slug = `${hotspot.level_1_category} ${hotspot.level_1_1_branch} ${hotspot.level_1_1_1_instance}`;
  return slug
    .toLowerCase()
    .replace(/^\d+(\.\d+)*_?/g, "")
    .split(/[\s._]+/)
    .filter((t) => t.length >= 3);
}

function rowMatchesKeywords(row: DistrictCatalogRow, keywords: string[]): string[] {
  const haystack =
    `${row.title} ${row.publisher ?? ""} ${row.subject_domain} ${JSON.stringify(row.layout).slice(0, 4000)}`
      .toLowerCase();
  return keywords.filter((k) => haystack.includes(k));
}

export function annotateRowsWithRecommendations(
  rows: DistrictCatalogRow[],
  hotspots: FrictionHotspot[]
): CatalogRowWithRecommendation[] {
  return rows.map((row) => {
    const matchedHotspots: FrictionHotspot[] = [];
    const allMatchedKeywords = new Set<string>();
    for (const hotspot of hotspots) {
      const keywords = hotspotKeywords(hotspot);
      const matched = rowMatchesKeywords(row, keywords);
      if (matched.length > 0) {
        matchedHotspots.push(hotspot);
        matched.forEach((k) => allMatchedKeywords.add(k));
      }
    }
    return {
      ...row,
      recommendation: {
        isRecommended: matchedHotspots.length > 0,
        matchedHotspots,
        matchedKeywords: Array.from(allMatchedKeywords),
      },
    };
  });
}

export async function listCatalogWithRecommendations(params: {
  admin: SupabaseClient;
  districtTenantId: string;
  query?: z.input<typeof CatalogListQuerySchema>;
  lookbackDays?: number;
}): Promise<{
  rows: CatalogRowWithRecommendation[];
  hotspots: FrictionHotspot[];
}> {
  const [rows, hotspots] = await Promise.all([
    listCatalog({
      admin: params.admin,
      districtTenantId: params.districtTenantId,
      query: params.query,
    }),
    loadDistrictFrictionHotspots({
      admin: params.admin,
      districtTenantId: params.districtTenantId,
      lookbackDays: params.lookbackDays,
    }),
  ]);
  return {
    rows: annotateRowsWithRecommendations(rows, hotspots),
    hotspots,
  };
}

// ============================================================================
// Layout helpers
// ============================================================================

export function deriveTotalPages(layout: CatalogLayout): number {
  let maxPage = 0;
  for (const unit of layout) {
    for (const ch of unit.chapters) {
      if (ch.pageEnd && ch.pageEnd > maxPage) maxPage = ch.pageEnd;
      for (const s of ch.sections) {
        if (s.pageEnd && s.pageEnd > maxPage) maxPage = s.pageEnd;
      }
    }
  }
  return maxPage;
}

/**
 * Looks up a {unitId, chapterId, sectionId} tuple inside a layout and returns its page bounds.
 * Used by the slicing widget + Socratic Boundary Sync.
 */
export function resolveSlicePages(
  layout: CatalogLayout,
  slice: { unitId?: string; chapterId?: string; sectionId?: string }
): { pageStart?: number; pageEnd?: number } {
  for (const unit of layout) {
    if (slice.unitId && unit.unitId !== slice.unitId) continue;
    for (const chapter of unit.chapters) {
      if (slice.chapterId && chapter.chapterId !== slice.chapterId) continue;
      if (slice.sectionId) {
        const section = chapter.sections.find((s) => s.sectionId === slice.sectionId);
        if (section) return { pageStart: section.pageStart, pageEnd: section.pageEnd };
      } else if (slice.chapterId) {
        return { pageStart: chapter.pageStart, pageEnd: chapter.pageEnd };
      }
    }
  }
  return {};
}
