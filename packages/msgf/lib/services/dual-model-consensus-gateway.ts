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
 * Distribution Build ID: MSGF-753c05a-20260519T051006Z-internal
 */
/**
 * Dual-Model Consensus Gateway — tenant BYOK validators run in parallel (Promise.all),
 * scored via {@link computeConsensusAgreementScore}; below-threshold paths escalate to
 * {@link runSovereignAuditorDualMaster}.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { KeystrokeEvent } from "@/lib/P4";
import { PulseHttpError } from "@/lib/services/pulse-http-error";
import { computeConsensusAgreementScore } from "@/lib/services/consensus-output-comparison";
import {
  decryptTenantProviderCredential,
  listTenantProviderCredentialPresence,
} from "@/lib/services/tenant-provider-credentials";
import { runSovereignAuditorDualMaster } from "@/lib/services/sovereign-auditor";
import {
  executeAiWave,
  isCostRunawayError,
  runWithLlmTimeout,
  runWithLlmTimeoutSimple,
} from "@/lib/services/cost-runaway-guard";

export const DUAL_MODEL_GATEWAY_AGREEMENT_THRESHOLD = 0.8;

const ERR_TWO_MODELS = "Two validation models are required." as const;

export function isDualModelLocalGatewayEnabled(): boolean {
  const v = process.env.MSGF_DUAL_MODEL_LOCAL_GATEWAY_ENABLED?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export type DualModelGatewaySnapshot = {
  tenant_agreement_score: number;
  sovereign_escalated: boolean;
  sovereign_agreement_score: number | null;
};

export async function runTenantGeminiValidation(apiKey: string, prompt: string): Promise<string> {
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const modelId =
    process.env.MSGF_TENANT_VALIDATION_GEMINI_MODEL?.trim() || "gemini-2.0-flash";
  const gen = new GoogleGenerativeAI(apiKey.trim());
  const model = gen.getGenerativeModel({ model: modelId });
  const res = await runWithLlmTimeoutSimple("dual_model.tenant.gemini", () =>
    model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 320 },
    })
  );
  const resp = res.response;
  const parts = resp?.candidates?.[0]?.content?.parts;
  const text =
    parts?.map((p) => ("text" in p && typeof p.text === "string" ? p.text : "")).join("") ??
    "";
  return text.trim();
}

export async function runTenantAnthropicValidation(
  apiKey: string,
  prompt: string
): Promise<string> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const modelId =
    process.env.MSGF_TENANT_VALIDATION_ANTHROPIC_MODEL?.trim() ||
    "claude-3-5-sonnet-20241022";
  const client = new Anthropic({ apiKey: apiKey.trim() });
  return runWithLlmTimeout("dual_model.tenant.anthropic", async (signal) => {
    const msg = await client.messages.create(
      {
        model: modelId,
        max_tokens: 360,
        messages: [{ role: "user", content: prompt }],
      },
      { signal }
    );
    const block = msg.content[0];
    return block.type === "text" ? block.text.trim() : "";
  });
}

function buildTenantDualValidationPrompt(params: {
  pulseText: string;
  keystrokes: KeystrokeEvent[];
  beatsContext: string;
  p2FlowDirective: string;
  vaultCrossRefContext: string;
  defendConstraints?: string;
}): string {
  return `You are a tenant-local MSGF validation model (dual-consensus gateway tier).
${params.defendConstraints ?? ""}
${params.p2FlowDirective ?? ""}
${params.vaultCrossRefContext ?? ""}

Prior user beat context:
${params.beatsContext}

Drafting telemetry:
Keystroke events: ${params.keystrokes.length}

Recovered pulse text (classification only):
${params.pulseText.slice(0, 2400)}

Reply with strict JSON only:
{"verdict":"HUMAN","reason":"short reason"}

Allowed verdict values: HUMAN, NON_HUMAN, INCONCLUSIVE.`;
}

/**
 * Ensures tenant has **both** Gemini and Anthropic encrypted credentials configured.
 */
