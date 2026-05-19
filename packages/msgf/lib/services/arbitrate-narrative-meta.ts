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
 * Distribution Build ID: MSGF-5e9b050-20260519T172718Z-internal
 */
import type { ModelVerdict } from "@/lib/msgf-consensus";

/** Snapshot stored on Hall / ARBITRATE `p4_narrative_logs.metadata` for ops review. */
export function buildArbitrateNarrativeExtra(input: {
  keystrokesPlainText: string;
  geminiVerdict: ModelVerdict;
  claudeVerdict: ModelVerdict;
  modelsDisagree: boolean;
  allHumanConfirmed: boolean;
  haltStateSummary?: string;
}): Record<string, unknown> {
  const modelsDisagreeBlob = {
    flag: input.modelsDisagree,
    gemini_verdict: input.geminiVerdict,
    claude_verdict: input.claudeVerdict,
    all_human_confirmed: input.allHumanConfirmed,
  };

  return {
    keystrokes_plain_text: input.keystrokesPlainText,
    models_disagree: modelsDisagreeBlob,
    consensus_summary: {
      gemini: input.geminiVerdict,
      claude: input.claudeVerdict,
      models_disagree: input.modelsDisagree,
      all_human_confirmed: input.allHumanConfirmed,
    },
    ...(input.haltStateSummary ? { halt_state_summary: input.haltStateSummary } : {}),
  };
}
