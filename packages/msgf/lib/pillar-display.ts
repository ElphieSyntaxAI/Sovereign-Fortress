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
import type { MsgfGovernancePillar } from "@/lib/services/pillar-baseline";

/** Official buyer title. Same string in health, daily reports, guides, and drilldowns. */
export const OFFICIAL_PILLAR_TITLE: Record<MsgfGovernancePillar, string> = {
  P1: "Static Ledger (Immutable Rules & Security)",
  P2: "Flow Sequence (Pipeline & Execution Order)",
  P3: "Entity Profiles (Identity, Roles & Stylometry)",
  P4: "State Ledger (Runtime Telemetry & Active Memory)",
  P5: "Local Variables (Workspace Context Sharding)",
  P6: "Constraint Ledger (Vault vs. Hall Anomaly Isolation)",
};

/** One-line card face. Full title stays on the drilldown. */
export const PILLAR_CARD_FACE: Record<MsgfGovernancePillar, string> = {
  P1: "P1 · Rules",
  P2: "P2 · Flow",
  P3: "P3 · Identity",
  P4: "P4 · State",
  P5: "P5 · Context",
  P6: "P6 · Isolation",
};

export function officialPillarTitle(pillarId: string): string {
  if (pillarId in OFFICIAL_PILLAR_TITLE) {
    return OFFICIAL_PILLAR_TITLE[pillarId as MsgfGovernancePillar];
  }
  return pillarId;
}
