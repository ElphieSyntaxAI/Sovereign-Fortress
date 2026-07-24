/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * POST /api/msgf/ops/skip-audit when msgf.skipMsgf / MSGF_SKIP=1 (A5).
 */
import { createHmac } from "crypto";

import type { MsgfGuardSettings } from "./config";

export type SkipAuditClientPayload = {
  project_origin: string;
  user?: string | null;
  git_sha?: string | null;
  reason?: string | null;
  ts: string;
};

/** Stable canonical JSON (sorted keys) — must match server skip-audit.ts */
export function canonicalizeSkipAuditPayload(payload: SkipAuditClientPayload): string {
  const ordered: Record<string, unknown> = {
    git_sha: payload.git_sha ?? null,
    project_origin: payload.project_origin.trim(),
    reason: payload.reason ?? null,
    ts: payload.ts,
    user: payload.user ?? null,
  };
  return JSON.stringify(ordered);
}

export function signSkipAuditPayloadClient(
  payload: SkipAuditClientPayload,
  secret: string
): string {
  return createHmac("sha256", secret)
    .update(canonicalizeSkipAuditPayload(payload), "utf8")
    .digest("hex");
}

export function resolveSkipAuditSecret(settings: MsgfGuardSettings): string | null {
  const fromSettings = settings.skipAuditSecret?.trim();
  if (fromSettings) return fromSettings;
  const fromEnv = process.env.MSGF_SKIP_AUDIT_SECRET?.trim();
  return fromEnv || null;
}

export async function postSkipAudit(params: {
  settings: MsgfGuardSettings;
  payload: SkipAuditClientPayload;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const secret = resolveSkipAuditSecret(params.settings);
  if (!secret) {
    return {
      ok: false,
      error:
        "msgf.skipAuditSecret (or MSGF_SKIP_AUDIT_SECRET) required to record skip audit — silent bypass blocked.",
    };
  }

  const fetchFn = params.fetchImpl ?? fetch;
  const baseUrl = params.settings.apiUrl.replace(/\/$/, "");
  const signature = signSkipAuditPayloadClient(params.payload, secret);

  try {
    const res = await fetchFn(`${baseUrl}/api/msgf/ops/skip-audit`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ...params.payload, signature }),
    });
    const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || raw.ok !== true) {
      return {
        ok: false,
        error:
          typeof raw.error === "string"
            ? raw.error
            : `skip-audit failed (${res.status}).`,
      };
    }
    return {
      ok: true,
      id: typeof raw.id === "string" ? raw.id : undefined,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "skip-audit network error",
    };
  }
}
