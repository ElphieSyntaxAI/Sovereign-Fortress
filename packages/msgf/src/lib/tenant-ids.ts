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
 * Distribution Build ID: MSGF-e3b90d5-20260522T030006Z-internal
 */
/**
 * Sentinel UUID for narrative logs when the upstream system only has a non-UUID label
 * (e.g. Stripe metadata missing `tenant_id`). Keep in sync with migration
 * `20260510120000_align_p4_narrative_logs_tenant_uuid.sql`.
 */
export const LEGACY_UNRESOLVED_TENANT_UUID = "00000000-0000-4000-8000-000000000001";

/** Demo tenants for RLS / guard tests (valid UUIDs). */
export const DEMO_TENANT_ACME_UUID = "11111111-1111-4111-8111-111111111111";
export const DEMO_TENANT_INTRUDER_UUID = "22222222-2222-4222-8222-222222222222";
export const DEMO_TENANT_GLOBEX_UUID = "33333333-3333-4333-8333-333333333333";

const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export function isUuidString(value: string): boolean {
  return UUID_RE.test(value.trim());
}

/** Ensures `p4_narrative_logs.tenant_id` always receives a UUID (DB column type). */
export function tenantIdForNarrativeLog(value: string): string {
  const t = value.trim();
  return isUuidString(t) ? t : LEGACY_UNRESOLVED_TENANT_UUID;
}
