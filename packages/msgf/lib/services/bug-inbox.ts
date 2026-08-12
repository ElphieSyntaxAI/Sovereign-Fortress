/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * Distribution Build ID: MSGF-1b90a4ac-20260802T111608Z-internal
 */
/**
 * Operator bug inbox — list / promote / dismiss p4_active_incidents.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { listUserIdsForCompany } from "@/lib/msgf-operator-access";
import { PULSE_BUG_INDEX } from "@/lib/schemas/vault-hall-metadata";
import { insertMsgfUserSentinelIncident } from "@/lib/services/msgf-incidents";
import { withMsgfMetadataScope } from "@/lib/services/msgf-metadata-scope";

export type BugInboxStatus = "open" | "promoted" | "dismissed";

export type BugInboxRow = {
  id: string;
  tenant_id: string;
  error_message: string;
  location: string;
  severity: string;
  occurrence_count: number;
  first_seen_at: string;
  last_seen_at: string;
  inbox_status: BugInboxStatus;
  promoted_msgf_incident_id: string | null;
  inbox_note: string | null;
  inbox_updated_at: string | null;
};

function normalizeStatus(raw: unknown): BugInboxStatus {
  if (raw === "promoted" || raw === "dismissed" || raw === "open") return raw;
  return "open";
}

function mapRow(row: Record<string, unknown>): BugInboxRow {
  return {
    id: String(row.id ?? ""),
    tenant_id: String(row.tenant_id ?? ""),
    error_message: String(row.error_message ?? ""),
    location: String(row.location ?? ""),
    severity: String(row.severity ?? "Yellow"),
    occurrence_count: Number(row.occurrence_count ?? 1) || 1,
    first_seen_at: String(row.first_seen_at ?? ""),
    last_seen_at: String(row.last_seen_at ?? ""),
    inbox_status: normalizeStatus(row.inbox_status),
    promoted_msgf_incident_id:
      typeof row.promoted_msgf_incident_id === "string"
        ? row.promoted_msgf_incident_id
        : null,
    inbox_note: typeof row.inbox_note === "string" ? row.inbox_note : null,
    inbox_updated_at:
      typeof row.inbox_updated_at === "string" ? row.inbox_updated_at : null,
  };
}

async function companyTenantAllowlist(
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
    const { data } = await admin
      .from("p4_profiles")
      .select("tenant_id")
      .in("user_id", memberIds);
    for (const row of data ?? []) {
      const tid =
        typeof row.tenant_id === "string" && row.tenant_id.trim()
          ? row.tenant_id.trim()
          : "";
      if (tid) tenants.add(tid);
    }
  }
  return [...tenants];
}

export async function listBugInbox(params: {
  admin: SupabaseClient;
  status?: BugInboxStatus | "all";
  tenantId?: string | null;
  companyId?: string | null;
  q?: string | null;
  limit?: number;
}): Promise<{ rows: BugInboxRow[]; count: number }> {
  const limit = Math.min(100, Math.max(1, params.limit ?? 40));
  const status = params.status ?? "open";

  let query = params.admin
    .from("p4_active_incidents")
    .select(
      "id, tenant_id, error_message, location, severity, occurrence_count, first_seen_at, last_seen_at, inbox_status, promoted_msgf_incident_id, inbox_note, inbox_updated_at",
      { count: "exact" }
    )
    .order("last_seen_at", { ascending: false })
    .limit(limit);

  if (status !== "all") {
    query = query.eq("inbox_status", status);
  }

  if (params.tenantId?.trim()) {
    query = query.eq("tenant_id", params.tenantId.trim());
  } else if (params.companyId?.trim()) {
    const allow = await companyTenantAllowlist(params.admin, params.companyId);
    if (allow.length === 0) {
      return { rows: [], count: 0 };
    }
    query = query.in("tenant_id", allow);
  }

  const q = params.q?.trim();
  if (q) {
    const safe = q.replace(/[%_,]/g, " ").slice(0, 120);
    query = query.or(
      `error_message.ilike.%${safe}%,location.ilike.%${safe}%,tenant_id.ilike.%${safe}%`
    );
  }

  const { data, error, count } = await query;
  if (error) {
    if (/inbox_status/i.test(error.message)) {
      return listBugInboxLegacy(params);
    }
    throw new Error(error.message);
  }

  return {
    rows: (data ?? []).map((r) => mapRow(r as Record<string, unknown>)),
    count: count ?? 0,
  };
}

async function listBugInboxLegacy(params: {
  admin: SupabaseClient;
  status?: BugInboxStatus | "all";
  tenantId?: string | null;
  companyId?: string | null;
  q?: string | null;
  limit?: number;
}): Promise<{ rows: BugInboxRow[]; count: number }> {
  const limit = Math.min(100, Math.max(1, params.limit ?? 40));
  if (params.status && params.status !== "open" && params.status !== "all") {
    return { rows: [], count: 0 };
  }

  let query = params.admin
    .from("p4_active_incidents")
    .select(
      "id, tenant_id, error_message, location, severity, occurrence_count, first_seen_at, last_seen_at",
      { count: "exact" }
    )
    .order("last_seen_at", { ascending: false })
    .limit(limit);

  if (params.tenantId?.trim()) {
    query = query.eq("tenant_id", params.tenantId.trim());
  } else if (params.companyId?.trim()) {
    const allow = await companyTenantAllowlist(params.admin, params.companyId);
    if (allow.length === 0) return { rows: [], count: 0 };
    query = query.in("tenant_id", allow);
  }

  const q = params.q?.trim();
  if (q) {
    const safe = q.replace(/[%_,]/g, " ").slice(0, 120);
    query = query.or(
      `error_message.ilike.%${safe}%,location.ilike.%${safe}%,tenant_id.ilike.%${safe}%`
    );
  }

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  return {
    rows: (data ?? []).map((r) =>
      mapRow({ ...(r as Record<string, unknown>), inbox_status: "open" })
    ),
    count: count ?? 0,
  };
}

export async function promoteBugInboxItem(params: {
  admin: SupabaseClient;
  id: string;
  operatorUserId: string;
  note?: string | null;
  companyId?: string | null;
}): Promise<{ row: BugInboxRow; msgf_incident_id: string }> {
  const { data: existing, error: readErr } = await params.admin
    .from("p4_active_incidents")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (readErr) throw new Error(readErr.message);
  if (!existing) throw new Error("Bug report not found.");

  const row = mapRow(existing as Record<string, unknown>);
  if (row.inbox_status === "promoted" && row.promoted_msgf_incident_id) {
    return { row, msgf_incident_id: row.promoted_msgf_incident_id };
  }
  if (row.inbox_status === "dismissed") {
    throw new Error("Dismissed reports cannot be promoted.");
  }

  if (params.companyId) {
    const allow = await companyTenantAllowlist(params.admin, params.companyId);
    if (!allow.includes(row.tenant_id)) {
      throw new Error("Report is outside your company scope.");
    }
  }

  const note = (params.note ?? "").trim().slice(0, 1000);
  const reportBlurb = [
    row.error_message.slice(0, 800),
    row.location ? `Location: ${row.location.slice(0, 200)}` : "",
    `Occurrences: ${row.occurrence_count}`,
    note ? `Operator note: ${note}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const msgfId = await insertMsgfUserSentinelIncident({
    adminSupabase: params.admin,
    userId: params.operatorUserId,
    bugIndex: PULSE_BUG_INDEX.userSentinelReport,
    strategies: null,
    scope: {
      tenantId: row.tenant_id,
      entityId: params.operatorUserId,
      companyId: params.companyId,
      projectOrigin: row.location.includes("/") ? row.location.slice(0, 200) : null,
    },
  });

  if (!msgfId) {
    throw new Error("Failed to create USER_SENTINEL incident for ARBITRATE queue.");
  }

  await params.admin
    .from("msgf_incidents")
    .update({
      resolution_note: `Bug inbox report:\n${reportBlurb}`.slice(0, 4000),
      metadata: withMsgfMetadataScope(
        {
          bug_inbox_id: row.id,
          error_message: row.error_message.slice(0, 2000),
          location: row.location.slice(0, 500),
          occurrence_count: row.occurrence_count,
          severity: row.severity,
        },
        {
          tenantId: row.tenant_id,
          entityId: params.operatorUserId,
          companyId: params.companyId,
        }
      ),
    })
    .eq("id", msgfId);

  const now = new Date().toISOString();
  const { data: updated, error: updErr } = await params.admin
    .from("p4_active_incidents")
    .update({
      inbox_status: "promoted",
      promoted_msgf_incident_id: msgfId,
      inbox_note: note || null,
      inbox_updated_at: now,
    })
    .eq("id", row.id)
    .select("*")
    .maybeSingle();

  if (updErr) {
    if (/inbox_status/i.test(updErr.message)) {
      throw new Error(
        "Bug inbox migration not applied. Run db:push for 20260811010000_p4_active_incidents_bug_inbox.sql"
      );
    }
    throw new Error(updErr.message);
  }

  return {
    row: mapRow((updated ?? existing) as Record<string, unknown>),
    msgf_incident_id: msgfId,
  };
}

export async function dismissBugInboxItem(params: {
  admin: SupabaseClient;
  id: string;
  note?: string | null;
  companyId?: string | null;
}): Promise<BugInboxRow> {
  const { data: existing, error: readErr } = await params.admin
    .from("p4_active_incidents")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (readErr) throw new Error(readErr.message);
  if (!existing) throw new Error("Bug report not found.");

  const row = mapRow(existing as Record<string, unknown>);
  if (params.companyId) {
    const allow = await companyTenantAllowlist(params.admin, params.companyId);
    if (!allow.includes(row.tenant_id)) {
      throw new Error("Report is outside your company scope.");
    }
  }

  const note = (params.note ?? "").trim().slice(0, 1000);
  const now = new Date().toISOString();
  const { data: updated, error: updErr } = await params.admin
    .from("p4_active_incidents")
    .update({
      inbox_status: "dismissed",
      inbox_note: note || row.inbox_note,
      inbox_updated_at: now,
    })
    .eq("id", row.id)
    .select("*")
    .maybeSingle();

  if (updErr) {
    if (/inbox_status/i.test(updErr.message)) {
      throw new Error(
        "Bug inbox migration not applied. Run db:push for 20260811010000_p4_active_incidents_bug_inbox.sql"
      );
    }
    throw new Error(updErr.message);
  }

  return mapRow(
    (updated ?? { ...existing, inbox_status: "dismissed" }) as Record<string, unknown>
  );
}