export async function assertTenantDualValidationModelsConfigured(
  admin: SupabaseClient,
  tenantId: string
): Promise<void> {
  const presence = await listTenantProviderCredentialPresence({ admin, tenantId });
  if (!presence.gemini || !presence.anthropic) {
    throw new PulseHttpError(400, {
      error: ERR_TWO_MODELS,
      code: "DUAL_MODEL_CONFIG_REQUIRED",
      gemini_configured: presence.gemini,
      anthropic_configured: presence.anthropic,
    });
  }
}

export async function runTenantDualModelConsensusGateway(params: {
  adminSupabase: SupabaseClient;
  tenantId: string;
  pulseText: string;
  keystrokes: KeystrokeEvent[];
  beatsContext: string;
  p2FlowDirective: string;
  vaultCrossRefContext: string;
  defendConstraints?: string;
  geminiModelId: string;
  /** IDE workspace BYOK overrides (`.msgf/keys/*.key`). */
  byokGeminiKey?: string | null;
  byokAnthropicKey?: string | null;
  /** Corporate system path: do not require tenant vault when headers already carry BYOK. */
  skipTenantCredentialAssert?: boolean;
}): Promise<DualModelGatewaySnapshot> {
  const geminiKey =
    params.byokGeminiKey?.trim() ||
    (await decryptTenantProviderCredential({
      admin: params.adminSupabase,
      tenantId: params.tenantId,
      provider: "gemini",
    }));
  const anthropicKey =
    params.byokAnthropicKey?.trim() ||
    (await decryptTenantProviderCredential({
      admin: params.adminSupabase,
      tenantId: params.tenantId,
      provider: "anthropic",
    }));

  const skipVaultAssert =
    params.skipTenantCredentialAssert === true ||
    Boolean(params.byokGeminiKey?.trim() && params.byokAnthropicKey?.trim());

  if (!skipVaultAssert) {
    await assertTenantDualValidationModelsConfigured(params.adminSupabase, params.tenantId);
  }

  if (!geminiKey?.trim() || !anthropicKey?.trim()) {
    throw new PulseHttpError(400, {
      error: ERR_TWO_MODELS,
      code: "DUAL_MODEL_DECRYPT_FAILED",
    });
  }

  const prompt = buildTenantDualValidationPrompt(params);

  const [tenantGeminiOutput, tenantAnthropicOutput] = await executeAiWave(
    "dual_model.tenant_validators",
    () =>
      Promise.all([
        runTenantGeminiValidation(geminiKey, prompt),
        runTenantAnthropicValidation(anthropicKey, prompt),
      ])
  );

  const tenantAgreementScore = computeConsensusAgreementScore(
    tenantGeminiOutput,
    tenantAnthropicOutput
  );

  if (tenantAgreementScore >= DUAL_MODEL_GATEWAY_AGREEMENT_THRESHOLD) {
    return {
      tenant_agreement_score: tenantAgreementScore,
      sovereign_escalated: false,
      sovereign_agreement_score: null,
    };
  }

  try {
    const sovereign = await executeAiWave("dual_model.sovereign_auditor", () =>
      runSovereignAuditorDualMaster({
        pulseText: params.pulseText,
        tenantGeminiOutput,
        tenantAnthropicOutput,
        tenantAgreementScore,
        beatsContext: params.beatsContext,
        p2FlowDirective: params.p2FlowDirective,
        vaultCrossRefContext: params.vaultCrossRefContext,
        defendConstraints: params.defendConstraints,
        geminiModelId: params.geminiModelId,
      })
    );

    return {
      tenant_agreement_score: tenantAgreementScore,
      sovereign_escalated: true,
      sovereign_agreement_score: sovereign.sovereignAgreementScore,
    };
  } catch (e) {
    if (isCostRunawayError(e)) {
      throw e;
    }
    console.error("[dual-model-consensus-gateway] SovereignAuditor failed:", e);
    return {
      tenant_agreement_score: tenantAgreementScore,
      sovereign_escalated: true,
      sovereign_agreement_score: null,
    };
  }
}
