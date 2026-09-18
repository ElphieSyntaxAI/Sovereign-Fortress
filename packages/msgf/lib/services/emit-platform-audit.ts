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
 * Non-blocking platform audit hub emitter.
 * Sister apps must never block on MSGF latency — enqueue and return.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { msgfRedisKey, redisGet, redisSet } from "@/lib/redis";

export type PlatformAuditSeverity = "debug" | "info" | "warn" | "error" | "critical";

export type PlatformAuditEvent = {
  product: string;
  tenant_id: string;
  company_id?: string | null;
  entity_id?: string | null;
  kind: string;
  severity?: PlatformAuditSeverity;
  trace_id?: string | null;
  ref_table?: string | null;
  ref_id?: string | null;
  summary: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
};

const BUFFER_KEY = (tenantId: string) => msgfRedisKey("platform-audit", "buf", tenantId);
const TENANT_INDEX_KEY = () => msgfRedisKey("platform-audit", "tenant-index");
const FLUSH_EVERY = 25;
const MAX_BUFFER = 150;

function logAudit(scope: string, err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  console.warn(`[platform-audit] ${scope}:`, message);
}

async function rememberAuditTenant(tenantId: string): Promise<void> {
  try {
    const raw = await redisGet(TENANT_INDEX_KEY());
    let list: string[] = [];
    if (raw) {
      try {
        list = JSON.parse(raw) as string[];
      } catch {
        list = [];
      }
    }
    if (!Array.isArray(list)) list = [];
    if (!list.includes(tenantId)) {
      list.push(tenantId);
      if (list.length > 5_000) list = list.slice(-5_000);
      await redisSet(TENANT_INDEX_KEY(), JSON.stringify(list), 86400 * 7);
    }
  } catch {
    /* ignore */
  }
}

/** Cron-safe flush for one tenant audit buffer. */
export async function flushPlatformAuditTenantBuffer(
  admin: SupabaseClient,
  tenantId: string
): Promise<void> {
  return flushAuditBuffer(admin, tenantId);
}

/** Drain all remembered platform-audit buffers (ops heartbeat). */
export async function flushAllPlatformAuditBuffers(
  admin: SupabaseClient
): Promise<{ tenants: number; flushed: number }> {
  const raw = await redisGet(TENANT_INDEX_KEY());
  let list: string[] = [];
  if (raw) {
    try {
      list = JSON.parse(raw) as string[];
    } catch {
      list = [];
    }
  }
  if (!Array.isArray(list) || list.length === 0) {
    return { tenants: 0, flushed: 0 };
  }
  let flushed = 0;
  for (const tid of list) {
    if (!tid?.trim()) continue;
    try {
      await flushAuditBuffer(admin, tid.trim());
      flushed += 1;
    } catch (e) {
      logAudit(`flushAll ${tid}`, e);
    }
  }
  return { tenants: list.length, flushed };
}

async function flushAuditBuffer(admin: SupabaseClient, tenantId: string): Promise<void> {
  try {
    const raw = await redisGet(BUFFER_KEY(tenantId));
    if (!raw) return;
    await redisSet(BUFFER_KEY(tenantId), "[]", 3600);
    let events: PlatformAuditEvent[] = [];
    try {
      events = JSON.parse(raw) as PlatformAuditEvent[];
    } catch {
      return;
    }
    if (!Array.isArray(events) || events.length === 0) return;

    const rows = events
      .filter((e) => e.tenant_id?.trim() && e.kind?.trim())
      .map((e) => ({
        product: e.product || "msgf",
        tenant_id: e.tenant_id.trim(),
        company_id: e.company_id ?? null,
        entity_id: e.entity_id ?? null,
        kind: e.kind.trim(),
        severity: e.severity ?? "info",
        trace_id: e.trace_id ?? null,
        ref_table: e.ref_table ?? null,
        ref_id: e.ref_id ?? null,
        summary: e.summary?.slice(0, 2000) ?? "",
        metadata: e.metadata ?? {},
        created_at: e.created_at ?? new Date().toISOString(),
      }));

    if (rows.length === 0) return;
    const { error } = await admin.from("platform_audit_events").insert(rows);
    if (error) logAudit("flush insert", error);
  } catch (e) {
    logAudit("flushAuditBuffer", e);
  }
}

