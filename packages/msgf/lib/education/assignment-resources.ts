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
 * Distribution Build ID: MSGF-e356216-20260522T181226Z-internal
 */
/**
 * Syntax Education — Teacher slicing engine (the Scoping Widget).
 *
 * Masterdoc §4.2 (Granular extraction protocol + tokenized deep linking).
 * Pillars §2.2.1 (P2 material milestone gates — `require_reading_block`).
 *
 * Persistence target: `public.education_assignment_resources`
 *
 * The teacher's selected sub-tree (`AssignmentResourceSlice`) is collapsed to a
 * `resource_context_id` UUID that the Socratic Boundary Sync (`socratic-tutor-controller`)
 * uses to filter `match_education_curriculum_shards`.
 */
import { createHmac, randomUUID } from "crypto";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import {
  getCatalogRow,
  resolveSlicePages,
  type CatalogActor,
  type DistrictCatalogRow,
} from "@/lib/education/curriculum-catalog";
import { privacyGateSecret } from "@/lib/education/lti/lti-config";
import { EducationPolicyHaltError } from "@/lib/education/p1-static-ledger";

// ============================================================================
// Slice payload schemas
// ============================================================================

export const AssignmentResourceSliceSchema = z
  .object({
    unitIds: z.array(z.string().min(1).max(64)).max(32).default([]),
    chapterIds: z.array(z.string().min(1).max(96)).max(64).default([]),
    sectionIds: z.array(z.string().min(1).max(128)).max(128).default([]),
    pageStart: z.number().int().min(0).optional(),
    pageEnd: z.number().int().min(0).optional(),
  })
  .strict()
  .refine(
    (s) =>
      s.unitIds.length + s.chapterIds.length + s.sectionIds.length > 0 ||
      (s.pageStart != null && s.pageEnd != null),
    {
      message:
        "Slice must include at least one unitId / chapterId / sectionId, or an explicit pageStart + pageEnd.",
    }
  )
  .refine(
    (s) => s.pageStart == null || s.pageEnd == null || s.pageStart <= s.pageEnd,
    { message: "pageStart must be <= pageEnd." }
  );

export type AssignmentResourceSlice = z.infer<typeof AssignmentResourceSliceSchema>;

export const AssignmentResourceUpsertSchema = z
  .object({
    resourceContextId: z.string().uuid().optional(),
    assignmentId: z.string().uuid(),
    catalogId: z.string().uuid(),
    slice: AssignmentResourceSliceSchema,
    requireReadingBlock: z.boolean().default(false),
    /** Minimum contiguous focus block (ms) needed before composition unlocks. */
    minFocusBlockMs: z.number().int().min(0).max(1_800_000).default(120_000),
    /** Override the deep-link TTL (default 24h). */
    deepLinkTtlSeconds: z.number().int().min(300).max(7 * 24 * 60 * 60).optional(),
  })
  .strict();

export type AssignmentResourceUpsertInput = z.infer<typeof AssignmentResourceUpsertSchema>;

// ============================================================================
// DB row + response types
// ============================================================================

