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
 * Distribution Build ID: MSGF-c103094-20260526T230730Z-internal
 */
/**
 * MSGF plug-in contracts — host apps supply P2 roadmap and entitlement logic at init.
 */

import type { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { P4ProfileEntitlementRow } from "@/lib/middleware/entitlementGuard";
import type { P2RoadmapConfig } from "@/lib/services/p2-flow-roadmap";

/** Loads the active P2 Flow Sequence roadmap (static config or tenant-scoped `msgf_rules`). */
export type P2RoadmapPlugin = (
  supabase: SupabaseClient | undefined,
  tenantId: string
) => Promise<P2RoadmapConfig> | P2RoadmapConfig;

export type PulseEntitlementInput = {
  entityId: string;
  tenantId?: string;
  profile: P4ProfileEntitlementRow;
};

export type PulseEntitlementResult =
  | { allowed: true }
  | { allowed: false; reason: string; status?: number; code?: string };

/**
 * Stripe / credits / tier evaluation supplied by the host product.
 * When omitted, MSGF uses the built-in `evaluatePulseEntitlement` (p4_profiles).
 */
export type EntitlementPlugin = {
  evaluatePulse?: (
    input: PulseEntitlementInput
  ) => PulseEntitlementResult | Promise<PulseEntitlementResult>;

  /**
   * Optional Next.js middleware hook (`POST /api/msgf/pulse`).
   * Return a blocking response to deny; `null` to continue (or fall through to default guard).
   */
  assertPulseRequest?: (
    request: NextRequest
  ) => Promise<NextResponse | null> | NextResponse | null;
};

export type MsgfPluginRegistry = {
  p2Roadmap?: P2RoadmapPlugin;
  entitlement?: EntitlementPlugin;
  defaultTenantId?: string;
};
