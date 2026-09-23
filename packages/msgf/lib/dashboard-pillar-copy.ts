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
/** V3.0 / V3.2 governance pillar labels for the SaaS dashboard (see docs/msgf/technical-specs/MSGF_PILLAR_MAPPING_SSOT.md). */

import type { MsgfGovernancePillar } from "@/lib/services/pillar-baseline";
import { OFFICIAL_PILLAR_TITLE, PILLAR_CARD_FACE } from "@/lib/pillar-display";

export type GovernancePillarCardCopy = {
  pillar: MsgfGovernancePillar;
  /** One-line card face. */
  title: string;
  /** Official title, shown on drilldown and as the card gloss. */
  subtitle: string;
  v32Step: string;
};

export const GOVERNANCE_PILLAR_CARDS: GovernancePillarCardCopy[] = [
  {
    pillar: "P1",
    title: PILLAR_CARD_FACE.P1,
    subtitle: OFFICIAL_PILLAR_TITLE.P1,
    v32Step: "DEFEND",
  },
  {
    pillar: "P2",
    title: PILLAR_CARD_FACE.P2,
    subtitle: OFFICIAL_PILLAR_TITLE.P2,
    v32Step: "CONVERGE",
  },
  {
    pillar: "P3",
    title: PILLAR_CARD_FACE.P3,
    subtitle: OFFICIAL_PILLAR_TITLE.P3,
    v32Step: "SHARD (P3)",
  },
  {
    pillar: "P4",
    title: PILLAR_CARD_FACE.P4,
    subtitle: OFFICIAL_PILLAR_TITLE.P4,
    v32Step: "SHARD",
  },
  {
    pillar: "P5",
    title: PILLAR_CARD_FACE.P5,
    subtitle: OFFICIAL_PILLAR_TITLE.P5,
    v32Step: "SWEEP",
  },
  {
    pillar: "P6",
    title: PILLAR_CARD_FACE.P6,
    subtitle: OFFICIAL_PILLAR_TITLE.P6,
    v32Step: "CROSS-REF / PERSIST",
  },
];

export function pillarCardCopy(pillar: MsgfGovernancePillar): GovernancePillarCardCopy {
  return GOVERNANCE_PILLAR_CARDS.find((c) => c.pillar === pillar) ?? GOVERNANCE_PILLAR_CARDS[0];
}
