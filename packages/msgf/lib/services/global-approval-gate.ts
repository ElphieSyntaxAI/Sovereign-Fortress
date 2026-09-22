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
 * Distribution Build ID: MSGF-b4dfaf97-20260922T171835Z-internal
 */
/**
 * Global Approval Gate — non-admin fixes stay in local_state_cache until ops promotes.
 */

import type { GenealogicalBugIndex } from "@/lib/schemas/vault-hall-metadata";

/** Returned when a fix applied locally but global DNA writes require admin approval. */
export const GLOBAL_PROMOTION_STATUS_LOCAL_SUCCESS_GLOBAL_PENDING =
  "LOCAL_SUCCESS_GLOBAL_PENDING" as const;

export const GLOBAL_PROMOTION_STATUS_LOCAL_SUCCESS = "LOCAL_SUCCESS" as const;
export const GLOBAL_PROMOTION_STATUS_GLOBAL_SUCCESS = "GLOBAL_SUCCESS" as const;

/** Row was promoted from local_state_cache to vault_core by admin. */
export const GLOBAL_PROMOTION_STATUS_PROMOTED_TO_VAULT_CORE =
  "PROMOTED_TO_VAULT_CORE" as const;

export type GlobalPromotionStatus =
  | typeof GLOBAL_PROMOTION_STATUS_LOCAL_SUCCESS
  | typeof GLOBAL_PROMOTION_STATUS_LOCAL_SUCCESS_GLOBAL_PENDING
  | typeof GLOBAL_PROMOTION_STATUS_GLOBAL_SUCCESS
  | typeof GLOBAL_PROMOTION_STATUS_PROMOTED_TO_VAULT_CORE;

/** System silo allowed to write `vault_core` (global Hall of Records). */
export const MSGF_VAULT_CORE_TENANT_ID =
  process.env.MSGF_VAULT_CORE_TENANT_ID?.trim() ||
  process.env.MSGF_GLOBAL_ADMIN_TENANT_ID?.trim() ||
  "msgf_admin";

export type LogicDeltaSource =
  | "self_heal"
  | "pulse_converge"
  | "arbitration"
  | "globalize"
  | "local_gateway"
  | "dev_event";

export type LogicDelta = {
  tenantId: string;
  entityId: string;
  content: string;
  summaryBeat?: string;
  bugIndex?: GenealogicalBugIndex;
  metadata?: Record<string, unknown>;
  source: LogicDeltaSource;
  /** When true, caller intends msgf_rules + vault_core promotion. */
  globalize?: boolean;
  /** Company silo for pending promotion lists + tenant isolation. */
  companyId?: string | null;
};

export type GlobalWriteTarget = "global_msgf_rules" | "vault_core";

export type GlobalWriteGateInput = {
  tenantId: string;
  isAdmin: boolean;
  target: GlobalWriteTarget;
  globalize?: boolean;
};

export type GlobalWriteGateResult =
  | { allowed: true }
  | {
      allowed: false;
      status: typeof GLOBAL_PROMOTION_STATUS_LOCAL_SUCCESS_GLOBAL_PENDING;
      reason: string;
    };

/** Result shape from {@link PulseEngine.persistLogicDeltaWithGate}. */
export type PersistLogicDeltaGateResult = {
  promotion_status: GlobalPromotionStatus;
  local_cache_id?: string;
  vaultNarrativeLogId?: string;
};

export function isVaultCoreTenant(tenantId: string): boolean {
  return tenantId.trim() === MSGF_VAULT_CORE_TENANT_ID;
}

/** Admin silo or explicit service-role / ops flag. */
export function isGlobalAdminContext(tenantId: string, isAdmin?: boolean): boolean {
  if (isAdmin === true) return true;
  return isVaultCoreTenant(tenantId);
}

export function assertGlobalWriteAllowed(input: GlobalWriteGateInput): GlobalWriteGateResult {
  if (isGlobalAdminContext(input.tenantId, input.isAdmin)) {
    return { allowed: true };
  }

  const globalize = input.globalize === true;
  if (input.target === "global_msgf_rules" || globalize) {
    return {
      allowed: false,
      status: GLOBAL_PROMOTION_STATUS_LOCAL_SUCCESS_GLOBAL_PENDING,
      reason:
        input.target === "global_msgf_rules"
          ? "global_msgf_rules writes require an admin-approved promotion."
          : "Globalize requests require admin approval before updating system DNA.",
    };
  }

  if (input.target === "vault_core" && isVaultCoreTenant(input.tenantId)) {
    return {
      allowed: false,
      status: GLOBAL_PROMOTION_STATUS_LOCAL_SUCCESS_GLOBAL_PENDING,
      reason: "vault_core writes require an admin-approved promotion.",
    };
  }

  return { allowed: true };
}

export function vaultCoreWriteForTenant(tenantId: string, globalize?: boolean): boolean {
  return isVaultCoreTenant(tenantId) || globalize === true;
}
