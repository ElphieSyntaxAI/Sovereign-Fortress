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
 * P2 global mitigations — persisted in `msgf_rules` (tenant-scoped) to prevent repeat ARBITRATE conflicts.
 */

import { randomUUID } from "crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { MitigationAction } from "@/lib/schemas/mitigation-action";
import type { GenealogicalBugIndex } from "@/lib/schemas/vault-hall-metadata";
import type { ShadowPreflightResult } from "@/lib/msgf-shadow";
import {
  assertGlobalWriteAllowed,
  GLOBAL_PROMOTION_STATUS_GLOBAL_SUCCESS,
  GLOBAL_PROMOTION_STATUS_LOCAL_SUCCESS_GLOBAL_PENDING,
  MSGF_VAULT_CORE_TENANT_ID,
  type GlobalPromotionStatus,
} from "@/lib/services/global-approval-gate";
import { saveLogicDeltaToLocalCache } from "@/lib/services/local-state-cache";
import {
  applyMsgfRulesTenantFilter,
  pillarRowBelongsToTenant,
  resolveTenantIdForQuery,
} from "@/lib/services/tenant-query-scope";

/** Canonical `msgf_rules.rule_namespace` for operator global fixes. */
export const GLOBAL_MITIGATIONS_NAMESPACE = "global_mitigations";
export const GLOBAL_MITIGATIONS_RULE_KEY = "active";

/** Platform-wide Brain rules tenant (everyone). Defaults to vault-core silo. */
export const MSGF_PLATFORM_GLOBAL_RULES_TENANT_ID =
  process.env.MSGF_PLATFORM_GLOBAL_RULES_TENANT_ID?.trim() || MSGF_VAULT_CORE_TENANT_ID;

export const RULE_SCOPE_GLOBAL = "GLOBAL" as const;
export const RULE_SCOPE_LOCAL = "LOCAL" as const;
export type MsgfRuleScope = typeof RULE_SCOPE_GLOBAL | typeof RULE_SCOPE_LOCAL;

export function rulesSiloKeyForScope(scope: MsgfRuleScope, companyId: string | null | undefined): string {
  if (scope === RULE_SCOPE_GLOBAL) return "G";
  const cid = companyId?.trim();
  if (!cid) throw new Error("rulesSiloKeyForScope: company_id is required for LOCAL scope.");
  return `L:${cid}`;
}

/** @deprecated Legacy row — still read for backward compatibility within the same tenant. */
export const P2_GLOBAL_RULES_NAMESPACE = "p2";
export const P2_GLOBAL_MITIGATIONS_KEY = "global_mitigations";

export type GlobalMitigationEntry = {
  id: string;
  bug_index_instance: string;
  bug_index: GenealogicalBugIndex;
  pillar?: string;
  label?: string;
  fix_template: string;
  human_reasoning: string;
  incident_id?: string;
  applied_at: string;
};

export type GlobalMitigationsPayload = {
  version: string;
  mitigations: GlobalMitigationEntry[];
  conflict_guards: Array<{
    bug_index_instance: string;
    prefer_human_fix: boolean;
    canonical_fix_template: string;
    human_reasoning: string;
    updated_at: string;
  }>;
};

const PAYLOAD_VERSION = "2026.05-MSGF-global-mitigations-v1";

function emptyPayload(): GlobalMitigationsPayload {
  return { version: PAYLOAD_VERSION, mitigations: [], conflict_guards: [] };
}

function parseMitigationsPayload(raw: unknown): GlobalMitigationsPayload {
  if (!raw || typeof raw !== "object") return emptyPayload();
  const p = raw as Partial<GlobalMitigationsPayload>;
  return {
    version: typeof p.version === "string" ? p.version : PAYLOAD_VERSION,
    mitigations: Array.isArray(p.mitigations) ? p.mitigations : [],
    conflict_guards: Array.isArray(p.conflict_guards) ? p.conflict_guards : [],
  };
}

