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
 * Distribution Build ID: MSGF-853c3b6-20260519T054901Z-internal
 */
/**
 * SovereignAuditor — isolated Master Gemini + Anthropic (Vertex publisher paths)
 * for final verdict when tenant-side dual validators disagree below threshold.
 */

import { v1beta1 } from "@google-cloud/aiplatform";

import { getGcpProjectId, SERVICE_ACCOUNT_PATH } from "@/lib/msgf-vertex";
import { computeConsensusAgreementScore } from "@/lib/services/consensus-output-comparison";
import { runWithLlmTimeoutSimple } from "@/lib/services/cost-runaway-guard";

const VERTEX_LOCATION = process.env.GCP_LOCATION || "us-central1";
const CLAUDE_MASTER_MODEL =
  process.env.MSGF_SOVEREIGN_CLAUDE_MODEL?.trim() ||
  process.env.MSGF_CLAUDE_MODEL?.trim() ||
  "claude-4.6-sonnet";

async function runMasterPublisherModel(modelPath: string, prompt: string): Promise<string> {
  const client = new v1beta1.PredictionServiceClient({
    keyFilename: SERVICE_ACCOUNT_PATH,
    apiEndpoint: `${VERTEX_LOCATION}-aiplatform.googleapis.com`,
  });

  const [resp] = await runWithLlmTimeoutSimple(`sovereign.publisher.${modelPath.slice(-24)}`, () =>
    client.generateContent({
      model: modelPath,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.05, maxOutputTokens: 400 },
    })
  );

  return resp?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
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
};

/**
 * Runs Master Gemini + Master Claude **simultaneously** (Promise.all) and scores consensus between outputs.
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
  const claudePath = `projects/${projectId}/locations/${VERTEX_LOCATION}/publishers/anthropic/models/${CLAUDE_MASTER_MODEL}`;

  const prompt = buildSovereignPrompt(params);

  const [masterGeminiOutput, masterAnthropicOutput] = await Promise.all([
    runMasterPublisherModel(geminiPath, prompt),
    runMasterPublisherModel(claudePath, prompt),
  ]);

  const sovereignAgreementScore = computeConsensusAgreementScore(
    masterGeminiOutput,
    masterAnthropicOutput
  );

  return {
    sovereignAgreementScore,
    masterGeminiOutput,
    masterAnthropicOutput,
  };
}
