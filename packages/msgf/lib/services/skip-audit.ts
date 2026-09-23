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
 * Distribution Build ID: MSGF-1826a636-20260922T234439Z-internal
 */
import { createHmac, timingSafeEqual } from "crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

export type SkipAuditPayload = {
  project_origin: string;
  user?: string | null;
  git_sha?: string | null;
  reason?: string | null;
  ts: string;
};

export function skipAuditSecret(env: NodeJS.ProcessEnv = process.env): string | null {
  return (
    env.MSGF_SKIP_AUDIT_SECRET?.trim() ||
    env.MSGF_OPS_CRON_SECRET?.trim() ||
    null
  );
}

/** Canonical JSON (sorted keys) for stable HMAC. */
export function canonicalizeSkipAuditPayload(payload: SkipAuditPayload): string {
  const ordered: Record<string, unknown> = {
    git_sha: payload.git_sha ?? null,
    project_origin: payload.project_origin.trim(),
    reason: payload.reason ?? null,
    ts: payload.ts,
    user: payload.user ?? null,
  };
  return JSON.stringify(ordered);
}

export function signSkipAuditPayload(
  payload: SkipAuditPayload,
  secret: string
): string {
  return createHmac("sha256", secret)
    .update(canonicalizeSkipAuditPayload(payload), "utf8")
    .digest("hex");
}

export function verifySkipAuditSignature(
  payload: SkipAuditPayload,
  signature: string,
  secret: string
): boolean {
  const expected = signSkipAuditPayload(payload, secret);
  try {
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function insertSkipAuditRow(
  admin: SupabaseClient,
  params: {
    payload: SkipAuditPayload;
    signature: string;
  }
): Promise<{ id: string }> {
  const { data, error } = await admin
    .from("msgf_skip_audit")
    .insert({
      project_origin: params.payload.project_origin.trim(),
      actor: params.payload.user ?? null,
      git_sha: params.payload.git_sha ?? null,
      reason: params.payload.reason ?? null,
      payload_json: params.payload,
      signature: params.signature,
    })
    .select("id")
    .single();

  if (error) throw new Error(`insertSkipAuditRow: ${error.message}`);
  return { id: data.id as string };
}

export async function listRecentSkipAudits(
  admin: SupabaseClient,
  opts?: { limit?: number; projectOrigin?: string | null }
): Promise<
  Array<{
    id: string;
    project_origin: string;
    actor: string | null;
    git_sha: string | null;
    reason: string | null;
    created_at: string;
  }>
> {
  const limit = Math.min(Math.max(opts?.limit ?? 25, 1), 100);
  let query = admin
    .from("msgf_skip_audit")
    .select("id, project_origin, actor, git_sha, reason, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (opts?.projectOrigin?.trim()) {
    query = query.eq("project_origin", opts.projectOrigin.trim()) as typeof query;
  }

  const { data, error } = await query;
  if (error) throw new Error(`listRecentSkipAudits: ${error.message}`);
  return (data ?? []) as Array<{
    id: string;
    project_origin: string;
    actor: string | null;
    git_sha: string | null;
    reason: string | null;
    created_at: string;
  }>;
}
