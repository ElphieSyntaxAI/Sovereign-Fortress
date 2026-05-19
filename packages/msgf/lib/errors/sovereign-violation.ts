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
 * Distribution Build ID: MSGF-6d594fa-20260519T162432Z-internal
 */
/**
 * Thrown when a tenant silo (`tenant_id`) is missing or cross-tenant access is attempted.
 */
export class SovereignViolationError extends Error {
  readonly code = "ERR_SOVEREIGN_VIOLATION" as const;

  constructor(message = "tenant_id is required for all MSGF data access.") {
    super(message);
    this.name = "SovereignViolationError";
  }
}

export function assertTenantId(
  tenantId: string | undefined | null,
  context?: string
): asserts tenantId is string {
  if (!tenantId?.trim()) {
    const detail = context ? `${context}: tenant_id is required.` : undefined;
    throw new SovereignViolationError(detail);
  }
}
