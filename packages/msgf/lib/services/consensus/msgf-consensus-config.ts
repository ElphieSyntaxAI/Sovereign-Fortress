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
 * MSGF consensus config — Big Brain TRI defaults + Small Brain tenant presets.
 */

import type { PublicCustomEndpoint } from "@/lib/services/model-routing/types";

export type MsgfConsensusProvider = "anthropic" | "google" | "xai";
export type MsgfConsensusMode = "DUAL" | "TRI" | "SOLO_FAST";
export type MsgfConsensusStrictness = "UNANIMOUS" | "MAJORITY";

export type MSGFConsensusConfig = {
  mode: MsgfConsensusMode;
  providers: MsgfConsensusProvider[];
  strictness: MsgfConsensusStrictness;
  profileId?: string;
  /** Small Brain / SOLO_FAST lead. Must be in `providers`. */
  defaultProvider?: MsgfConsensusProvider;
  /** Present on eco_trio reads. Never mixed into `providers`. */
  customEcoEndpoints?: PublicCustomEndpoint[];
  /** Optional DeepSeek R1 (or other) reasoning endpoint for medium drift when useForReasoning. */
  customReasoningEndpoint?: PublicCustomEndpoint | null;
};

/** Platform Small Brain lead — Gemini (Vertex + IDE default). */
export const DEFAULT_AI_PROVIDER: MsgfConsensusProvider = "google";

export const CONSENSUS_PROVIDER_ORDER: MsgfConsensusProvider[] = [
  "google",
  "anthropic",
  "xai",
];

export type MsgfConsensusProfileId =
  | "platform_tri_tribunal"
  | "balanced_dual"
  | "bias_mitigated_dual"
  | "gemini_grok_dual"
  | "tri_tribunal"
  | "custom_byok"
  | "solo_fast"
  | "eco_trio";

export const BIG_BRAIN_DEFAULT: MSGFConsensusConfig = {
  mode: "TRI",
  providers: ["anthropic", "google", "xai"],
  strictness: "MAJORITY",
  profileId: "platform_tri_tribunal",
};

export const SMALL_BRAIN_DEFAULT: MSGFConsensusConfig = {
  mode: "DUAL",
  providers: ["google", "anthropic"],
  strictness: "UNANIMOUS",
  profileId: "balanced_dual",
  defaultProvider: DEFAULT_AI_PROVIDER,
};

export const CONSENSUS_PRESET_CATALOG: Record<
  Exclude<MsgfConsensusProfileId, "custom_byok" | "platform_tri_tribunal" | "eco_trio">,
  MSGFConsensusConfig
> = {
  balanced_dual: {
    mode: "DUAL",
    providers: ["google", "anthropic"],
    strictness: "UNANIMOUS",
    profileId: "balanced_dual",
    defaultProvider: DEFAULT_AI_PROVIDER,
  },
  bias_mitigated_dual: {
    mode: "DUAL",
    providers: ["anthropic", "xai"],
    strictness: "UNANIMOUS",
    profileId: "bias_mitigated_dual",
    defaultProvider: "anthropic",
  },
  gemini_grok_dual: {
    mode: "DUAL",
    providers: ["google", "xai"],
    strictness: "UNANIMOUS",
    profileId: "gemini_grok_dual",
    defaultProvider: DEFAULT_AI_PROVIDER,
  },
  tri_tribunal: {
    mode: "TRI",
    providers: ["google", "anthropic", "xai"],
    strictness: "MAJORITY",
    profileId: "tri_tribunal",
    defaultProvider: DEFAULT_AI_PROVIDER,
  },
  solo_fast: {
    mode: "SOLO_FAST",
    providers: [DEFAULT_AI_PROVIDER],
    strictness: "UNANIMOUS",
    profileId: "solo_fast",
    defaultProvider: DEFAULT_AI_PROVIDER,
  },
};

export const TENANT_PRESET_IDS = [
  "solo_fast",
  "balanced_dual",
  "bias_mitigated_dual",
  "gemini_grok_dual",
  "tri_tribunal",
  "custom_byok",
  "eco_trio",
] as const;