async function loadTenantRulesPayload(
  adminSupabase: SupabaseClient,
  tenantId: string,
  ruleNamespace: string,
  ruleKey: string,
  scope: MsgfRuleScope = RULE_SCOPE_GLOBAL,
  rulesSiloKeyOverride?: string
): Promise<unknown | null> {
  const tid = resolveTenantIdForQuery(tenantId);
  const siloKey = rulesSiloKeyOverride ?? rulesSiloKeyForScope(scope, null);

  type FilterEq = { eq: (column: string, value: string) => FilterEq };

  let query: FilterEq = adminSupabase
    .from("msgf_rules")
    .select("payload")
    .eq("rule_namespace", ruleNamespace)
    .eq("rule_key", ruleKey)
    .eq("rule_scope", scope)
    .eq("rules_silo_key", siloKey) as unknown as FilterEq;

  query = applyMsgfRulesTenantFilter(query, tid);

  const { data, error } = await (
    query as unknown as {
      maybeSingle: () => Promise<{
        data: { payload?: unknown } | null;
        error: { message: string } | null;
      }>;
    }
  ).maybeSingle();
  if (error || !data?.payload) return null;
  return data.payload;
}

/**
 * Merge mitigation payloads — same array index order is base → overlay (later wins per instance).
 */
export function mergeMitigationsPayloads(layers: GlobalMitigationsPayload[]): GlobalMitigationsPayload {
  const mitigationByInstance = new Map<string, GlobalMitigationEntry>();
  const guardByInstance = new Map<string, GlobalMitigationsPayload["conflict_guards"][number]>();

  for (const layer of layers) {
    for (const m of layer.mitigations) {
      mitigationByInstance.set(m.bug_index_instance, m);
    }
    for (const g of layer.conflict_guards) {
      guardByInstance.set(g.bug_index_instance, g);
    }
  }

  return {
    version: PAYLOAD_VERSION,
    mitigations: [...mitigationByInstance.values()],
    conflict_guards: [...guardByInstance.values()],
  };
}

async function loadMitigationsPayloadForSilo(
  adminSupabase: SupabaseClient,
  tenantId: string,
  scope: MsgfRuleScope,
  companyId?: string | null
): Promise<GlobalMitigationsPayload> {
  const siloKey =
    scope === RULE_SCOPE_GLOBAL ? "G" : rulesSiloKeyForScope(RULE_SCOPE_LOCAL, companyId ?? null);

  const primary = await loadTenantRulesPayload(
    adminSupabase,
    tenantId,
    GLOBAL_MITIGATIONS_NAMESPACE,
    GLOBAL_MITIGATIONS_RULE_KEY,
    scope,
    siloKey
  );
  if (primary) {
    return parseMitigationsPayload(primary);
  }

  if (scope === RULE_SCOPE_GLOBAL && siloKey === "G") {
    const legacy = await loadTenantRulesPayload(
      adminSupabase,
      tenantId,
      P2_GLOBAL_RULES_NAMESPACE,
      P2_GLOBAL_MITIGATIONS_KEY,
      RULE_SCOPE_GLOBAL,
      "G"
    );
    if (legacy) {
      return parseMitigationsPayload(legacy);
    }
  }

  return emptyPayload();
}

/**
 * Loads operator mitigations with stacking: **platform GLOBAL → tenant GLOBAL → company LOCAL**.
 * When `companyId` is omitted, only the first two layers apply.
 */
export async function loadLayeredGlobalMitigationsPayload(
  adminSupabase: SupabaseClient,
  tenantId: string,
  companyId?: string | null
): Promise<GlobalMitigationsPayload> {
  const platform = await loadMitigationsPayloadForSilo(
    adminSupabase,
    MSGF_PLATFORM_GLOBAL_RULES_TENANT_ID,
    RULE_SCOPE_GLOBAL,
    null
  );
  const tenantGlobal = await loadMitigationsPayloadForSilo(
    adminSupabase,
    tenantId,
    RULE_SCOPE_GLOBAL,
    null
  );
  const companyLocal =
    companyId?.trim() ?
      await loadMitigationsPayloadForSilo(
        adminSupabase,
        tenantId,
        RULE_SCOPE_LOCAL,
        companyId.trim()
      )
    : emptyPayload();

  return mergeMitigationsPayloads([platform, tenantGlobal, companyLocal]);
}

