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
 * Distribution Build ID: MSGF-570add3d-20260922T212921Z-internal
 */
/**
 * Unanimous / majority vote over CONVERGE verdicts (HUMAN | NON_HUMAN | INCONCLUSIVE).
 */

import type { MsgfConsensusStrictness } from "./msgf-consensus-config";

export type ConsensusVoteLabel = "HUMAN" | "NON_HUMAN" | "INCONCLUSIVE";

export type VoteTally = Record<ConsensusVoteLabel, number> & {
  total: number;
  majorityLabel: ConsensusVoteLabel | null;
  no_majority: boolean;
};

export type VoteDecision =
  | { ok: true; decision: "HUMAN_CONFIRMED" | "NON_HUMAN" | "INCONCLUSIVE"; tally: VoteTally }
  | { ok: false; decision: "HITL_TIEBREAKER_REQUIRED"; reason: "no_majority" | "unanimous_fail"; tally: VoteTally };

export function tallyVotes(votes: ConsensusVoteLabel[]): VoteTally {
  const tally: VoteTally = {
    HUMAN: 0,
    NON_HUMAN: 0,
    INCONCLUSIVE: 0,
    total: votes.length,
    majorityLabel: null,
    no_majority: true,
  };
  for (const v of votes) {
    if (v === "HUMAN" || v === "NON_HUMAN" || v === "INCONCLUSIVE") tally[v] += 1;
  }
  if (votes.length === 0) return tally;

  const need = Math.floor(votes.length / 2) + 1; // 2-of-3, 2-of-2, 1-of-1
  const ordered: ConsensusVoteLabel[] = ["HUMAN", "NON_HUMAN", "INCONCLUSIVE"];
  let best: ConsensusVoteLabel | null = null;
  let bestCount = 0;
  for (const label of ordered) {
    if (tally[label] > bestCount) {
      best = label;
      bestCount = tally[label];
    }
  }
  if (best && bestCount >= need) {
    tally.majorityLabel = best;
    tally.no_majority = false;
  }
  return tally;
}

export function decideConsensusVote(
  votes: ConsensusVoteLabel[],
  strictness: MsgfConsensusStrictness
): VoteDecision {
  const tally = tallyVotes(votes);
  if (votes.length === 0) {
    return { ok: false, decision: "HITL_TIEBREAKER_REQUIRED", reason: "no_majority", tally };
  }

  if (strictness === "UNANIMOUS") {
    const first = votes[0];
    const allSame = votes.every((v) => v === first);
    if (!allSame || first === "INCONCLUSIVE") {
      return { ok: false, decision: "HITL_TIEBREAKER_REQUIRED", reason: "unanimous_fail", tally };
    }
    if (first === "HUMAN") {
      return { ok: true, decision: "HUMAN_CONFIRMED", tally };
    }
    return { ok: true, decision: first, tally };
  }

  // MAJORITY
  if (tally.no_majority || !tally.majorityLabel) {
    return { ok: false, decision: "HITL_TIEBREAKER_REQUIRED", reason: "no_majority", tally };
  }
  if (tally.majorityLabel === "HUMAN") {
    return { ok: true, decision: "HUMAN_CONFIRMED", tally };
  }
  return { ok: true, decision: tally.majorityLabel, tally };
}

/**
 * Human notify when original drift is high, or consensus failed, or NON_HUMAN majority.
 * Model disagreement alone does not notify when majority succeeded and drift is below threshold.
 */
export function shouldNotifyHuman(params: {
  logicDriftScore: number;
  humanNotifyThreshold: number;
  voteOk: boolean;
  majorityLabel: ConsensusVoteLabel | null;
  securityNonHuman: boolean;
  tierQuarantined?: boolean;
  tieBreakerProtocolTriggered?: boolean;
  halScore: number;
  allHumanConfirmed: boolean;
}): boolean {
  if (params.tierQuarantined) return true;
  if (params.tieBreakerProtocolTriggered) return true;
  if (params.securityNonHuman) return true;
  if (params.majorityLabel === "NON_HUMAN") return true;
  if (!params.voteOk) return true;
  if (params.logicDriftScore >= params.humanNotifyThreshold) return true;
  if (!params.allHumanConfirmed && params.halScore < 70 && params.logicDriftScore >= params.humanNotifyThreshold) {
    return true;
  }
  // Legacy dual path: low HAL without majority still notifies only if drift high — else majority ok
  if (params.allHumanConfirmed) return false;
  if (params.halScore < 70 && params.logicDriftScore < params.humanNotifyThreshold && params.voteOk) {
    return false;
  }
  if (params.halScore < 70) return true;
  return !params.allHumanConfirmed && !params.voteOk;
}
