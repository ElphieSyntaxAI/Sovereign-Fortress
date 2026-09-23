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
 * Async SIEM exporter — never blocks the primary request path.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { emitPlatformAudit } from "@/lib/services/emit-platform-audit";

export type SiemPayload = {
  resourceLogs: Array<{
    resource: { attributes: Array<{ key: string; value: { stringValue: string } }> };
    scopeLogs: Array<{
      logRecords: Array<{
        timeUnixNano: string;
        severityText: string;
        body: { stringValue: string };
        attributes: Array<{ key: string; value: { stringValue: string } }>;
      }>;
    }>;
  }>;
};

function toOtelJson(row: {
  kind: string;
  severity?: string;
  summary: string;
  tenant_id: string;
  trace_id?: string | null;
  created_at?: string;
  metadata?: Record<string, unknown>;
}): SiemPayload {
  const ts =
    BigInt(Date.parse(row.created_at ?? new Date().toISOString()) || Date.now()) *
    BigInt(1_000_000);
  return {
    resourceLogs: [
      {
        resource: {
          attributes: [
            { key: "service.name", value: { stringValue: "msgf" } },
            { key: "tenant_id", value: { stringValue: row.tenant_id } },
          ],
        },
        scopeLogs: [
          {
            logRecords: [
              {
                timeUnixNano: ts.toString(),
                severityText: (row.severity ?? "info").toUpperCase(),
                body: { stringValue: row.summary },
                attributes: [
                  { key: "kind", value: { stringValue: row.kind } },
                  {
                    key: "trace_id",
                    value: { stringValue: row.trace_id ?? "" },
                  },
                  {
                    key: "metadata",
                    value: { stringValue: JSON.stringify(row.metadata ?? {}) },
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

/** Fire-and-forget webhook POST with simple retry. */
export function enqueueSiemExport(
  admin: SupabaseClient,
  opts: {
    tenant_id: string;
    kind: string;
    severity?: string;
    summary: string;
    trace_id?: string | null;
    metadata?: Record<string, unknown>;
    created_at?: string;
  }
): void {
  void (async () => {
    try {
      const tid = opts.tenant_id.trim();
      if (!tid) return;
      const { data: cfg } = await admin
        .from("msgf_siem_integrations")
        .select("webhook_url, auth_secret_encrypted, enabled")
        .eq("tenant_id", tid)
        .maybeSingle();

      if (!cfg?.enabled || !cfg.webhook_url?.trim()) return;

      const body = JSON.stringify(
        toOtelJson({
          kind: opts.kind,
          severity: opts.severity,
          summary: opts.summary,
          tenant_id: tid,
          trace_id: opts.trace_id,
          created_at: opts.created_at,
          metadata: opts.metadata,
        })
      );

      let lastErr: string | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const headers: Record<string, string> = {
            "content-type": "application/json",
          };
          if (cfg.auth_secret_encrypted?.trim()) {
            headers.authorization = `Bearer ${cfg.auth_secret_encrypted.trim()}`;
          }
          const res = await fetch(cfg.webhook_url.trim(), {
            method: "POST",
            headers,
            body,
            signal: AbortSignal.timeout(8_000),
          });
          if (res.ok) {
            await admin
              .from("msgf_siem_integrations")
              .update({
                last_export_at: new Date().toISOString(),
                last_error: null,
                updated_at: new Date().toISOString(),
              })
              .eq("tenant_id", tid);
            return;
          }
          lastErr = `HTTP ${res.status}`;
        } catch (e) {
          lastErr = e instanceof Error ? e.message : String(e);
        }
        await new Promise((r) => setTimeout(r, 200 * 2 ** attempt));
      }

      await admin
        .from("msgf_siem_integrations")
        .update({
          last_error: lastErr,
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", tid);

      emitPlatformAudit(admin, {
        product: "msgf",
        tenant_id: tid,
        kind: "siem_export_fail",
        severity: "warn",
        summary: `SIEM export failed: ${lastErr}`,
      });
    } catch (e) {
      console.warn("[siem-exporter]", e instanceof Error ? e.message : e);
    }
  })();
}

/**
 * Cron batch: push recent hub events for every enabled SIEM integration.
 * Never throws; returns counts for heartbeat telemetry.
 */
export async function flushPendingSiemExports(
  admin: SupabaseClient,
  opts?: { lookbackMinutes?: number; limitPerTenant?: number }
): Promise<{ tenants: number; exported: number; failed: number }> {
  const lookback = Math.max(5, opts?.lookbackMinutes ?? 90);
  const limitPer = Math.min(50, Math.max(1, opts?.limitPerTenant ?? 20));
  const since = new Date(Date.now() - lookback * 60_000).toISOString();

  const { data: cfgs, error } = await admin
    .from("msgf_siem_integrations")
    .select("tenant_id, webhook_url, auth_secret_encrypted, enabled, last_export_at")
    .eq("enabled", true);

  if (error || !cfgs?.length) {
    return { tenants: 0, exported: 0, failed: 0 };
  }

  let exported = 0;
  let failed = 0;

  for (const cfg of cfgs) {
    const tid = typeof cfg.tenant_id === "string" ? cfg.tenant_id.trim() : "";
    if (!tid || !cfg.webhook_url?.trim()) continue;

    const after =
      typeof cfg.last_export_at === "string" && cfg.last_export_at.trim()
        ? cfg.last_export_at
        : since;

    const { data: events } = await admin
      .from("platform_audit_events")
      .select("kind, severity, summary, tenant_id, trace_id, created_at, metadata")
      .eq("tenant_id", tid)
      .gt("created_at", after)
      .order("created_at", { ascending: true })
      .limit(limitPer);

    for (const ev of events ?? []) {
      try {
        const body = JSON.stringify(
          toOtelJson({
            kind: String(ev.kind ?? "audit"),
            severity: String(ev.severity ?? "info"),
            summary: String(ev.summary ?? ""),
            tenant_id: tid,
            trace_id: typeof ev.trace_id === "string" ? ev.trace_id : null,
            created_at: typeof ev.created_at === "string" ? ev.created_at : undefined,
            metadata:
              ev.metadata && typeof ev.metadata === "object"
                ? (ev.metadata as Record<string, unknown>)
                : {},
          })
        );
        const headers: Record<string, string> = {
          "content-type": "application/json",
        };
        if (cfg.auth_secret_encrypted?.trim()) {
          headers.authorization = `Bearer ${cfg.auth_secret_encrypted.trim()}`;
        }
        const res = await fetch(String(cfg.webhook_url).trim(), {
          method: "POST",
          headers,
          body,
          signal: AbortSignal.timeout(8_000),
        });
        if (res.ok) {
          exported += 1;
          await admin
            .from("msgf_siem_integrations")
            .update({
              last_export_at: new Date().toISOString(),
              last_error: null,
              updated_at: new Date().toISOString(),
            })
            .eq("tenant_id", tid);
        } else {
          failed += 1;
        }
      } catch {
        failed += 1;
      }
    }
  }

  return { tenants: cfgs.length, exported, failed };
}
