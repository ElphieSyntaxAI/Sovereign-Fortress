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
 * Tenant local CONVERGE gateway — preset-aware dual (or TRI) BYOK validators.
 * Split agreement Soft-escalates to sovereign auditor (TRI-augmented when flag on).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { KeystrokeEvent } from "@/lib/P4";
import { PulseHttpError } from "@/lib/services/pulse-http-error";
import { computeConsensusAgreementScore } from "@/lib/services/consensus-output-comparison";
import {
  decryptTenantProviderCredential,
  listTenantProviderCredentialPresence,
  type TenantProviderKeyProvider,
} from "@/lib/services/tenant-provider-credentials";
import { runSovereignAuditorDualMaster } from "@/lib/services/sovereign-auditor";
import { runTenantXaiValidation, platformXaiApiKey } from "@/lib/services/consensus/xai-validation";
import {
  SMALL_BRAIN_DEFAULT,
  consensusProviderToCredentialKey,
  type MSGFConsensusConfig,
  type MsgfConsensusProvider,
} from "@/lib/services/consensus/msgf-consensus-config";
import { getTenantConsensusConfig } from "@/lib/services/tenant-consensus-config";
import {
  executeAiWave,
  isCostRunawayError,
  runWithLlmTimeout,
  runWithLlmTimeoutSimple,
} from "@/lib/services/cost-runaway-guard";
import {
  parseAnthropicUsage,
  parseGeminiUsage,
  recordMeteredProviderUsage,
  type ProviderMeterContext,
} from "@/lib/services/provider-usage-meter";

export { runTenantXaiValidation, platformXaiApiKey };

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
  consensus_providers?: MsgfConsensusProvider[];
  consensus_mode?: string;
};

export async function runTenantGeminiValidation(
  apiKey: string,
  prompt: string,
  meter?: ProviderMeterContext
): Promise<string> {
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
  if (meter) {
    const sample = parseGeminiUsage(
      (resp as { usageMetadata?: unknown } | undefined)?.usageMetadata,
      modelId
    );
    if (sample) void recordMeteredProviderUsage(meter, sample);
  }
  return text.trim();
}

