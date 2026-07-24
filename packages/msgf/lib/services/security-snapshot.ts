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
 * Distribution Build ID: MSGF-c1a5d75-20260723T221428Z-internal
 */
/**
 * Aggregated security stats for dashboard Security View (dev + tenant lenses).
 */

import type { SecurityIdeContext } from "@/lib/services/security-dev-settings";
import { getSavingsFeaturesSummary24h, type SavingsFeatureCatalogEntry } from "@/lib/services/savings-features-stats";

const PROTECTION_STACK_IDS = new Set([
  "verify_result",
  "dev_event",
  "run_script_rerun",
  "agent_context_pack",
  "converge_cache",
  "ingest_hash",
  "pulse_idempotency",
  "credit_reservation",
]);

export type SecurityDevSnapshot = {
  verify_passes: number;
  verify_failures: number;
  verify_vault_writes: number;
  verify_hall_writes: number;
  dev_events: number;
  dev_event_vault_hits: number;
  run_script_reruns: number;
  agent_context_packs: number;
};

export type SecurityTenantSnapshot = {
  small_brain_pulse_pct: number;
  global_converge: number;
  total_pulses: number;
  local_or_bypass_pct: number;
  credit_reservations: number;
  credit_reservation_denied: number;
  pulse_idempotency_replays: number;
  ingest_hash_files_skipped: number;
  converge_cache_hits: number;
};

export type SecuritySnapshot = {
  tenant_id: string;
  /** Redis / IDE counter scope (usually mapped project_origin). */
  stats_tenant_key: string;
  window_hours: 24;
  dev: SecurityDevSnapshot;
  tenant: SecurityTenantSnapshot;
  protection_stack: SavingsFeatureCatalogEntry[];
  ide_context?: SecurityIdeContext | null;
};

export async function buildSecuritySnapshot(
  statsTenantKey: string,
  ideContext?: SecurityIdeContext | null
): Promise<SecuritySnapshot> {
  const summary = await getSavingsFeaturesSummary24h(statsTenantKey, "user");
  const c = summary.counters;
  const pr = summary.pulse_routing;

  return {
    tenant_id: statsTenantKey,
    stats_tenant_key: statsTenantKey,
    window_hours: 24,
    ide_context: ideContext ?? null,
    dev: {
      verify_passes: c.verify_result_passes,
      verify_failures: c.verify_result_failures,
      verify_vault_writes: c.verify_result_vault_writes,
      verify_hall_writes: c.verify_result_hall_writes,
      dev_events: c.dev_events,
      dev_event_vault_hits: c.dev_event_vault_hits,
      run_script_reruns: c.run_script_reruns,
      agent_context_packs: c.agent_context_packs,
    },
    tenant: {
      small_brain_pulse_pct: summary.small_brain_pulse_pct,
      global_converge: pr.global_converge,
      total_pulses: pr.total_pulses,
      local_or_bypass_pct: pr.local_or_bypass_pct,
      credit_reservations: c.credit_reservations,
      credit_reservation_denied: c.credit_reservation_denied,
      pulse_idempotency_replays: c.pulse_idempotency_replays,
      ingest_hash_files_skipped: c.ingest_hash_files_skipped,
      converge_cache_hits: c.converge_cache_hits,
    },
    protection_stack: summary.catalog.filter((row) => PROTECTION_STACK_IDS.has(row.id)),
  };
}