/** @deprecated Prefer {@link loadLayeredGlobalMitigationsPayload} (same call with no company id). */
export async function loadGlobalMitigationsPayload(
  adminSupabase: SupabaseClient,
  tenantId: string
): Promise<GlobalMitigationsPayload> {
  return loadLayeredGlobalMitigationsPayload(adminSupabase, tenantId, null);
}


export type ApplyGlobalMitigationParams = {
  adminSupabase: SupabaseClient;
  tenantId: string;
  entityId?: string;
  bugIndex: GenealogicalBugIndex;
  mitigation: MitigationAction;
  humanReasoning: string;
  finalFixApplied: string;
  incidentId?: string;
  remediationStrategyLabel?: string;
  documentId?: string;
  /** Ops / service-role — required to upsert `global_msgf_rules`. */
  isAdmin?: boolean;
  /** @deprecated Use `tenantId`. */
  authorId?: string;
};

/**
 * Upserts tenant-scoped `msgf_rules` (`global_mitigations`) so future Pulses inherit the operator fix.
 */
export async function applyGlobalMitigation(
  params: ApplyGlobalMitigationParams
): Promise<{
  ruleUpdated: boolean;
  mitigationId: string;
  promotion_status: GlobalPromotionStatus;
  local_cache_id?: string;
}> {
  const tenantId = resolveTenantIdForQuery(
    params.tenantId || params.authorId
  );
  const entityId = params.entityId?.trim() || tenantId;

  const gate = assertGlobalWriteAllowed({
    tenantId,
    isAdmin: params.isAdmin === true,
    target: "global_msgf_rules",
    globalize: true,
  });

  const fixTemplate =
    params.mitigation.fix_template?.trim() ||
    params.finalFixApplied.trim() ||
    params.mitigation.label?.trim() ||
    "Operator global mitigation";

  const humanReasoning = params.humanReasoning.trim() || fixTemplate;
  const instance = params.bugIndex.level_1_1_1_instance;

  if (!gate.allowed) {
    const cached = await saveLogicDeltaToLocalCache(params.adminSupabase, {
      tenantId,
      entityId,
      content: fixTemplate,
      summaryBeat: params.mitigation.label ?? "Pending global mitigation",
      bugIndex: params.bugIndex,
      source: "globalize",
      globalize: true,
      metadata: {
        human_reasoning: humanReasoning,
        incident_id: params.incidentId,
        remediation_strategy_label: params.remediationStrategyLabel,
        mitigation: params.mitigation,
      },
    });
    return {
      ruleUpdated: false,
      mitigationId: cached.cacheId,
      promotion_status: GLOBAL_PROMOTION_STATUS_LOCAL_SUCCESS_GLOBAL_PENDING,
      local_cache_id: cached.cacheId,
    };
  }

  const now = new Date().toISOString();
  const mitigationId = randomUUID();

  const entry: GlobalMitigationEntry = {
    id: mitigationId,
    bug_index_instance: instance,
    bug_index: params.bugIndex,
    pillar: params.mitigation.pillar,
    label: params.mitigation.label ?? params.remediationStrategyLabel,
    fix_template: fixTemplate,
    human_reasoning: humanReasoning,
    incident_id: params.incidentId,
    applied_at: now,
  };

  const existing = await loadMitigationsPayloadForSilo(
    params.adminSupabase,
    tenantId,
    RULE_SCOPE_GLOBAL,
    null
  );

  const mitigations = [
    entry,
    ...existing.mitigations.filter((m) => m.bug_index_instance !== instance),
  ].slice(0, 64);

  const conflict_guards = [
    {
      bug_index_instance: instance,
      prefer_human_fix: true,
      canonical_fix_template: fixTemplate,
      human_reasoning: humanReasoning,
      updated_at: now,
    },
    ...existing.conflict_guards.filter((g) => g.bug_index_instance !== instance),
  ].slice(0, 64);

  const payload: GlobalMitigationsPayload = {
    version: PAYLOAD_VERSION,
    mitigations,
    conflict_guards,
  };

  const { error } = await params.adminSupabase.from("msgf_rules").upsert(
    {
      tenant_id: tenantId,
      rule_namespace: GLOBAL_MITIGATIONS_NAMESPACE,
      rule_key: GLOBAL_MITIGATIONS_RULE_KEY,
      rule_scope: RULE_SCOPE_GLOBAL,
      company_id: null,
      rules_silo_key: "G",
      payload,
      updated_at: now,
    },
    { onConflict: "tenant_id,rule_namespace,rule_key,rules_silo_key" }
  );

  if (error) {
    throw new Error(`msgf_rules global mitigation upsert: ${error.message}`);
  }

  return {
    ruleUpdated: true,
    mitigationId,
    promotion_status: GLOBAL_PROMOTION_STATUS_GLOBAL_SUCCESS,
  };
}

