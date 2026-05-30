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
 * Distribution Build ID: MSGF-48a02b8-20260530T050749Z-internal
 */
/**

 * Global mitigation application — `msgf_rules` upsert + lineage cache invalidation.

 */



import type { SupabaseClient } from "@supabase/supabase-js";



import {

  applyGlobalMitigation as upsertGlobalMitigationRule,

  applyLocalCompanyMitigation,

  loadGlobalMitigationsPayload,

  loadLayeredGlobalMitigationsPayload,

  type ApplyGlobalMitigationParams,

  type ApplyLocalCompanyMitigationParams,

  type GlobalMitigationsPayload,

} from "@/lib/services/msgf-global-rules";

import { invalidateTenantLineageCache } from "@/lib/services/vault-lineage-p2-cache";



export type ApplyGlobalMitigationResult = {

  ruleUpdated: boolean;

  mitigationId: string;

  lineage_keys_invalidated: number;

  promotion_status: string;

  local_cache_id?: string;

};



export type MitigationServiceApplyParams = ApplyGlobalMitigationParams & {

  /** License / project silo — required for immediate Brain refresh on next pulse. */

  tenantId: string;

  documentId?: string;

};



export type MitigationServiceApplyLocalParams = ApplyLocalCompanyMitigationParams & {

  documentId?: string;

};



/**

 * Applies a global fix: upserts `msgf_rules` (`global_mitigations` namespace) and

 * deletes Redis lineage keys for the tenant so the next pulse sees the new rule.

 */

export async function applyGlobalMitigation(

  params: MitigationServiceApplyParams

): Promise<ApplyGlobalMitigationResult> {

  const tenantId = params.tenantId.trim();

  if (!tenantId) {

    throw new Error("MitigationService.applyGlobalMitigation: tenantId is required.");

  }



  const { ruleUpdated, mitigationId, promotion_status, local_cache_id } =
    await upsertGlobalMitigationRule({
      ...params,
      tenantId,
    });

  const lineage_keys_invalidated = await invalidateTenantLineageCache(tenantId, {
    documentId: params.documentId,
  });

  return {
    ruleUpdated,
    mitigationId,
    lineage_keys_invalidated,
    promotion_status,
    local_cache_id,
  };

}



/**

 * Applies a company-local fix: upserts `msgf_rules` under LOCAL scope + silo `L:<company_id>`.

 */

export async function applyLocalMitigation(

  params: MitigationServiceApplyLocalParams

): Promise<ApplyGlobalMitigationResult> {

  const tenantId = params.tenantId.trim();

  if (!tenantId) {

    throw new Error("MitigationService.applyLocalMitigation: tenantId is required.");

  }

  const companyId = params.companyId.trim();

  if (!companyId) {

    throw new Error("MitigationService.applyLocalMitigation: companyId is required.");

  }



  const { ruleUpdated, mitigationId, promotion_status } = await applyLocalCompanyMitigation({

    ...params,

    tenantId,

    companyId,

  });

  const lineage_keys_invalidated = await invalidateTenantLineageCache(tenantId, {

    documentId: params.documentId,

  });

  return {

    ruleUpdated,

    mitigationId,

    lineage_keys_invalidated,

    promotion_status,

  };

}



export class MitigationService {

  loadGlobalMitigations(
    adminSupabase: SupabaseClient,
    tenantId: string
  ): Promise<GlobalMitigationsPayload> {
    return loadGlobalMitigationsPayload(adminSupabase, tenantId);
  }



  loadLayeredMitigations(

    adminSupabase: SupabaseClient,

    tenantId: string,

    companyId?: string | null

  ): Promise<GlobalMitigationsPayload> {

    return loadLayeredGlobalMitigationsPayload(adminSupabase, tenantId, companyId);

  }



  applyGlobalMitigation(params: MitigationServiceApplyParams): Promise<ApplyGlobalMitigationResult> {

    return applyGlobalMitigation(params);

  }



  applyLocalMitigation(params: MitigationServiceApplyLocalParams): Promise<ApplyGlobalMitigationResult> {

    return applyLocalMitigation(params);

  }



  invalidateTenantLineageCache(

    tenantId: string,

    options?: { documentId?: string }

  ): Promise<number> {

    return invalidateTenantLineageCache(tenantId, options);

  }



  /** @deprecated Use {@link invalidateTenantLineageCache}. */

  invalidateAuthorLineageCache(

    tenantId: string,

    options?: { documentId?: string }

  ): Promise<number> {

    return invalidateTenantLineageCache(tenantId, options);

  }

}



export const mitigationService = new MitigationService();



export type {

  ApplyGlobalMitigationParams,

  ApplyLocalCompanyMitigationParams,

  GlobalMitigationsPayload,

};


