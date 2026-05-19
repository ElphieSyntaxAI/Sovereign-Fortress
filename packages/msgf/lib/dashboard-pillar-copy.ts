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
 * Distribution Build ID: MSGF-81e8259-20260519T153428Z-internal
 */
/** V3.0 / V3.2 governance pillar labels for the SaaS dashboard (see docs/MSGF_PILLAR_MAPPING_SSOT.md). */

import type { MsgfGovernancePillar } from "@/lib/services/pillar-baseline";

export type GovernancePillarCardCopy = {
  pillar: MsgfGovernancePillar;
  title: string;
  subtitle: string;
  v32Step: string;
};

export const GOVERNANCE_PILLAR_CARDS: GovernancePillarCardCopy[] = [
  {
    pillar: "P1",
    title: "Static Ledger",
    subtitle: "Immutable rules, legal versions, security HALT",
    v32Step: "DEFEND",
  },
  {
    pillar: "P2",
    title: "Flow Sequence",
    subtitle: "Gate orchestration & deployment order",
    v32Step: "CONVERGE",
  },
  {
    pillar: "P3",
    title: "Entity Profiles",
    subtitle: "Roles, tiers, tenant identity",
    v32Step: "SHARD (P3)",
  },
  {
    pillar: "P4",
    title: "State Ledger",
    subtitle: "Session beats, HAL telemetry, hot slices",
    v32Step: "SHARD",
  },
  {
    pillar: "P5",
    title: "Local Variables",
    subtitle: "Tenant UI shards & module context",
    v32Step: "SWEEP",
  },
  {
    pillar: "P6",
    title: "Constraint Ledger",
    subtitle: "Vault vs Hall, lineage 1.1.1",
    v32Step: "CROSS-REF / PERSIST",
  },
];

export function pillarCardCopy(pillar: MsgfGovernancePillar): GovernancePillarCardCopy {
  return GOVERNANCE_PILLAR_CARDS.find((c) => c.pillar === pillar) ?? GOVERNANCE_PILLAR_CARDS[0];
}
