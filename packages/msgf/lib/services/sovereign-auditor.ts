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
 * Distribution Build ID: MSGF-08289e1a-20260923T172846Z-internal
 */
/**
 * SovereignAuditor — isolated Master Gemini + Anthropic (Vertex publisher paths)
 * for final verdict when tenant-side dual validators disagree below threshold.
 */

import { getGcpProjectId } from "@/lib/msgf-vertex";
import { computeConsensusAgreementScore } from "@/lib/services/consensus-output-comparison";
import { generatePublisherText } from "@/lib/services/vertex-publisher-generate";

const VERTEX_LOCATION = process.env.GCP_LOCATION || "us-central1";
const CLAUDE_VERTEX_LOCATION =
  process.env.MSGF_CLAUDE_VERTEX_LOCATION?.trim() ||
  process.env.GCP_CLAUDE_LOCATION?.trim() ||
  "global";
const CLAUDE_MASTER_MODEL =
  process.env.MSGF_SOVEREIGN_CLAUDE_MODEL?.trim() ||
  process.env.MSGF_CLAUDE_MODEL?.trim() ||
  "claude-sonnet-4@20250514";

async function runMasterPublisherModel(modelPath: string, prompt: string): Promise<string> {
  return generatePublisherText({
    modelPath,
    prompt,
    maxTokens: 400,
    temperature: 0.05,
    timeoutLabel: `sovereign.publisher.${modelPath.slice(-24)}`,
  });
}

function buildSovereignPrompt(params: {
  pulseText: string;
  tenantGeminiOutput: string;
  tenantAnthropicOutput: string;
  tenantAgreementScore: number;
  beatsContext: string;
  p2FlowDirective: string;
  vaultCrossRefContext: string;
  defendConstraints?: string;
}): string {
  return `You are MSGF SovereignAuditor (Master isolation tier).
Tenant-provided dual validators scored agreement=${params.tenantAgreementScore.toFixed(4)} (threshold 0.80).

${params.defendConstraints ?? ""}
${params.p2FlowDirective ?? ""}
${params.vaultCrossRefContext ?? ""}

Prior beats (abridged):
${params.beatsContext.slice(0, 1400)}

Tenant Gemini validator output (summary):
${params.tenantGeminiOutput.slice(0, 1600)}

Tenant Anthropic validator output (summary):
${params.tenantAnthropicOutput.slice(0, 1600)}

Pulse excerpt (semantic classification only; do NOT quote verbatim):
${params.pulseText.slice(0, 1400)}

Task: Produce the authoritative audit verdict for whether this pulse session passes routine human drafting validation gates.

Reply with strict JSON only:
{"audit_verdict":"PASS"|"REVIEW","confidence":0.0-1.0,"primary_signal":"HUMAN_LIKE"|"UNCERTAIN"|"AUTOMATION_SIGNAL","reason":"concise reason"}

PASS = validators materially agree enough for session continuation under MSGF local gateway.
REVIEW = unresolved disagreement or elevated automation suspicion — downstream gates should treat as escalated.`;
}

export type SovereignAuditorResult = {
  sovereignAgreementScore: number;
  masterGeminiOutput: string;
  masterAnthropicOutput: string;
  masterXaiOutput?: string;
};

/**
 * Runs Master Gemini + Master Claude (+ optional Grok when TRI enabled) and scores consensus.
 */
export async function runSovereignAuditorDualMaster(params: {
  pulseText: string;
  tenantGeminiOutput: string;
  tenantAnthropicOutput: string;
  tenantAgreementScore: number;
  beatsContext: string;
  p2FlowDirective: string;
  vaultCrossRefContext: string;
  defendConstraints?: string;
  geminiModelId: string;
}): Promise<SovereignAuditorResult> {
  const projectId = getGcpProjectId();
  const geminiPath = `projects/${projectId}/locations/${VERTEX_LOCATION}/publishers/google/models/${params.geminiModelId}`;
  const claudePath = `projects/${projectId}/locations/${CLAUDE_VERTEX_LOCATION}/publishers/anthropic/models/${CLAUDE_MASTER_MODEL}`;

  const prompt = buildSovereignPrompt(params);

  const { isTriConsensusEnabled } = await import("@/lib/services/consensus/msgf-consensus-config");
  const { platformXaiApiKey, runTenantXaiValidation } = await import(
    "@/lib/services/consensus/xai-validation"
  );
  const xaiKey = isTriConsensusEnabled() ? platformXaiApiKey() : null;

  const [masterGeminiOutput, masterAnthropicOutput, masterXaiOutput] = await Promise.all([
    runMasterPublisherModel(geminiPath, prompt),
    runMasterPublisherModel(claudePath, prompt),
    xaiKey
      ? runTenantXaiValidation(xaiKey, prompt).catch(() => "")
      : Promise.resolve(""),
  ]);

  let sovereignAgreementScore = computeConsensusAgreementScore(
    masterGeminiOutput,
    masterAnthropicOutput
  );
  if (masterXaiOutput) {
    const withGrok = computeConsensusAgreementScore(masterGeminiOutput, masterXaiOutput);
    sovereignAgreementScore = (sovereignAgreementScore + withGrok) / 2;
  }

  return {
    sovereignAgreementScore,
    masterGeminiOutput,
    masterAnthropicOutput,
    ...(masterXaiOutput ? { masterXaiOutput } : {}),
  };
}
