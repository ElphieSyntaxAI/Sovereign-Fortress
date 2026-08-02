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
 * Distribution Build ID: MSGF-149f647f-20260728T230931Z-internal
 */
import { createHash, createHmac, timingSafeEqual } from "crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

export const ARBITRATE_AUDIT_GENESIS_HASH =
  "0000000000000000000000000000000000000000000000000000000000000000";

export type ArbitrateAuditSource =
  | "heal_queue_human_arbitration"
  | "admin_incident_resolve";

export type ArbitrateAuditPayload = {
  schema_version: 1;
  source: ArbitrateAuditSource;
  project_origin: string;
  operator_id: string | null;
  action: string;
  incident_id: string | null;
  file_path: string | null;
  tenant_id: string | null;
  entity_id: string | null;
  bug_index: unknown;
  model_opinions: unknown;
  inputs: Record<string, unknown>;
  resolution: Record<string, unknown>;
  ts: string;
};

export function arbitrateAuditSecret(
  env: NodeJS.ProcessEnv = process.env
): string | null {
  return (
    env.MSGF_ARBITRATE_AUDIT_KEY?.trim() ||
    env.MSGF_OPS_CRON_SECRET?.trim() ||
    env.MSGF_SKIP_AUDIT_SECRET?.trim() ||
    null
  );
}

/** Deep key-sorted JSON for stable HMAC / hash-chain. */
export function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (value !== null && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      out[key] = sortKeysDeep(obj[key]);
    }
    return out;
  }
  return value;
}

export function canonicalizeArbitrateAuditPayload(
  payload: ArbitrateAuditPayload
): string {
  return JSON.stringify(sortKeysDeep(payload));
}

export function signArbitrateAuditPayload(
  payload: ArbitrateAuditPayload,
  secret: string
): string {
  return createHmac("sha256", secret)
    .update(canonicalizeArbitrateAuditPayload(payload), "utf8")
    .digest("hex");
}

export function verifyArbitrateAuditSignature(
  payload: ArbitrateAuditPayload,
  signature: string,
  secret: string
): boolean {
  const expected = signArbitrateAuditPayload(payload, secret);
  try {
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function computeArbitrateRowHash(
  canonicalPayload: string,
  signature: string,
  prevHash: string
): string {
  return createHash("sha256")
    .update(`${prevHash}|${canonicalPayload}|${signature}`, "utf8")
    .digest("hex");
}

export async function fetchLatestArbitratePrevHash(
  admin: SupabaseClient
): Promise<string> {
  const { data, error } = await admin
    .from("msgf_arbitrate_audit")
    .select("row_hash")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`fetchLatestArbitratePrevHash: ${error.message}`);
  }
  const hash = data?.row_hash;
  return typeof hash === "string" && hash.length === 64
    ? hash
    : ARBITRATE_AUDIT_GENESIS_HASH;
}

export async function insertArbitrateAuditRow(
  admin: SupabaseClient,
  params: {
    payload: ArbitrateAuditPayload;
    secret: string;
  }
): Promise<{ id: string; signature: string; prev_hash: string; row_hash: string }> {
  const prevHash = await fetchLatestArbitratePrevHash(admin);
  const canonical = canonicalizeArbitrateAuditPayload(params.payload);
  const signature = signArbitrateAuditPayload(params.payload, params.secret);
  const rowHash = computeArbitrateRowHash(canonical, signature, prevHash);

  const { data, error } = await admin
    .from("msgf_arbitrate_audit")
    .insert({
      source: params.payload.source,
      project_origin: params.payload.project_origin.trim(),
      incident_id: params.payload.incident_id,
      operator_id: params.payload.operator_id,
      action: params.payload.action,
      payload_json: params.payload,
      signature,
      prev_hash: prevHash,
      row_hash: rowHash,
    })
    .select("id")
    .single();

  if (error) throw new Error(`insertArbitrateAuditRow: ${error.message}`);
  return {
    id: data.id as string,
    signature,
    prev_hash: prevHash,
    row_hash: rowHash,
  };
}