export type TenantConsensusPresetId = (typeof TENANT_PRESET_IDS)[number];

export function isTriConsensusEnabled(): boolean {
  const v = process.env.MSGF_TRI_CONSENSUS_ENABLED?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function isTenantTriConsensusEnabled(): boolean {
  const v = process.env.MSGF_TENANT_TRI_CONSENSUS_ENABLED?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/** Default human-notify threshold (original logic drift). Escalate-to-Big stays at 0.3. */
export const DEFAULT_HUMAN_NOTIFY_THRESHOLD = 0.45;

export function resolveHumanNotifyThreshold(headerValue?: string | null): number {
  const raw = headerValue?.trim() || process.env.MSGF_HUMAN_NOTIFY_THRESHOLD?.trim();
  if (!raw) return DEFAULT_HUMAN_NOTIFY_THRESHOLD;
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_HUMAN_NOTIFY_THRESHOLD;
  return Math.min(0.95, Math.max(0.3, n));
}

export function parseMsgfConsensusProvider(value: unknown): MsgfConsensusProvider | null {
  const p = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (p === "anthropic" || p === "google" || p === "xai") return p;
  if (p === "gemini") return "google";
  return null;
}

export function validateConsensusConfig(
  config: MSGFConsensusConfig
): { ok: true; config: MSGFConsensusConfig } | { ok: false; error: string } {
  const providers = [...new Set(config.providers)];
  if (providers.length !== config.providers.length) {
    return { ok: false, error: "providers must be unique" };
  }
  for (const p of providers) {
    if (p !== "anthropic" && p !== "google" && p !== "xai") {
      return { ok: false, error: `invalid provider: ${p}` };
    }
  }
  if (config.mode === "SOLO_FAST" && providers.length !== 1) {
    return { ok: false, error: "SOLO_FAST requires exactly 1 provider" };
  }
  if (config.mode === "DUAL" && providers.length !== 2) {
    return { ok: false, error: "DUAL requires exactly 2 providers" };
  }
  if (config.mode === "TRI" && providers.length !== 3) {
    return { ok: false, error: "TRI requires exactly 3 providers" };
  }
  if (config.strictness !== "UNANIMOUS" && config.strictness !== "MAJORITY") {
    return { ok: false, error: "invalid strictness" };
  }
  const defaultProvider = resolveDefaultProvider({ ...config, providers });
  return {
    ok: true,
    config: { ...config, providers, defaultProvider },
  };
}

export function resolveBigBrainConsensusConfig(): MSGFConsensusConfig {
  const raw = process.env.MSGF_BIG_BRAIN_CONSENSUS_JSON?.trim();
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as MSGFConsensusConfig;
      const v = validateConsensusConfig(parsed);
      if (v.ok) return v.config;
    } catch {
      /* fall through */
    }
  }
  if (!isTriConsensusEnabled()) {
    return {
      mode: "DUAL",
      providers: ["anthropic", "google"],
      strictness: "UNANIMOUS",
      profileId: "balanced_dual",
    };
  }
  return { ...BIG_BRAIN_DEFAULT };
}

export function resolveDefaultProvider(config: {
  providers: MsgfConsensusProvider[];
  defaultProvider?: MsgfConsensusProvider;
}): MsgfConsensusProvider {
  if (config.defaultProvider && config.providers.includes(config.defaultProvider)) {
    return config.defaultProvider;
  }
  return config.providers[0] ?? DEFAULT_AI_PROVIDER;
}

/** Put the tenant default first so SOLO_FAST / lead-model callers share one order. */
export function orderProvidersWithDefault(
  providers: MsgfConsensusProvider[],
  defaultProvider?: MsgfConsensusProvider | null
): { providers: MsgfConsensusProvider[]; defaultProvider: MsgfConsensusProvider } {
  const unique = [...new Set(providers)];
  if (unique.length === 0 && defaultProvider) unique.push(defaultProvider);
  const dp =
    defaultProvider && unique.includes(defaultProvider)
      ? defaultProvider
      : unique[0] ?? DEFAULT_AI_PROVIDER;
  if (!unique.includes(dp)) unique.unshift(dp);
  return { defaultProvider: dp, providers: [dp, ...unique.filter((p) => p !== dp)] };
}

