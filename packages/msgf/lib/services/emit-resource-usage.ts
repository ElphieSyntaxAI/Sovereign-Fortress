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
 * Distribution Build ID: MSGF-08289e1a-20260923T172846Z-internal
 */
/**
 * Non-blocking resource usage emitter — Redis buffer → batched Postgres flush.
 * Raw search queries must never be stored; only query_text_hash.
 */

import { createHash } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { msgfRedisKey, redisGet, redisIncrWithWindow, redisSet, redisSetNx } from "@/lib/redis";

export type ResourceUsageProduct = "msgf" | "author" | "educates" | "ide" | "gateway";
export type ResourceUsageKind =
  | "vault"
  | "hall"
  | "file"
  | "tool"
  | "search"
  | "mcp"
  | "agent"
  | "citation"
  | "pack";

export type ResourceUsageEvent = {
  tenant_id: string;
  company_id?: string | null;
  product: ResourceUsageProduct;
  kind: ResourceUsageKind;
  resource_key: string;
  content_hash?: string | null;
  project_origin?: string | null;
  trace_id?: string | null;
  /** Raw query — hashed only; never persisted. */
  query_text?: string | null;
  observed_at?: string;
};

const BUFFER_KEY = (tenantId: string) => msgfRedisKey("resource-usage", "buf", tenantId);
const TENANT_INDEX_KEY = () => msgfRedisKey("resource-usage", "tenant-index");
const FLUSH_LOCK = (tenantId: string) => msgfRedisKey("resource-usage", "flush", tenantId);
const FLUSH_EVERY = 40;
const MAX_BUFFER = 200;

function hashQuery(text: string | null | undefined): string | null {
  const t = text?.trim();
  if (!t) return null;
  return createHash("sha256").update(t, "utf8").digest("hex");
}

function logUsage(scope: string, err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  console.warn(`[resource-usage] ${scope}:`, message);
}

async function rememberUsageTenant(tenantId: string): Promise<void> {
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
    /* ignore index failures */
  }
}

/** Cron-safe flush for one tenant buffer. */
export async function flushResourceUsageTenantBuffer(
  admin: SupabaseClient,
  tenantId: string
): Promise<void> {
  return flushTenantBuffer(admin, tenantId);
}

/** Drain all remembered tenant usage buffers (ops heartbeat). */
export async function flushAllResourceUsageBuffers(
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
      await flushTenantBuffer(admin, tid.trim());
      flushed += 1;
    } catch (e) {
      logUsage(`flushAll ${tid}`, e);
    }
  }
  return { tenants: list.length, flushed };
}

async function flushTenantBuffer(admin: SupabaseClient, tenantId: string): Promise<void> {
  const lockKey = FLUSH_LOCK(tenantId);
  const got = await redisSetNx(lockKey, "1", 30);
  if (!got) return;

  try {
    const raw = await redisGet(BUFFER_KEY(tenantId));
    if (!raw) return;
    await redisSet(BUFFER_KEY(tenantId), "[]", 3600);

    let events: ResourceUsageEvent[] = [];
    try {
      events = JSON.parse(raw) as ResourceUsageEvent[];
    } catch {
      return;
    }
    if (!Array.isArray(events) || events.length === 0) return;

    const rows = events
      .filter((e) => e.tenant_id?.trim() && e.resource_key?.trim())
      .map((e) => ({
        tenant_id: e.tenant_id.trim(),
        company_id: e.company_id ?? null,
        product: e.product,
        kind: e.kind,
        resource_key: e.resource_key.trim(),
        content_hash: e.content_hash ?? null,
        project_origin: e.project_origin ?? null,
        trace_id: e.trace_id ?? null,
        query_text_hash: hashQuery(e.query_text),
        observed_at: e.observed_at ?? new Date().toISOString(),
      }));

    if (rows.length === 0) return;

    const { error } = await admin.from("msgf_resource_usage_events").insert(rows);
    if (error) {
      logUsage("flush insert", error);
      return;
    }

    // Cite rollup (best-effort per key)
    const byKey = new Map<string, number>();
    for (const r of rows) {
      byKey.set(r.resource_key, (byKey.get(r.resource_key) ?? 0) + 1);
    }
    await Promise.allSettled(
      [...byKey.entries()].map(async ([resource_key, n]) => {
        const { data: existing } = await admin
          .from("msgf_resource_reputation")
          .select("cite_count, ledger")
          .eq("tenant_id", tenantId)
          .eq("resource_key", resource_key)
          .maybeSingle();

        const cite = Number(existing?.cite_count ?? 0) + n;
        const sample = rows.find((r) => r.resource_key === resource_key);
        const ledger =
          existing?.ledger ??
          (sample?.kind === "hall"
            ? "hall"
            : sample?.kind === "file"
              ? "file"
              : sample?.kind && ["tool", "search", "mcp", "agent", "citation", "pack"].includes(sample.kind)
                ? sample.kind
                : "vault");

        await admin.from("msgf_resource_reputation").upsert(
          {
            tenant_id: tenantId,
            resource_key,
            ledger,
            cite_count: cite,
            last_used_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "tenant_id,resource_key" }
        );
      })
    );
  } catch (e) {
    logUsage("flushTenantBuffer", e);
  }
}