export type ApplyLocalCompanyMitigationParams = Omit<
  ApplyGlobalMitigationParams,
  "isAdmin"
> & {
  companyId: string;
};

/**
 * Upserts **LOCAL** (company-scoped) `msgf_rules` mitigations for tenant + company silo.
 * Does not require global admin promotion gate — authorize at the API layer (company admin).
 */
export async function applyLocalCompanyMitigation(
  params: ApplyLocalCompanyMitigationParams
): Promise<{
  ruleUpdated: boolean;
  mitigationId: string;
  promotion_status: GlobalPromotionStatus;
}> {
  const tenantId = resolveTenantIdForQuery(params.tenantId || params.authorId);
  const companyId = params.companyId.trim();
  if (!companyId) {
    throw new Error("applyLocalCompanyMitigation: companyId is required.");
  }

  const fixTemplate =
    params.mitigation.fix_template?.trim() ||
    params.finalFixApplied.trim() ||
    params.mitigation.label?.trim() ||
    "Company-local mitigation";

  const humanReasoning = params.humanReasoning.trim() || fixTemplate;
  const instance = params.bugIndex.level_1_1_1_instance;
  const now = new Date().toISOString();
  const mitigationId = randomUUID();
  const siloKey = rulesSiloKeyForScope(RULE_SCOPE_LOCAL, companyId);

  const entry: GlobalMitigationEntry = {
    id: mitigationId,
    bug_index_instance: instance,
    bug_index: params.bugIndex,
    pillar: params.mitigation.pillar,
    label: params.mitigation.label ?? params.remediationStrategyLabel,
    fix_template: fixTemplate,
    human_reasoning: humanReasoning,
    incident_id: params.incidentId,
    applied_at: now,
  };

  const existing = await loadMitigationsPayloadForSilo(
    params.adminSupabase,
    tenantId,
    RULE_SCOPE_LOCAL,
    companyId
  );

  const mitigations = [
    entry,
    ...existing.mitigations.filter((m) => m.bug_index_instance !== instance),
  ].slice(0, 64);

  const conflict_guards = [
    {
      bug_index_instance: instance,
      prefer_human_fix: true,
      canonical_fix_template: fixTemplate,
      human_reasoning: humanReasoning,
      updated_at: now,
    },
    ...existing.conflict_guards.filter((g) => g.bug_index_instance !== instance),
  ].slice(0, 64);

  const payload: GlobalMitigationsPayload = {
    version: PAYLOAD_VERSION,
    mitigations,
    conflict_guards,
  };

  const { error } = await params.adminSupabase.from("msgf_rules").upsert(
    {
      tenant_id: tenantId,
      rule_namespace: GLOBAL_MITIGATIONS_NAMESPACE,
      rule_key: GLOBAL_MITIGATIONS_RULE_KEY,
      rule_scope: RULE_SCOPE_LOCAL,
      company_id: companyId,
      rules_silo_key: siloKey,
      payload,
      updated_at: now,
    },
    { onConflict: "tenant_id,rule_namespace,rule_key,rules_silo_key" }
  );

  if (error) {
    throw new Error(`msgf_rules local company mitigation upsert: ${error.message}`);
  }

  return {
    ruleUpdated: true,
    mitigationId,
    promotion_status: GLOBAL_PROMOTION_STATUS_GLOBAL_SUCCESS,
  };
}

