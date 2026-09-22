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
/**
 * GET /api/msgf/admin/provenance-search
 * Operator provenance lookup across P7 source audit + impact (soft-fail enrichments).
 */

import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { MsgfAdminAuthError } from "@/lib/msgf-admin-auth";
import { resolveOperatorForAdminRequest } from "@/lib/msgf-admin-request-operator";
import { listUserIdsForCompany } from "@/lib/msgf-operator-access";
import { adminCorsPreflightResponse, applyAdminCorsHeaders } from "@/lib/msgf-cors";
import { createAdminClient } from "@/utils/supabase/admin";

function adminJson(req: NextRequest, data: unknown, init?: ResponseInit) {
  const res = NextResponse.json(data, init);
  return applyAdminCorsHeaders(req, res);
}

export async function OPTIONS(req: NextRequest) {
  return adminCorsPreflightResponse(req);
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type AuditEventRow = {
  id: string;
  tenant_id: string;
  entity_id: string | null;
  trace_id: string;
  routing: string | null;
  logic_drift_score: number | null;
  defend_tier: string | null;
  defend_reason: string | null;
  sources: unknown;
  outcome: string;
  observed_at: string;
};

type ImpactRow = {
  audit_event_id: string;
  trace_id: string;
  tenant_id: string;
  project_origin: string | null;
  resource_key: string;
  content_hash: string;
  attribution_class: string;
  file_path: string | null;
  observed_at: string;
};

type SourceOut = {
  resource_key: string;
  file_path: string | null;
  score: number | null;
  content_hash: string | null;
  attribution_class: string | null;
  reputation_score: number | null;
  ledger: string | null;
};

function parseSources(raw: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(raw)) return [];
  return raw.filter((s): s is Record<string, unknown> => s != null && typeof s === "object");
}

async function resolveCompanyTenantAllowlist(
  admin: SupabaseClient,
  companyId: string
): Promise<string[]> {
  const memberIds = await listUserIdsForCompany(admin, companyId);
  const tenants = new Set<string>();
  if (companyId.trim()) tenants.add(companyId.trim());
  for (const id of memberIds) {
    if (id) tenants.add(id);
  }

  if (memberIds.length > 0) {
    try {
      const { data } = await admin
        .from("p4_profiles")
        .select("user_id, tenant_id")
        .in("user_id", memberIds);
      for (const row of data ?? []) {
        const tid =
          typeof row.tenant_id === "string" && row.tenant_id.trim()
            ? row.tenant_id.trim()
            : "";
        if (tid) tenants.add(tid);
        if (typeof row.user_id === "string" && row.user_id.trim()) {
          tenants.add(row.user_id.trim());
        }
      }
    } catch {
      // soft-fail — member ids alone still scope the query
    }
  }

  return [...tenants];
}

function applyTenantFilter<T extends { in: (col: string, vals: string[]) => T; eq: (col: string, val: string) => T }>(
  q: T,
  tenantAllowlist: string[] | null,
  tenantIdParam: string
): T {
  if (tenantIdParam) {
    if (tenantAllowlist && !tenantAllowlist.includes(tenantIdParam)) {
      return q.in("tenant_id", [] as string[]);
    }
    return q.eq("tenant_id", tenantIdParam);
  }
  if (tenantAllowlist) {
    return q.in("tenant_id", tenantAllowlist.length ? tenantAllowlist : ["__none__"]);
  }
  return q;
}

async function softFetchPillarVectors(
  admin: SupabaseClient,
  resourceIds: string[]
): Promise<{ vault: unknown[]; hall: unknown[] }> {
  const ids = [...new Set(resourceIds.filter((id) => UUID_RE.test(id)))].slice(0, 40);
  if (ids.length === 0) return { vault: [], hall: [] };
  try {
    const { data, error } = await admin
      .from("pillar_vectors")
      .select("id, content, metadata, created_at")
      .in("id", ids)
      .limit(40);
    if (error || !data) return { vault: [], hall: [] };
    const vault: unknown[] = [];
    const hall: unknown[] = [];
    for (const row of data) {
      const md =
        row.metadata && typeof row.metadata === "object"
          ? (row.metadata as Record<string, unknown>)
          : {};
      const ledger = typeof md.ledger === "string" ? md.ledger : "";
      const slim = {
        id: row.id,
        ledger: ledger || null,
        content_preview:
          typeof row.content === "string" ? row.content.slice(0, 160) : null,
        created_at: row.created_at ?? null,
        project_origin:
          typeof md.project_origin === "string" ? md.project_origin : null,
      };
      if (ledger === "hall") hall.push(slim);
      else vault.push(slim);
    }
    return { vault, hall };
  } catch {
    return { vault: [], hall: [] };
  }
}