export type AssignmentResourceRow = {
  resource_context_id: string;
  tenant_id: string;
  assignment_id: string;
  catalog_id: string;
  slice: AssignmentResourceSlice;
  page_start: number | null;
  page_end: number | null;
  signed_deep_link: string | null;
  signed_deep_link_expires_at: string | null;
  require_reading_block: boolean;
  min_focus_block_ms: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type AssignmentResourceWithCatalog = AssignmentResourceRow & {
  catalog: Pick<
    DistrictCatalogRow,
    | "id"
    | "title"
    | "publisher"
    | "subject_domain"
    | "source_type"
    | "storage_object_path"
    | "external_resource_url"
    | "total_page_count"
  >;
};

// ============================================================================
// Authorization
// ============================================================================

const TEACHER_ROLES = new Set([
  "teacher",
  "district_super_admin",
  "administration_it",
  "admin",
  "super_admin",
]);

export function assertTeacherForAssignmentMutation(actor: CatalogActor): void {
  if (!TEACHER_ROLES.has(actor.role)) {
    throw new EducationPolicyHaltError(
      `Assignment slice mutations require a teacher / admin role (got: ${actor.role}).`,
      "P2_ASSIGNMENT_GOVERNANCE"
    );
  }
}

// ============================================================================
// Tokenized deep link signing (masterdoc §4.2 + pillars §2.1.4 P3 secret)
// ============================================================================

export type SignedDeepLink = {
  url: string;
  expiresAt: string;
};

export function signResourceDeepLink(params: {
  catalog: DistrictCatalogRow;
  resourceContextId: string;
  entityId?: string;
  slice: AssignmentResourceSlice;
  ttlSeconds?: number;
}): SignedDeepLink {
  const ttl = params.ttlSeconds ?? 24 * 60 * 60;
  const exp = Math.floor(Date.now() / 1000) + ttl;
  const base =
    params.catalog.external_resource_url ??
    params.catalog.storage_object_path ??
    "";

  // The "raw" URL we tunnel through the platform — for `local_pdf` / `local_epub` this is a
  // Supabase Storage object path that the BFF will exchange for a signed URL on render.
  const inner = new URL(base.startsWith("http") ? base : `https://syntaxeducates.elphiesyntax.com/storage/${encodeURIComponent(base)}`);
  if (params.slice.pageStart != null) inner.searchParams.set("page_start", String(params.slice.pageStart));
  if (params.slice.pageEnd != null) inner.searchParams.set("page_end", String(params.slice.pageEnd));
  if (params.slice.chapterIds.length > 0) {
    inner.searchParams.set("chapters", params.slice.chapterIds.join(","));
  }
  if (params.slice.sectionIds.length > 0) {
    inner.searchParams.set("sections", params.slice.sectionIds.join(","));
  }
  inner.searchParams.set("resource_context_id", params.resourceContextId);
  inner.searchParams.set("exp", String(exp));

  const payload = `${inner.toString()}|${params.entityId ?? ""}|${exp}`;
  const sig = createHmac("sha256", privacyGateSecret()).update(payload).digest("hex");
  inner.searchParams.set("sig", sig);

  return {
    url: inner.toString(),
    expiresAt: new Date(exp * 1000).toISOString(),
  };
}

export function verifyResourceDeepLink(url: string, entityId?: string): boolean {
  try {
    const u = new URL(url);
    const sig = u.searchParams.get("sig");
    const exp = Number(u.searchParams.get("exp"));
    if (!sig || !Number.isFinite(exp)) return false;
    if (Math.floor(Date.now() / 1000) > exp) return false;

    const clone = new URL(url);
    clone.searchParams.delete("sig");
    const payload = `${clone.toString()}|${entityId ?? ""}|${exp}`;
    const expected = createHmac("sha256", privacyGateSecret()).update(payload).digest("hex");
    return timingSafeEqualHex(sig, expected);
  } catch {
    return false;
  }
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ============================================================================
// Slice → page-bound resolution
// ============================================================================

export function resolveSlicePageBounds(
  catalog: DistrictCatalogRow,
  slice: AssignmentResourceSlice
): { pageStart: number | null; pageEnd: number | null } {
  if (slice.pageStart != null && slice.pageEnd != null) {
    return { pageStart: slice.pageStart, pageEnd: slice.pageEnd };
  }
  let pageStart: number | null = null;
  let pageEnd: number | null = null;

  const probe = (
    unitId?: string,
    chapterId?: string,
    sectionId?: string
  ) => {
    const r = resolveSlicePages(catalog.layout, { unitId, chapterId, sectionId });
    if (r.pageStart != null && (pageStart == null || r.pageStart < pageStart)) {
      pageStart = r.pageStart;
    }
    if (r.pageEnd != null && (pageEnd == null || r.pageEnd > pageEnd)) {
      pageEnd = r.pageEnd;
    }
  };

  for (const sectionId of slice.sectionIds) {
    for (const unit of catalog.layout) {
      for (const ch of unit.chapters) {
        if (ch.sections.some((s) => s.sectionId === sectionId)) {
          probe(unit.unitId, ch.chapterId, sectionId);
        }
      }
    }
  }
  for (const chapterId of slice.chapterIds) {
    for (const unit of catalog.layout) {
      if (unit.chapters.some((c) => c.chapterId === chapterId)) {
        probe(unit.unitId, chapterId);
      }
    }
  }
  for (const unitId of slice.unitIds) {
    const unit = catalog.layout.find((u) => u.unitId === unitId);
    if (!unit) continue;
    for (const ch of unit.chapters) {
      probe(unit.unitId, ch.chapterId);
    }
  }
  return { pageStart, pageEnd };
}

// ============================================================================
// Public API
// ============================================================================

export async function upsertAssignmentResource(params: {
  admin: SupabaseClient;
  actor: CatalogActor;
  input: unknown;
  entityId?: string;
}): Promise<AssignmentResourceWithCatalog> {
  assertTeacherForAssignmentMutation(params.actor);
  const parsed = AssignmentResourceUpsertSchema.parse(params.input);

  const catalog = await getCatalogRow({
    admin: params.admin,
    catalogId: parsed.catalogId,
    actor: params.actor,
  });
  if (!catalog.is_active) {
    throw new EducationPolicyHaltError(
      `Catalog title '${catalog.title}' is not active; cannot create an assignment slice.`,
      "EDU_CATALOG_INACTIVE"
    );
  }

  const { pageStart, pageEnd } = resolveSlicePageBounds(catalog, parsed.slice);
  const resourceContextId = parsed.resourceContextId ?? randomUUID();

  const signed = signResourceDeepLink({
    catalog,
    resourceContextId,
    entityId: params.entityId,
    slice: {
      ...parsed.slice,
      pageStart: pageStart ?? parsed.slice.pageStart,
      pageEnd: pageEnd ?? parsed.slice.pageEnd,
    },
    ttlSeconds: parsed.deepLinkTtlSeconds,
  });

  const row = {
    resource_context_id: resourceContextId,
    tenant_id: params.actor.districtTenantId,
    assignment_id: parsed.assignmentId,
    catalog_id: catalog.id,
    slice: parsed.slice,
    page_start: pageStart,
    page_end: pageEnd,
    signed_deep_link: signed.url,
    signed_deep_link_expires_at: signed.expiresAt,
    require_reading_block: parsed.requireReadingBlock,
    min_focus_block_ms: parsed.minFocusBlockMs,
    created_by: params.actor.userId ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await params.admin
    .from("education_assignment_resources")
    .upsert(row, { onConflict: "assignment_id,catalog_id" })
    .select("*")
    .single();

  if (error) {
    throw new Error(`assignment resource upsert: ${error.message}`);
  }

  return attachCatalogProjection(data as unknown as AssignmentResourceRow, catalog);
}

export async function getAssignmentResource(params: {
  admin: SupabaseClient;
  resourceContextId: string;
  actor?: CatalogActor;
  entityId?: string;
  refreshSignedLink?: boolean;
}): Promise<AssignmentResourceWithCatalog | null> {
  const { data, error } = await params.admin
    .from("education_assignment_resources")
    .select("*")
    .eq("resource_context_id", params.resourceContextId)
    .maybeSingle();
  if (error) throw new Error(`assignment resource read: ${error.message}`);
  if (!data) return null;

  const row = data as unknown as AssignmentResourceRow;

  if (params.actor && row.tenant_id !== params.actor.districtTenantId) {
    throw new EducationPolicyHaltError(
      "Cross-tenant assignment resource access denied.",
      "P1_CATALOG_GOVERNANCE"
    );
  }

  const catalog = await getCatalogRow({
    admin: params.admin,
    catalogId: row.catalog_id,
    actor:
      params.actor ?? {
        role: "service_role",
        districtTenantId: row.tenant_id,
      },
  });

  // Re-sign the deep link if expired or if the caller has an entity_id that should be bound in.
  const expSec = row.signed_deep_link_expires_at
    ? Math.floor(new Date(row.signed_deep_link_expires_at).getTime() / 1000)
    : 0;
  const needsRefresh =
    params.refreshSignedLink ||
    !row.signed_deep_link ||
    expSec - Math.floor(Date.now() / 1000) < 60;

  if (needsRefresh) {
    const fresh = signResourceDeepLink({
      catalog,
      resourceContextId: row.resource_context_id,
      entityId: params.entityId,
      slice: row.slice,
    });
    row.signed_deep_link = fresh.url;
    row.signed_deep_link_expires_at = fresh.expiresAt;
  }

  return attachCatalogProjection(row, catalog);
}

export async function getAssignmentResourceForAssignment(params: {
  admin: SupabaseClient;
  assignmentId: string;
  actor?: CatalogActor;
  entityId?: string;
}): Promise<AssignmentResourceWithCatalog | null> {
  const { data, error } = await params.admin
    .from("education_assignment_resources")
    .select("resource_context_id")
    .eq("assignment_id", params.assignmentId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`assignment resource lookup: ${error.message}`);
  if (!data?.resource_context_id) return null;
  return getAssignmentResource({
    admin: params.admin,
    resourceContextId: String(data.resource_context_id),
    actor: params.actor,
    entityId: params.entityId,
    refreshSignedLink: true,
  });
}

function attachCatalogProjection(
  row: AssignmentResourceRow,
  catalog: DistrictCatalogRow
): AssignmentResourceWithCatalog {
  return {
    ...row,
    catalog: {
      id: catalog.id,
      title: catalog.title,
      publisher: catalog.publisher,
      subject_domain: catalog.subject_domain,
      source_type: catalog.source_type,
      storage_object_path: catalog.storage_object_path,
      external_resource_url: catalog.external_resource_url,
      total_page_count: catalog.total_page_count,
    },
  };
}