export function inferTenantPresetFromProviders(
  providers: MsgfConsensusProvider[]
): TenantConsensusPresetId {
  const unique = [...new Set(providers)];
  if (unique.length <= 1) return "solo_fast";
  if (unique.length === 3) return "tri_tribunal";
  const set = new Set(unique);
  if (set.has("anthropic") && set.has("google")) return "balanced_dual";
  if (set.has("anthropic") && set.has("xai")) return "bias_mitigated_dual";
  if (set.has("google") && set.has("xai")) return "gemini_grok_dual";
  return "custom_byok";
}

export function configFromTenantPreset(
  profileId: TenantConsensusPresetId,
  customProviders?: MsgfConsensusProvider[],
  defaultProvider?: MsgfConsensusProvider
): MSGFConsensusConfig | { error: string } {
  if (profileId === "eco_trio") {
    const providers =
      customProviders && customProviders.length > 0
        ? orderProvidersWithDefault(customProviders, defaultProvider).providers
        : [...SMALL_BRAIN_DEFAULT.providers];
    return {
      mode: "TRI",
      providers,
      strictness: "MAJORITY",
      profileId: "eco_trio",
      defaultProvider: "google",
    };
  }
  if (profileId === "custom_byok" || profileId === "solo_fast") {
    const ordered = orderProvidersWithDefault(
      customProviders?.length ? customProviders : defaultProvider ? [defaultProvider] : [],
      defaultProvider
    );
    const inferred = inferTenantPresetFromProviders(ordered.providers);
    const mode: MsgfConsensusMode =
      ordered.providers.length === 3
        ? "TRI"
        : ordered.providers.length === 1
          ? "SOLO_FAST"
          : "DUAL";
    const strictness: MsgfConsensusStrictness = mode === "TRI" ? "MAJORITY" : "UNANIMOUS";
    const v = validateConsensusConfig({
      mode,
      providers: ordered.providers,
      strictness,
      profileId: inferred === "tri_tribunal" && profileId === "custom_byok" ? "custom_byok" : inferred,
      defaultProvider: ordered.defaultProvider,
    });
    return v.ok ? v.config : { error: v.error };
  }
  if (profileId === "tri_tribunal" && !isTenantTriConsensusEnabled()) {
    return { error: "tri_tribunal requires MSGF_TENANT_TRI_CONSENSUS_ENABLED=1" };
  }
  const preset = CONSENSUS_PRESET_CATALOG[profileId as keyof typeof CONSENSUS_PRESET_CATALOG];
  if (!preset) return { error: `unknown profile: ${profileId}` };
  const ordered = orderProvidersWithDefault(preset.providers, defaultProvider);
  return {
    ...preset,
    providers: ordered.providers,
    defaultProvider: ordered.defaultProvider,
  };
}

/** Map consensus provider → tenant credential provider key. */
export function consensusProviderToCredentialKey(
  p: MsgfConsensusProvider
): "gemini" | "anthropic" | "xai" {
  if (p === "google") return "gemini";
  return p;
}

/** True when every provider in the Small Brain preset has a usable key. */
export function byokSatisfiesConsensusConfig(
  byok: {
    gemini: string | null;
    anthropic: string | null;
    xai: string | null;
  },
  config: MSGFConsensusConfig
): boolean {
  const keyFor = (p: MsgfConsensusProvider): string | null => {
    const cred = consensusProviderToCredentialKey(p);
    if (cred === "gemini") return byok.gemini;
    if (cred === "anthropic") return byok.anthropic;
    return byok.xai;
  };
  return config.providers.every((p) => Boolean(keyFor(p)?.trim()));
}