async function softFetchHal(
  admin: SupabaseClient,
  entityId: string | null | undefined
): Promise<unknown[]> {
  const eid = entityId?.trim() || "";
  if (!eid || !UUID_RE.test(eid)) return [];
  try {
    const { data, error } = await admin
      .from("p4_hal_ledger")
      .select(
        "id, tenant_id, author_user_id, session_id, manual_word_count, ai_assisted_word_count, created_at"
      )
      .eq("author_user_id", eid)
      .order("created_at", { ascending: false })
      .limit(5);
    if (error || !data) return [];
    return data;
  } catch {
    return [];
  }
}

async function softFetchReputation(
  admin: SupabaseClient,
  tenantId: string,
  resourceKeys: string[]
): Promise<Map<string, { reputation_score: number; ledger: string | null; file_path: string | null }>> {
  const map = new Map<
    string,
    { reputation_score: number; ledger: string | null; file_path: string | null }
  >();
  const keys = [...new Set(resourceKeys.filter(Boolean))].slice(0, 50);
  if (!tenantId || keys.length === 0) return map;
  try {
    const { data, error } = await admin
      .from("msgf_resource_reputation")
      .select("resource_key, reputation_score, ledger, file_path")
      .eq("tenant_id", tenantId)
      .in("resource_key", keys);
    if (error || !data) return map;
    for (const row of data) {
      map.set(String(row.resource_key), {
        reputation_score: Number(row.reputation_score ?? 0),
        ledger: typeof row.ledger === "string" ? row.ledger : null,
        file_path: typeof row.file_path === "string" ? row.file_path : null,
      });
    }
  } catch {
    // soft-fail
  }
  return map;
}