export async function runTenantAnthropicValidation(
  apiKey: string,
  prompt: string,
  meter?: ProviderMeterContext
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
    if (meter) {
      const sample = parseAnthropicUsage(msg.usage, modelId);
      if (sample) void recordMeteredProviderUsage(meter, sample);
    }
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

type ResolvedValidatorKeys = {
  google: string | null;
  anthropic: string | null;
  xai: string | null;
};

async function resolveValidatorKey(
  admin: SupabaseClient,
  tenantId: string,
  provider: MsgfConsensusProvider,
  byok: ResolvedValidatorKeys
): Promise<string | null> {
  const cred = consensusProviderToCredentialKey(provider);
  const fromByok =
    cred === "gemini" ? byok.google : cred === "anthropic" ? byok.anthropic : byok.xai;
  if (fromByok?.trim()) return fromByok.trim();
  return (
    (await decryptTenantProviderCredential({
      admin,
      tenantId,
      provider: cred as TenantProviderKeyProvider,
    })) || null
  );
}

/**
 * Ensures tenant has credentials for every provider in the Small Brain preset.
 */
export async function assertTenantDualValidationModelsConfigured(
  admin: SupabaseClient,
  tenantId: string,
  config: MSGFConsensusConfig = SMALL_BRAIN_DEFAULT
): Promise<void> {
  const presence = await listTenantProviderCredentialPresence({ admin, tenantId });
  const missing: string[] = [];
  for (const p of config.providers) {
    const cred = consensusProviderToCredentialKey(p);
    if (!presence[cred]) missing.push(p);
  }
  if (missing.length) {
    throw new PulseHttpError(400, {
      error: config.mode === "SOLO_FAST" ? "Default AI provider is not configured." : ERR_TWO_MODELS,
      code: config.mode === "SOLO_FAST" ? "DEFAULT_PROVIDER_CONFIG_REQUIRED" : "DUAL_MODEL_CONFIG_REQUIRED",
      missing_providers: missing,
      gemini_configured: presence.gemini,
      anthropic_configured: presence.anthropic,
      xai_configured: presence.xai,
    });
  }
}

async function runProviderValidation(
  provider: MsgfConsensusProvider,
  apiKey: string,
  prompt: string,
  meter?: ProviderMeterContext
): Promise<string> {
  if (provider === "google") return runTenantGeminiValidation(apiKey, prompt, meter);
  if (provider === "anthropic") return runTenantAnthropicValidation(apiKey, prompt, meter);
  return runTenantXaiValidation(apiKey, prompt, meter);
}

function pairwiseAgreement(outputs: string[]): number {
  if (outputs.length < 2) return outputs.length === 1 ? 1 : 0;
  let sum = 0;
  let n = 0;
  for (let i = 0; i < outputs.length; i++) {
    for (let j = i + 1; j < outputs.length; j++) {
      sum += computeConsensusAgreementScore(outputs[i]!, outputs[j]!);
      n += 1;
    }
  }
  return n ? sum / n : 0;
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
  byokGeminiKey?: string | null;
  byokAnthropicKey?: string | null;
  byokXaiKey?: string | null;
  /** Tenant Small Brain preset; loaded from DB when omitted. */
  consensusConfig?: MSGFConsensusConfig | null;
  skipTenantCredentialAssert?: boolean;
}): Promise<DualModelGatewaySnapshot> {
  const consensusConfig =
    params.consensusConfig ??
    (await getTenantConsensusConfig({
      admin: params.adminSupabase,
      tenantId: params.tenantId,
    }));

  const byok: ResolvedValidatorKeys = {
    google: params.byokGeminiKey?.trim() || null,
    anthropic: params.byokAnthropicKey?.trim() || null,
    xai: params.byokXaiKey?.trim() || null,
  };

  const headerCoversPreset = consensusConfig.providers.every((p) => {
    const cred = consensusProviderToCredentialKey(p);
    if (cred === "gemini") return Boolean(byok.google);
    if (cred === "anthropic") return Boolean(byok.anthropic);
    return Boolean(byok.xai);
  });

  const skipVaultAssert =
    params.skipTenantCredentialAssert === true || headerCoversPreset;

  if (!skipVaultAssert) {
    await assertTenantDualValidationModelsConfigured(
      params.adminSupabase,
      params.tenantId,
      consensusConfig
    );
  }

  const keys: string[] = [];
  for (const p of consensusConfig.providers) {
    const k = await resolveValidatorKey(params.adminSupabase, params.tenantId, p, byok);
    if (!k?.trim()) {
      throw new PulseHttpError(400, {
        error: ERR_TWO_MODELS,
        code: "DUAL_MODEL_DECRYPT_FAILED",
        missing_provider: p,
      });
    }
    keys.push(k);
  }

  const prompt = buildTenantDualValidationPrompt(params);
  const meter: ProviderMeterContext = {
    tenantId: params.tenantId,
    purpose: "dual_model",
  };

  const outputs = await executeAiWave("dual_model.tenant_validators", () =>
    Promise.all(
      consensusConfig.providers.map((p, i) =>
        runProviderValidation(p, keys[i]!, prompt, meter)
      )
    )
  );

  const tenantAgreementScore =
    consensusConfig.mode === "SOLO_FAST" ? 1 : pairwiseAgreement(outputs);
  // Prefer google/anthropic labels for sovereign auditor inputs when present.
  const googleIdx = consensusConfig.providers.indexOf("google");
  const anthropicIdx = consensusConfig.providers.indexOf("anthropic");
  const tenantGeminiOutput =
    googleIdx >= 0 ? outputs[googleIdx]! : outputs[0] ?? "";
  const tenantAnthropicOutput =
    anthropicIdx >= 0
      ? outputs[anthropicIdx]!
      : outputs[1] ?? outputs[0] ?? "";

  if (tenantAgreementScore >= DUAL_MODEL_GATEWAY_AGREEMENT_THRESHOLD) {
    return {
      tenant_agreement_score: tenantAgreementScore,
      sovereign_escalated: false,
      sovereign_agreement_score: null,
      consensus_providers: consensusConfig.providers,
      consensus_mode: consensusConfig.mode,
    };
  }

  // Soft escalate: dual/preset split → sovereign auditor (TRI-augmented when flag on).
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
      consensus_providers: consensusConfig.providers,
      consensus_mode: consensusConfig.mode,
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
      consensus_providers: consensusConfig.providers,
      consensus_mode: consensusConfig.mode,
    };
  }
}
