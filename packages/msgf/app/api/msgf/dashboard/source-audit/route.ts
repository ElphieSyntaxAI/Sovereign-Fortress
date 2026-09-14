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
 * Distribution Build ID: MSGF-c122f849-20260911T161212Z-internal
 */
/**
 * GET /api/msgf/dashboard/source-audit
 * Forward: recent P7 audit events + reputation tops.
 * Impact: ?content_hash= or ?resource_key= for reverse lookup.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies, headers } from "next/headers";

import {
  DashboardTenantAccessError,
  validateDashboardTenantAccess,
} from "@/lib/auth/dashboard-guard";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient, requestHostFromHeaders } from "@/utils/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const hdrs = await headers();
    const supabase = createClient(cookieStore, requestHostFromHeaders(hdrs));
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    let tenantId = req.nextUrl.searchParams.get("tenant_id")?.trim() || "";
    if (!tenantId) {
      const { data } = await admin
        .from("p4_profiles")
        .select("tenant_id")
        .eq("user_id", user.id)
        .maybeSingle();
      tenantId =
        (typeof data?.tenant_id === "string" && data.tenant_id.trim()) || user.id;
    }

    try {
      await validateDashboardTenantAccess(admin, { user }, tenantId);
    } catch (e) {
      if (e instanceof DashboardTenantAccessError) {
        return NextResponse.json(
          { ok: false, error: e.message },
          { status: e.status }
        );
      }
      throw e;
    }

    const limit = Math.min(
      50,
      Math.max(1, Number(req.nextUrl.searchParams.get("limit") || 20) || 20)
    );
    const contentHash = req.nextUrl.searchParams.get("content_hash")?.trim() || "";
    const resourceKey = req.nextUrl.searchParams.get("resource_key")?.trim() || "";
    const mode = req.nextUrl.searchParams.get("mode")?.trim() || "";
    const sinceDays = Math.min(
      365,
      Math.max(1, Number(req.nextUrl.searchParams.get("since_days") || 90) || 90)
    );
    const sinceIso = new Date(Date.now() - sinceDays * 86_400_000).toISOString();

    if (mode === "rank") {
      const { rankResourceUsage } = await import("@/lib/services/emit-resource-usage");
      const rankings = await rankResourceUsage(admin, {
        tenant_id: tenantId,
        since_days: Math.min(
          365,
          Math.max(1, Number(req.nextUrl.searchParams.get("since_days") || 30) || 30)
        ),
        kind: req.nextUrl.searchParams.get("kind"),
        project_origin: req.nextUrl.searchParams.get("project_origin"),
        q: req.nextUrl.searchParams.get("q"),
        limit,
      });
      return NextResponse.json({
        ok: true,
        mode: "rank",
        tenant_id: tenantId,
        rankings,
      });
    }

    if (contentHash || resourceKey) {
      let q = admin
        .from("msgf_source_downstream_impact")
        .select(
          "id, trace_id, project_origin, resource_key, content_hash, attribution_class, file_path, observed_at, audit_event_id"
        )
        .eq("tenant_id", tenantId)
        .gte("observed_at", sinceIso)
        .order("observed_at", { ascending: false })
        .limit(limit);

      if (contentHash) q = q.eq("content_hash", contentHash);
      if (resourceKey) q = q.eq("resource_key", resourceKey);

      const { data, error } = await q;
      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        ok: true,
        mode: "impact",
        tenant_id: tenantId,
        since_days: sinceDays,
        impact: data ?? [],
      });
    }

    const [eventsRes, preferredRes, demotedRes] = await Promise.all([
      admin
        .from("msgf_source_audit_events")
        .select(
          "id, trace_id, decision_kind, routing, logic_drift_score, defend_tier, defend_reason, sources, outcome, observed_at"
        )
        .eq("tenant_id", tenantId)
        .order("observed_at", { ascending: false })
        .limit(limit),
      admin
        .from("msgf_resource_reputation")
        .select(
          "resource_key, ledger, file_path, reputation_score, good_count, bad_count, high_drift_count, last_content_hash, updated_at"
        )
        .eq("tenant_id", tenantId)
        .order("reputation_score", { ascending: false })
        .limit(10),
      admin
        .from("msgf_resource_reputation")
        .select(
          "resource_key, ledger, file_path, reputation_score, good_count, bad_count, high_drift_count, last_content_hash, updated_at"
        )
        .eq("tenant_id", tenantId)
        .lt("reputation_score", -0.3)
        .order("reputation_score", { ascending: true })
        .limit(10),
    ]);

    if (eventsRes.error) {
      return NextResponse.json({ ok: false, error: eventsRes.error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      mode: "forward",
      tenant_id: tenantId,
      events: eventsRes.data ?? [],
      preferred: preferredRes.data ?? [],
      demoted: demotedRes.data ?? [],
      note: "P7 Source Audit — content_hash fingerprints prove exact chunks; impact query via ?content_hash= or ?resource_key=.",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "source-audit failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
