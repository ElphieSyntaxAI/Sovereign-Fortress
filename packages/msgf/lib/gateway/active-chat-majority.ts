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
/**
 * Active full-consensus chat majority.
 * Does not call the Pulse keystroke consensus gateway.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { computeConsensusAgreementScore } from "@/lib/services/consensus-output-comparison";
import { DUAL_MODEL_GATEWAY_AGREEMENT_THRESHOLD } from "@/lib/services/dual-model-consensus-gateway";
import {
  isTriConsensusEnabled,
  type MsgfConsensusProvider,
} from "@/lib/services/consensus/msgf-consensus-config";
import { getTenantConsensusConfig } from "@/lib/services/tenant-consensus-config";
import { decryptTenantProviderCredential } from "@/lib/services/tenant-provider-credentials";
import {
  runTenantAnthropicValidation,
  runTenantGeminiValidation,
} from "@/lib/services/dual-model-consensus-gateway";
import { runTenantXaiValidation } from "@/lib/services/consensus/xai-validation";

export function activeConsensusWidth(input: {
  aggressiveness: string;
  escalate: boolean;
  triEnabled: boolean;
  presetId: string | null;
}): 1 | 2 | 3 {
  if (input.aggressiveness !== "full-consensus" || !input.escalate) return 1;
  if (input.presetId === "solo_fast") return 1;
  if (input.triEnabled && input.presetId === "tri_tribunal") return 3;
  return 2;
}

export function majorityFromCompletions(
  texts: string[],
  threshold = DUAL_MODEL_GATEWAY_AGREEMENT_THRESHOLD
): { majority: boolean; text: string; agreement: number } {
  const usable = texts.map((t) => t.trim()).filter(Boolean);
  if (usable.length === 0) return { majority: false, text: "", agreement: 0 };
  if (usable.length === 1) return { majority: false, text: usable[0]!, agreement: 0 };

  let sum = 0;
  let n = 0;
  for (let i = 0; i < usable.length; i++) {
    for (let j = i + 1; j < usable.length; j++) {
      sum += computeConsensusAgreementScore(usable[i]!, usable[j]!);
      n += 1;
    }
  }
  const agreement = n ? sum / n : 0;
  return {
    majority: agreement >= threshold,
    text: usable[0]!,
    agreement,
  };
}

function credentialProvider(
  provider: MsgfConsensusProvider
): "gemini" | "anthropic" | "xai" {
  if (provider === "google") return "gemini";
  return provider;
}

async function completeWithProvider(
  provider: MsgfConsensusProvider,
  apiKey: string,
  prompt: string
): Promise<string> {
  if (provider === "google") return runTenantGeminiValidation(apiKey, prompt);
  if (provider === "anthropic") return runTenantAnthropicValidation(apiKey, prompt);
  return runTenantXaiValidation(apiKey, prompt);
}

/** Extra model texts for a full-consensus Active call. Empty when keys or calls fail. */
export async function loadExtraConsensusTexts(params: {
  admin: SupabaseClient;
  tenantId: string;
  prompt: string;
  width: 2 | 3;
}): Promise<string[]> {
  try {
    const config = await getTenantConsensusConfig({
      admin: params.admin,
      tenantId: params.tenantId,
    });
    const providers = config.providers.slice(0, params.width);
    const texts: string[] = [];
    for (const provider of providers) {
      if (texts.length >= params.width - 1) break;
      const key = await decryptTenantProviderCredential({
        admin: params.admin,
        tenantId: params.tenantId,
        provider: credentialProvider(provider),
      });
      if (!key) continue;
      const text = await completeWithProvider(provider, key, params.prompt);
      if (text.trim()) texts.push(text.trim());
    }
    return texts;
  } catch (e) {
    console.warn(
      "[active-chat-majority] extra completions skipped:",
      e instanceof Error ? e.message : e
    );
    return [];
  }
}

export function triEnabledForActive(): boolean {
  return isTriConsensusEnabled();
}