export function formatDefendHighPriorityConstraints(
  payload: GlobalMitigationsPayload
): string {
  if (!payload.conflict_guards.length && !payload.mitigations.length) {
    return "";
  }

  const lines: string[] = [
    "",
    "DEFEND GATE — HIGH PRIORITY CONSTRAINTS (msgf_rules / global_mitigations):",
    "- Rule stack (merged for Pulse): platform GLOBAL Brain laws → tenant GLOBAL → company LOCAL (later layer wins per instance).",
    "- These operator fixes supersede Hall shadow matches and stale Vault patterns for matching instances.",
    "- When a guard applies, prefer the canonical_fix and do not block the session.",
  ];

  for (const guard of payload.conflict_guards.slice(0, 16)) {
    lines.push(
      `- [${guard.bug_index_instance}] prefer_human_fix=${guard.prefer_human_fix}`,
      `  canonical_fix: ${guard.canonical_fix_template.slice(0, 280).replace(/\s+/g, " ")}`,
      `  human_reasoning: ${guard.human_reasoning.slice(0, 220).replace(/\s+/g, " ")}`
    );
  }

  return lines.join("\n");
}

export function applyDefendMitigationOverrides(
  preflight: ShadowPreflightResult,
  payload: GlobalMitigationsPayload,
  tenantId: string
): ShadowPreflightResult {
  if (preflight.tier !== "RED" || !preflight.blocked) {
    return preflight;
  }
  if (!payload.conflict_guards.length) {
    return preflight;
  }

  if (
    preflight.hallMatch &&
    !pillarRowBelongsToTenant(preflight.hallMatch.metadata, tenantId)
  ) {
    return {
      ...preflight,
      tier: "GREEN",
      blocked: false,
      reason:
        "DEFEND: ignored Hall match from another tenant silo (isolation guard).",
      vaultMatch: preflight.vaultMatch,
      hallMatch: null,
    };
  }

  const hallContent = (preflight.hallMatch?.content ?? "").toLowerCase();
  const hallMeta = JSON.stringify(preflight.hallMatch?.metadata ?? {}).toLowerCase();

  for (const guard of payload.conflict_guards) {
    if (!guard.prefer_human_fix) continue;
    const needle = guard.bug_index_instance.toLowerCase();
    const matchesGuard =
      hallContent.includes(needle) ||
      hallMeta.includes(needle) ||
      hallContent.includes("global_mitigation") ||
      hallContent.includes("arbitration_beat");

    if (matchesGuard) {
      return {
        ...preflight,
        tier: "YELLOW",
        blocked: false,
        reason: `DEFEND: global_mitigations guard [${guard.bug_index_instance}] overrides Hall RED.`,
        vaultMatch: preflight.vaultMatch,
        hallMatch: preflight.hallMatch,
      };
    }
  }

  return preflight;
}

export function formatGlobalMitigationsDirective(payload: GlobalMitigationsPayload): string {
  if (!payload.conflict_guards.length && !payload.mitigations.length) {
    return "";
  }

  const lines: string[] = [
    "",
    "P2 GLOBAL MITIGATIONS (operator — merged stack: platform GLOBAL → tenant GLOBAL → company LOCAL):",
    "- These human-corrected fixes supersede stale Vault patterns for matching 1.1.1 instances (later layer wins per instance).",
  ];

  for (const guard of payload.conflict_guards.slice(0, 12)) {
    lines.push(
      `- [${guard.bug_index_instance}] prefer_human_fix=true`,
      `  canonical_fix: ${guard.canonical_fix_template.slice(0, 240).replace(/\s+/g, " ")}`,
      `  human_reasoning: ${guard.human_reasoning.slice(0, 200).replace(/\s+/g, " ")}`
    );
  }

  return lines.join("\n");
}
