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
 * Distribution Build ID: MSGF-7175065-20260515T200509Z-internal
 */
/**

 * Local Gateway — routine (low logic drift) pulses update session-local state beats

 * without dual-model CONVERGE / Vault-Hall persist.

 *

 * Physical table: `state_beats` with `metadata.beat_kind = "local_state"`.

 */



import type { SupabaseClient } from "@supabase/supabase-js";



import { StateLedgerP4, type KeystrokeEvent, type StateBeatRow } from "@/lib/P4";

import type { LogicDriftAssessment } from "@/lib/services/logic-drift";



export const LOCAL_STATE_BEAT_KIND = "local_state" as const;



export type LocalGatewayInput = {

  supabase: SupabaseClient;

  tenantId: string;

  entityId: string;

  legalVersion: string;

  pulseText: string;

  keystrokes: KeystrokeEvent[];

  logicDrift: LogicDriftAssessment;

  isPillarBaselineSet: boolean;

  defendPreflightTier: string;

};



export type LocalGatewayResult = {

  storedBeat: StateBeatRow;

  summaryBeat: string;

};



function summarizeLocalBeat(pulseText: string, keystrokes: KeystrokeEvent[]): string {

  const snippet = pulseText.trim().slice(0, 240);

  return `Local gateway: routine pulse (${keystrokes.length} keystrokes) — ${snippet || "(empty)"}`;

}



/**

 * Append a session-local beat (logical `local_state_beats` → `state_beats` row).

 */

export async function processLocalGateway(

  input: LocalGatewayInput

): Promise<LocalGatewayResult> {

  const p4 = new StateLedgerP4(input.supabase, input.tenantId);

  const summaryBeat = summarizeLocalBeat(input.pulseText, input.keystrokes);



  const storedBeat = await p4.appendBeat(input.entityId, summaryBeat, {

    legalVersion: input.legalVersion,

    label: "local_gateway",

    metadata: {

      beat_kind: LOCAL_STATE_BEAT_KIND,

      gateway: "local",

      logic_drift_score: input.logicDrift.score,

      logic_drift_factors: input.logicDrift.factors,

      contradicts_p2_roadmap: input.logicDrift.contradictsP2Roadmap,

      is_pillar_baseline_set: input.isPillarBaselineSet,

      keystroke_count: input.keystrokes.length,

      defend_preflight_tier: input.defendPreflightTier,

      routing: "local_gateway",

    },

  });



  return { storedBeat, summaryBeat };

}