/**
 * Best-effort audit append — never throws into HITL hot path when secret missing
 * or insert fails (logged). Returns null when skipped/failed.
 */
export async function recordArbitrateAuditSafe(
  admin: SupabaseClient,
  payload: ArbitrateAuditPayload,
  env: NodeJS.ProcessEnv = process.env
): Promise<{ id: string; signature: string } | null> {
  const secret = arbitrateAuditSecret(env);
  if (!secret) {
    console.warn(
      "[msgf_arbitrate_audit] MSGF_ARBITRATE_AUDIT_KEY (or ops fallback) not set — audit skipped."
    );
    return null;
  }
  try {
    const row = await insertArbitrateAuditRow(admin, { payload, secret });
    return { id: row.id, signature: row.signature };
  } catch (e) {
    console.error(
      "[msgf_arbitrate_audit] insert failed:",
      e instanceof Error ? e.message : e
    );
    return null;
  }
}

export type ArbitrateAuditListRow = {
  id: string;
  source: string;
  project_origin: string;
  incident_id: string | null;
  operator_id: string | null;
  action: string;
  signature: string;
  prev_hash: string;
  row_hash: string;
  created_at: string;
  payload_json: ArbitrateAuditPayload;
};

export async function listArbitrateAudits(
  admin: SupabaseClient,
  opts?: { limit?: number; projectOrigin?: string | null; id?: string | null }
): Promise<ArbitrateAuditListRow[]> {
  const limit = Math.min(Math.max(opts?.limit ?? 25, 1), 100);

  if (opts?.id?.trim()) {
    const { data, error } = await admin
      .from("msgf_arbitrate_audit")
      .select(
        "id, source, project_origin, incident_id, operator_id, action, signature, prev_hash, row_hash, created_at, payload_json"
      )
      .eq("id", opts.id.trim())
      .maybeSingle();
    if (error) throw new Error(`listArbitrateAudits: ${error.message}`);
    return data ? [data as ArbitrateAuditListRow] : [];
  }

  let query = admin
    .from("msgf_arbitrate_audit")
    .select(
      "id, source, project_origin, incident_id, operator_id, action, signature, prev_hash, row_hash, created_at, payload_json"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (opts?.projectOrigin?.trim()) {
    query = query.eq("project_origin", opts.projectOrigin.trim()) as typeof query;
  }

  const { data, error } = await query;
  if (error) throw new Error(`listArbitrateAudits: ${error.message}`);
  return (data ?? []) as ArbitrateAuditListRow[];
}

export function verifyArbitrateAuditRow(
  row: {
    payload_json: unknown;
    signature: string;
    prev_hash: string;
    row_hash: string;
  },
  secret: string
): { ok: boolean; signature_ok: boolean; row_hash_ok: boolean; error?: string } {
  const payload = row.payload_json as ArbitrateAuditPayload;
  if (!payload || typeof payload !== "object") {
    return {
      ok: false,
      signature_ok: false,
      row_hash_ok: false,
      error: "Invalid payload_json.",
    };
  }

  const signatureOk = verifyArbitrateAuditSignature(payload, row.signature, secret);
  const canonical = canonicalizeArbitrateAuditPayload(payload);
  const expectedRowHash = computeArbitrateRowHash(
    canonical,
    row.signature,
    row.prev_hash
  );
  const rowHashOk = expectedRowHash === row.row_hash;

  return {
    ok: signatureOk && rowHashOk,
    signature_ok: signatureOk,
    row_hash_ok: rowHashOk,
    error: !signatureOk
      ? "Signature mismatch (tampered payload or wrong key)."
      : !rowHashOk
        ? "Row hash mismatch (chain / signature integrity broken)."
        : undefined,
  };
}