export async function GET(req: NextRequest) {
  try {
    const admin = createAdminClient();
    const op = await resolveOperatorForAdminRequest(req, admin);

    if (op.role === "DEVELOPER") {
      return adminJson(
        req,
        { ok: false, error: "Developers cannot run provenance search." },
        { status: 403 }
      );
    }

    if (op.role === "COMPANY_ADMIN" && !op.companyId) {
      return adminJson(
        req,
        { ok: false, error: "Company admin requires company_id on p4_profiles." },
        { status: 403 }
      );
    }

    const sp = req.nextUrl.searchParams;
    const q = sp.get("q")?.trim() || "";
    const projectOrigin = sp.get("project_origin")?.trim() || "";
    const traceId = sp.get("trace_id")?.trim() || "";
    const contentHash = sp.get("content_hash")?.trim() || "";
    const resourceKey = sp.get("resource_key")?.trim() || "";
    const tenantIdParam = sp.get("tenant_id")?.trim() || "";
    const limit = Math.min(25, Math.max(1, Number(sp.get("limit") || 25) || 25));

    if (!q && !projectOrigin && !traceId && !contentHash && !resourceKey) {
      return adminJson(
        req,
        {
          ok: false,
          error:
            "Require at least one of q, project_origin, trace_id, content_hash, or resource_key.",
        },
        { status: 400 }
      );
    }

    const tenantAllowlist =
      op.role === "COMPANY_ADMIN" && op.companyId
        ? await resolveCompanyTenantAllowlist(admin, op.companyId)
        : null;

    if (tenantIdParam && tenantAllowlist && !tenantAllowlist.includes(tenantIdParam)) {
      return adminJson(
        req,
        { ok: false, error: "tenant_id is outside your company scope." },
        { status: 403 }
      );
    }

    const impactByAudit = new Map<string, ImpactRow[]>();
    const auditIdsFromImpact = new Set<string>();
    const traceIdsFromImpact = new Set<string>();

    const needsImpact =
      Boolean(projectOrigin || contentHash || resourceKey) ||
      (Boolean(q) && !traceId);

    if (needsImpact || projectOrigin || contentHash || resourceKey) {
      try {
        let iq = admin
          .from("msgf_source_downstream_impact")
          .select(
            "audit_event_id, trace_id, tenant_id, project_origin, resource_key, content_hash, attribution_class, file_path, observed_at"
          )
          .order("observed_at", { ascending: false })
          .limit(Math.min(100, limit * 4));

        iq = applyTenantFilter(iq, tenantAllowlist, tenantIdParam);
        if (projectOrigin) iq = iq.eq("project_origin", projectOrigin);
        if (contentHash) iq = iq.eq("content_hash", contentHash);
        if (resourceKey) iq = iq.eq("resource_key", resourceKey);
        if (traceId) iq = iq.eq("trace_id", traceId);
        if (q && !contentHash && !resourceKey && !projectOrigin && !traceId) {
          const safe = q.replace(/[%_,.()]/g, " ").trim();
          if (safe) {
            const like = `%${safe}%`;
            iq = iq.or(
              `trace_id.ilike.${like},resource_key.ilike.${like},content_hash.ilike.${like},file_path.ilike.${like},project_origin.ilike.${like}`
            );
          }
        }

        const { data: impactRows } = await iq;
        for (const row of (impactRows ?? []) as ImpactRow[]) {
          auditIdsFromImpact.add(row.audit_event_id);
          traceIdsFromImpact.add(row.trace_id);
          const list = impactByAudit.get(row.audit_event_id) ?? [];
          list.push(row);
          impactByAudit.set(row.audit_event_id, list);
        }
      } catch {
        // soft-fail impact path
      }
    }

    let events: AuditEventRow[] = [];
    try {
      let eq = admin
        .from("msgf_source_audit_events")
        .select(
          "id, tenant_id, entity_id, trace_id, routing, logic_drift_score, defend_tier, defend_reason, sources, outcome, observed_at"
        )
        .order("observed_at", { ascending: false })
        .limit(limit);

      eq = applyTenantFilter(eq, tenantAllowlist, tenantIdParam);

      if (traceId) {
        eq = eq.eq("trace_id", traceId);
      } else if (auditIdsFromImpact.size > 0 && (contentHash || resourceKey || projectOrigin)) {
        eq = eq.in("id", [...auditIdsFromImpact].slice(0, 50));
      } else if (q) {
        const safe = q.replace(/[%_,.()]/g, " ").trim();
        if (safe) {
          const like = `%${safe}%`;
          eq = eq.or(
            `trace_id.ilike.${like},defend_reason.ilike.${like},routing.ilike.${like},outcome.ilike.${like},defend_tier.ilike.${like}`
          );
        }
      } else if (traceIdsFromImpact.size > 0) {
        eq = eq.in("trace_id", [...traceIdsFromImpact].slice(0, 50));
      }

      const { data } = await eq;
      events = (data ?? []) as AuditEventRow[];
    } catch {
      events = [];
    }

    // If impact-only filters yielded audits but event query missed them, soft-load by id.
    if (events.length === 0 && auditIdsFromImpact.size > 0) {
      try {
        let eq = admin
          .from("msgf_source_audit_events")
          .select(
            "id, tenant_id, entity_id, trace_id, routing, logic_drift_score, defend_tier, defend_reason, sources, outcome, observed_at"
          )
          .in("id", [...auditIdsFromImpact].slice(0, limit))
          .order("observed_at", { ascending: false })
          .limit(limit);
        eq = applyTenantFilter(eq, tenantAllowlist, tenantIdParam);
        const { data } = await eq;
        events = (data ?? []) as AuditEventRow[];
      } catch {
        events = [];
      }
    }

    const matches = [];
    for (const ev of events.slice(0, limit)) {
      const impacts = impactByAudit.get(ev.id) ?? [];
      const projectOriginResolved =
        impacts.find((i) => i.project_origin)?.project_origin ??
        (projectOrigin || null);

      const rawSources = parseSources(ev.sources);
      const resourceKeys = rawSources
        .map((s) => (typeof s.resource_key === "string" ? s.resource_key : ""))
        .filter(Boolean);
      const reputation = await softFetchReputation(admin, ev.tenant_id, resourceKeys);

      const sources: SourceOut[] = rawSources.map((s) => {
        const key = typeof s.resource_key === "string" ? s.resource_key : "";
        const rep = key ? reputation.get(key) : undefined;
        return {
          resource_key: key,
          file_path:
            (typeof s.file_path === "string" ? s.file_path : null) ??
            rep?.file_path ??
            null,
          score: typeof s.score === "number" ? s.score : null,
          content_hash: typeof s.content_hash === "string" ? s.content_hash : null,
          attribution_class:
            typeof s.attribution_class === "string" ? s.attribution_class : null,
          reputation_score: rep?.reputation_score ?? null,
          ledger:
            (typeof s.ledger === "string" ? s.ledger : null) ??
            (typeof s.kind === "string" ? s.kind : null) ??
            rep?.ledger ??
            null,
        };
      });

      const resourceIds = rawSources
        .map((s) =>
          typeof s.resource_id === "string"
            ? s.resource_id
            : typeof s.resource_key === "string" && s.resource_key.includes(":")
              ? s.resource_key.split(":")[1] ?? ""
              : ""
        )
        .filter(Boolean);

      const { vault, hall } = await softFetchPillarVectors(admin, resourceIds);
      const hal = await softFetchHal(admin, ev.entity_id);

      matches.push({
        trace_id: ev.trace_id,
        tenant_id: ev.tenant_id,
        project_origin: projectOriginResolved,
        observed_at: ev.observed_at,
        outcome: ev.outcome,
        defend_tier: ev.defend_tier,
        routing: ev.routing,
        logic_drift_score: ev.logic_drift_score,
        prompt_summary: ev.defend_reason ?? null,
        vault,
        hall,
        hal,
        sources,
      });
    }

    return adminJson(req, { ok: true, matches });
  } catch (e) {
    if (e instanceof MsgfAdminAuthError) {
      return adminJson(req, { ok: false, error: e.message }, { status: e.status });
    }
    const msg = e instanceof Error ? e.message : "Provenance search failed.";
    console.error("[admin/provenance-search] GET", e);
    return adminJson(req, { ok: false, error: msg, matches: [] }, { status: 500 });
  }
}
