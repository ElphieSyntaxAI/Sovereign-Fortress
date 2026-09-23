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
 * Distribution Build ID: MSGF-fca2d532-20260923T201750Z-internal
 */
export const VAULT_QUARANTINE_STATUSES = [
  "NONE",
  "QUARANTINED",
  "DEMOTED_HALL",
  "RESTORED",
] as const;

export type VaultQuarantineStatus = (typeof VAULT_QUARANTINE_STATUSES)[number];

/** Statuses blocked from positive Vault retrieval (Small/Big Brain context). */
export const VAULT_RETRIEVAL_BLOCKED_STATUSES: ReadonlySet<string> = new Set([
  "QUARANTINED",
  "DEMOTED_HALL",
]);

export type QuarantineAwareRow = {
  quarantine_status?: string | null;
  metadata?: Record<string, unknown> | null;
};

/**
 * True when a Vault row may be used as positive reinforcement / CROSS-REF win.
 * Missing column (pre-migration reads) treated as eligible (NONE).
 */
export function isVaultRowEligibleForRetrieval(row: QuarantineAwareRow): boolean {
  const fromCol =
    typeof row.quarantine_status === "string" ? row.quarantine_status.trim() : "";
  const fromMeta =
    row.metadata && typeof row.metadata.quarantine_status === "string"
      ? String(row.metadata.quarantine_status).trim()
      : "";
  const status = fromCol || fromMeta || "NONE";
  return !VAULT_RETRIEVAL_BLOCKED_STATUSES.has(status);
}

/** Defense-in-depth after reads — drops quarantined / demoted Vault wins. */
export function filterVaultRowsForRetrieval<T extends QuarantineAwareRow>(rows: T[]): T[] {
  return rows.filter((row) => isVaultRowEligibleForRetrieval(row));
}

type OrFilterable = {
  or: (filters: string) => OrFilterable;
};

/**
 * PostgREST: keep NONE, RESTORED, or null (legacy). Call after ledger=vault filters.
 */
export function applyVaultQuarantineExclusionFilter<T extends OrFilterable>(query: T): T {
  return query.or(
    "quarantine_status.is.null,quarantine_status.eq.NONE,quarantine_status.eq.RESTORED"
  ) as T;
}
