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
 * Distribution Build ID: MSGF-a7aa881-20260620T084430Z-internal
 */
/**
 * Resolves `pillar_vectors` vs `msgf_sandbox` for tenant-scoped Hall / Vault I/O.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  resolvePillarVectorsTable,
  type MsgfPillarTableName,
} from "@/lib/msgf-tenant-governance";

export type { MsgfPillarTableName };

export function pillarTableForTenant(tenantId: string): MsgfPillarTableName {
  return resolvePillarVectorsTable(tenantId);
}

/** Typed Supabase `.from()` for pillar / sandbox cold layer. */
export function fromPillarVectors(
  supabase: SupabaseClient,
  tenantId: string
) {
  return supabase.from(pillarTableForTenant(tenantId));
}