/**
 * Non-blocking: enqueue usage; flush when buffer grows. Never throws to caller.
 */
export function emitResourceUsage(admin: SupabaseClient, event: ResourceUsageEvent): void {
  void (async () => {
    try {
      const tid = event.tenant_id?.trim();
      const key = event.resource_key?.trim();
      if (!tid || !key) return;

      const payload: ResourceUsageEvent = {
        ...event,
        tenant_id: tid,
        resource_key: key,
        observed_at: event.observed_at ?? new Date().toISOString(),
        // Strip raw query before any accidental persistence in Redis long-term
        query_text: event.query_text ?? null,
      };

      const bufKey = BUFFER_KEY(tid);
      const raw = await redisGet(bufKey);
      let list: ResourceUsageEvent[] = [];
      if (raw) {
        try {
          list = JSON.parse(raw) as ResourceUsageEvent[];
        } catch {
          list = [];
        }
      }
      if (!Array.isArray(list)) list = [];
      list.push(payload);
      if (list.length > MAX_BUFFER) list = list.slice(-MAX_BUFFER);
      await redisSet(bufKey, JSON.stringify(list), 3600);
      await rememberUsageTenant(tid);

      const count = await redisIncrWithWindow(
        msgfRedisKey("resource-usage", "cnt", tid),
        60
      );
      if (list.length >= FLUSH_EVERY || (typeof count === "number" && count % FLUSH_EVERY === 0)) {
        await flushTenantBuffer(admin, tid);
      }
    } catch (e) {
      // Fallback: direct insert if Redis unavailable
      try {
        const tid = event.tenant_id?.trim();
        const key = event.resource_key?.trim();
        if (!tid || !key) return;
        await admin.from("msgf_resource_usage_events").insert({
          tenant_id: tid,
          company_id: event.company_id ?? null,
          product: event.product,
          kind: event.kind,
          resource_key: key,
          content_hash: event.content_hash ?? null,
          project_origin: event.project_origin ?? null,
          trace_id: event.trace_id ?? null,
          query_text_hash: hashQuery(event.query_text),
          observed_at: event.observed_at ?? new Date().toISOString(),
        });
      } catch (e2) {
        logUsage("emitResourceUsage", e2 ?? e);
      }
    }
  })();
}

export async function rankResourceUsage(
  admin: SupabaseClient,
  opts: {
    tenant_id: string;
    since_days?: number;
    kind?: string | null;
    project_origin?: string | null;
    q?: string | null;
    limit?: number;
  }
): Promise<
  Array<{
    resource_key: string;
    uses: number;
    last_used: string;
    kind_sample: string | null;
    product_sample: string | null;
  }>
> {
  const tid = opts.tenant_id.trim();
  const limit = Math.min(50, Math.max(1, opts.limit ?? 20));
  const sinceDays = Math.min(365, Math.max(1, opts.since_days ?? 30));
  const sinceIso = new Date(Date.now() - sinceDays * 86_400_000).toISOString();

  let q = admin
    .from("msgf_resource_usage_events")
    .select("resource_key, kind, product, observed_at")
    .eq("tenant_id", tid)
    .gte("observed_at", sinceIso)
    .order("observed_at", { ascending: false })
    .limit(2000);

  if (opts.kind?.trim()) q = q.eq("kind", opts.kind.trim());
  if (opts.project_origin?.trim()) q = q.eq("project_origin", opts.project_origin.trim());

  const { data, error } = await q;
  if (error) {
    logUsage("rankResourceUsage", error);
    return [];
  }

  const needle = opts.q?.trim().toLowerCase() ?? "";
  const map = new Map<
    string,
    { uses: number; last_used: string; kind_sample: string | null; product_sample: string | null }
  >();

  for (const row of data ?? []) {
    const rk = typeof row.resource_key === "string" ? row.resource_key : "";
    if (!rk) continue;
    if (needle && !rk.toLowerCase().includes(needle)) continue;
    const prev = map.get(rk);
    const observed = typeof row.observed_at === "string" ? row.observed_at : new Date().toISOString();
    if (!prev) {
      map.set(rk, {
        uses: 1,
        last_used: observed,
        kind_sample: typeof row.kind === "string" ? row.kind : null,
        product_sample: typeof row.product === "string" ? row.product : null,
      });
    } else {
      prev.uses += 1;
      if (observed > prev.last_used) prev.last_used = observed;
    }
  }

  return [...map.entries()]
    .map(([resource_key, v]) => ({ resource_key, ...v }))
    .sort((a, b) => b.uses - a.uses)
    .slice(0, limit);
}

export { hashQuery as hashResourceQueryText };
