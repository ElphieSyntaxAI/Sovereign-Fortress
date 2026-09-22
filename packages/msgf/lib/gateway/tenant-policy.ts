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
 * Distribution Build ID: MSGF-191e80fa-20260921T055901Z-internal
 */
/**
 * Per-tenant Active Governance policy (aggressiveness + kill-switch).
 */

export type ActiveAggressiveness =
  | "cache-only"
  | "shard-and-route"
  | "full-consensus";

export type TenantActivePolicy = {
  active_aggressiveness: ActiveAggressiveness;
  /** On orchestrator errors, fall back to raw pass-through streaming. */
  passthrough_fallback: boolean;
};

const VALID: ReadonlySet<string> = new Set([
  "cache-only",
  "shard-and-route",
  "full-consensus",
]);

function parseAggressiveness(raw: string | null | undefined): ActiveAggressiveness | null {
  const v = raw?.trim().toLowerCase();
  if (v && VALID.has(v)) return v as ActiveAggressiveness;
  return null;
}

/**
 * Resolve active policy. Default launch aggressiveness: shard-and-route.
 * Env: MSGF_ACTIVE_AGGRESSIVENESS, MSGF_ACTIVE_PASSTHROUGH_FALLBACK.
 */
export function resolveTenantActivePolicy(
  _tenantId: string,
  options?: { headerAggressiveness?: string | null }
): TenantActivePolicy {
  const fromHeader = parseAggressiveness(options?.headerAggressiveness);
  const fromEnv = parseAggressiveness(process.env.MSGF_ACTIVE_AGGRESSIVENESS);
  const active_aggressiveness =
    fromHeader ?? fromEnv ?? "shard-and-route";

  const fallbackRaw = process.env.MSGF_ACTIVE_PASSTHROUGH_FALLBACK?.trim().toLowerCase();
  const passthrough_fallback =
    fallbackRaw === undefined ||
    fallbackRaw === "" ||
    fallbackRaw === "1" ||
    fallbackRaw === "true" ||
    fallbackRaw === "yes";

  return { active_aggressiveness, passthrough_fallback };
}