/** Fire-and-forget; never throws to caller. */
export function emitPlatformAudit(admin: SupabaseClient, event: PlatformAuditEvent): void {
  void (async () => {
    try {
      const tid = event.tenant_id?.trim();
      if (!tid || !event.kind?.trim()) return;

      const payload: PlatformAuditEvent = {
        ...event,
        tenant_id: tid,
        created_at: event.created_at ?? new Date().toISOString(),
      };

      const bufKey = BUFFER_KEY(tid);
      const raw = await redisGet(bufKey);
      let list: PlatformAuditEvent[] = [];
      if (raw) {
        try {
          list = JSON.parse(raw) as PlatformAuditEvent[];
        } catch {
          list = [];
        }
      }
      if (!Array.isArray(list)) list = [];
      list.push(payload);
      if (list.length > MAX_BUFFER) list = list.slice(-MAX_BUFFER);
      await redisSet(bufKey, JSON.stringify(list), 3600);
      await rememberAuditTenant(tid);

      if (list.length >= FLUSH_EVERY) {
        await flushAuditBuffer(admin, tid);
      }
    } catch {
      try {
        const tid = event.tenant_id?.trim();
        if (!tid) return;
        await admin.from("platform_audit_events").insert({
          product: event.product || "msgf",
          tenant_id: tid,
          company_id: event.company_id ?? null,
          entity_id: event.entity_id ?? null,
          kind: event.kind,
          severity: event.severity ?? "info",
          trace_id: event.trace_id ?? null,
          ref_table: event.ref_table ?? null,
          ref_id: event.ref_id ?? null,
          summary: event.summary?.slice(0, 2000) ?? "",
          metadata: event.metadata ?? {},
          created_at: event.created_at ?? new Date().toISOString(),
        });
      } catch (e2) {
        logAudit("emitPlatformAudit", e2);
      }
    }
  })();
}

export async function searchPlatformAudit(
  admin: SupabaseClient,
  opts: {
    tenant_id?: string | null;
    company_id?: string | null;
    /** When true, GLOBAL_ADMIN may omit tenant filter. */
    cross_tenant?: boolean;
    kind?: string | null;
    severity?: string | null;
    product?: string | null;
    trace_id?: string | null;
    q?: string | null;
    limit?: number;
    before?: string | null;
  }
): Promise<Record<string, unknown>[]> {
  const limit = Math.min(100, Math.max(1, opts.limit ?? 40));
  let query = admin
    .from("platform_audit_events")
    .select(
      "id, product, tenant_id, company_id, entity_id, kind, severity, trace_id, ref_table, ref_id, summary, metadata, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!opts.cross_tenant) {
    if (opts.tenant_id?.trim()) query = query.eq("tenant_id", opts.tenant_id.trim());
    if (opts.company_id?.trim()) query = query.eq("company_id", opts.company_id.trim());
  } else if (opts.tenant_id?.trim()) {
    query = query.eq("tenant_id", opts.tenant_id.trim());
  }

  if (opts.kind?.trim()) query = query.eq("kind", opts.kind.trim());
  if (opts.severity?.trim()) query = query.eq("severity", opts.severity.trim());
  if (opts.product?.trim()) query = query.eq("product", opts.product.trim());
  if (opts.trace_id?.trim()) query = query.eq("trace_id", opts.trace_id.trim());
  if (opts.before?.trim()) query = query.lt("created_at", opts.before.trim());

  const { data, error } = await query;
  if (error) {
    logAudit("searchPlatformAudit", error);
    return [];
  }

  const needle = opts.q?.trim().toLowerCase() ?? "";
  if (!needle) return (data ?? []) as Record<string, unknown>[];

  return ((data ?? []) as Record<string, unknown>[]).filter((row) =>
    auditEventMatchesQuery(row, needle)
  );
}

export function auditEventMatchesQuery(row: Record<string, unknown>, needle: string): boolean {
  const q = needle.trim().toLowerCase();
  if (!q) return true;
  const summary = String(row.summary ?? "").toLowerCase();
  const kind = String(row.kind ?? "").toLowerCase();
  const trace = String(row.trace_id ?? "").toLowerCase();
  const meta = JSON.stringify(row.metadata ?? {}).toLowerCase();
  return (
    summary.includes(q) ||
    kind.includes(q) ||
    trace.includes(q) ||
    meta.includes(q)
  );
}
