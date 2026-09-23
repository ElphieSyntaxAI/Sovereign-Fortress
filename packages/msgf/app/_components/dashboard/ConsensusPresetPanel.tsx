"use client";

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
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * This source code and associated documentation are the exclusive property of
 * Elphie Syntax LLC. Unauthorized copying, distribution, publication, or
 * reverse-engineering — including decompilation, disassembly, or derivative
 * works — is strictly prohibited without prior written consent.
 *
 * Distribution Build ID: MSGF-08289e1a-20260923T145027Z-internal
 */
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
 * Distribution Build ID: MSGF-1826a636-20260922T234439Z-internal
 */
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
 * Distribution Build ID: MSGF-1826a636-20260922T233446Z-internal
 */
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
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * This source code and associated documentation are the exclusive property of
 * Elphie Syntax LLC. Unauthorized copying, distribution, publication, or
 * reverse-engineering — including decompilation, disassembly, or derivative
 * works — is strictly prohibited without prior written consent.
 *
 * Distribution Build ID: MSGF-b4dfaf97-20260922T171835Z-internal
 */
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
 * Distribution Build ID: MSGF-b4dfaf97-20260922T170731Z-internal
 */
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
 * Distribution Build ID: MSGF-191e80fa-20260921T055901Z-internal
 */
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
 * Distribution Build ID: MSGF-c122f849-20260911T161212Z-internal
 */
import { useEffect, useMemo, useState } from "react";

import {
  CUSTOM_ANTHROPIC,
  CUSTOM_OPENAI_COMPATIBLE,
  ECO_TRIO_RECOMMENDED_SLOTS,
  customEndpointTooltip,
} from "@/lib/services/model-routing/types";

type ConsensusProvider = "google" | "anthropic" | "xai";

type ConsensusConfig = {
  mode: string;
  providers: string[];
  strictness: string;
  profileId?: string;
  defaultProvider?: string;
  customEcoEndpoints?: PublicEcoSlot[];
};

type PublicEcoSlot = {
  providerId: string;
  displayName: string;
  baseURL: string;
  modelName: string;
  maxTokens: number;
  costPer1kInput: number;
  costPer1kOutput: number;
  isEcoModel: boolean;
  providerKind: "CUSTOM_OPENAI_COMPATIBLE" | "CUSTOM_ANTHROPIC";
  apiKeyConfigured: boolean;
  privateHostAllowed?: boolean;
};

type EcoDraft = PublicEcoSlot & { apiKey: string };

type ApiPayload = {
  config: ConsensusConfig;
  tri_entitlement_enabled: boolean;
  keys: {
    gemini_configured: boolean;
    anthropic_configured: boolean;
    xai_configured: boolean;
  };
};

const PROVIDERS: Array<{ id: ConsensusProvider; label: string; hint: string }> = [
  { id: "google", label: "Gemini", hint: "Google" },
  { id: "anthropic", label: "Claude", hint: "Anthropic" },
  { id: "xai", label: "Grok", hint: "xAI" },
];

const PRESET_LABELS: Record<string, string> = {
  solo_fast: "SOLO_FAST (default only)",
  balanced_dual: "Balanced Dual (Gemini + Claude)",
  bias_mitigated_dual: "Bias-Mitigated Dual (Claude + Grok)",
  gemini_grok_dual: "Gemini + Grok Dual",
  tri_tribunal: "Tri-Tribunal",
  custom_byok: "Custom pair",
  eco_trio: "Eco Trio",
};

const PRESET_PROVIDERS: Record<string, ConsensusProvider[]> = {
  solo_fast: ["google"],
  balanced_dual: ["google", "anthropic"],
  bias_mitigated_dual: ["anthropic", "xai"],
  gemini_grok_dual: ["google", "xai"],
  tri_tribunal: ["google", "anthropic", "xai"],
};

function parseProvider(value: string | undefined): ConsensusProvider | null {
  if (value === "google" || value === "anthropic" || value === "xai") return value;
  if (value === "gemini") return "google";
  return null;
}

function uniqueProviders(list: string[]): ConsensusProvider[] {
  const out: ConsensusProvider[] = [];
  for (const raw of list) {
    const p = parseProvider(raw);
    if (p && !out.includes(p)) out.push(p);
  }
  return out;
}

function inferProfileId(providers: ConsensusProvider[]): string {
  if (providers.length <= 1) return "solo_fast";
  if (providers.length === 3) return "tri_tribunal";
  const set = new Set(providers);
  if (set.has("anthropic") && set.has("google")) return "balanced_dual";
  if (set.has("anthropic") && set.has("xai")) return "bias_mitigated_dual";
  if (set.has("google") && set.has("xai")) return "gemini_grok_dual";
  return "custom_byok";
}

function emptyEcoDrafts(): EcoDraft[] {
  return ECO_TRIO_RECOMMENDED_SLOTS.map((name, index) => ({
    providerId: `eco-${index + 1}`,
    displayName: name,
    baseURL: "",
    modelName: name.toLowerCase().replace(/\s+/g, "-"),
    maxTokens: 4096,
    costPer1kInput: index === 0 ? 0.05 : index === 1 ? 0.08 : 0.12,
    costPer1kOutput: index === 0 ? 0.1 : index === 1 ? 0.16 : 0.2,
    isEcoModel: true,
    providerKind: CUSTOM_OPENAI_COMPATIBLE,
    apiKeyConfigured: false,
    privateHostAllowed: false,
    apiKey: "",
  }));
}

function activePresetBadge(config: ConsensusConfig): string {
  if (config.profileId === "eco_trio") return "Eco Trio";
  if (config.profileId === "tri_tribunal") return "Tri-Tribunal";
  if (config.profileId === "solo_fast" || config.mode === "SOLO_FAST") return "SOLO_FAST";
  if (config.profileId === "balanced_dual") return "Balanced Dual";
  if (config.mode === "DUAL" && !config.profileId) return "Balanced Dual";
  return PRESET_LABELS[config.profileId ?? ""] ?? config.mode;
}

function keyConfigured(keys: ApiPayload["keys"], id: ConsensusProvider): boolean {
  if (id === "google") return keys.gemini_configured;
  if (id === "anthropic") return keys.anthropic_configured;
  return keys.xai_configured;
}

type Props = {
  tenantId?: string | null;
  projectOrigin?: string;
};

export function ConsensusPresetPanel({ tenantId, projectOrigin = "" }: Props) {
  const [data, setData] = useState<ApiPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [defaultProvider, setDefaultProvider] = useState<ConsensusProvider>("google");
  const [dualPartners, setDualPartners] = useState<ConsensusProvider[]>([]);
  const [ecoSlots, setEcoSlots] = useState<EcoDraft[]>(emptyEcoDrafts);
  const [keyDrafts, setKeyDrafts] = useState({ gemini: "", anthropic: "", xai: "" });

  async function load() {
    setError(null);
    const headers: HeadersInit = {};
    if (tenantId?.trim()) headers["x-msgf-tenant-id"] = tenantId.trim();
    const q = projectOrigin
      ? `?project_origin=${encodeURIComponent(projectOrigin)}`
      : "";
    const res = await fetch(`/api/msgf/tenant/consensus-config${q}`, { headers });
    const json = (await res.json().catch(() => ({}))) as ApiPayload & { error?: string };
    if (!res.ok) {
      setError(json.error || "Failed to load consensus config");
      return;
    }
    setData(json);
    const providers = uniqueProviders(json.config.providers ?? []);
    const storedDefault =
      parseProvider(json.config.defaultProvider) ?? providers[0] ?? "google";
    const lead = providers.includes(storedDefault) ? storedDefault : providers[0] ?? "google";
    setDefaultProvider(lead);
    setDualPartners(providers.filter((p) => p !== lead));
    const saved = json.config.customEcoEndpoints;
    if (saved && saved.length === 3) {
      setEcoSlots(
        saved.map((slot) => ({
          ...slot,
          apiKey: "",
        }))
      );
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, projectOrigin]);

  const selectedProviders = useMemo(() => {
    return [defaultProvider, ...dualPartners.filter((p) => p !== defaultProvider)];
  }, [defaultProvider, dualPartners]);

  const currentProfile = inferProfileId(selectedProviders);

  async function save(nextDefault: ConsensusProvider, nextPartners: ConsensusProvider[]) {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const partners = nextPartners.filter((p) => p !== nextDefault);
      let providers: ConsensusProvider[] = [nextDefault, ...partners];
      if (providers.length === 3 && data && !data.tri_entitlement_enabled) {
        providers = providers.slice(0, 2);
      }
      const profileId = inferProfileId(providers);
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (tenantId?.trim()) headers["x-msgf-tenant-id"] = tenantId.trim();
      const res = await fetch("/api/msgf/tenant/consensus-config", {
        method: "PUT",
        headers,
        body: JSON.stringify({
          profileId: profileId === "tri_tribunal" && !data?.tri_entitlement_enabled
            ? "custom_byok"
            : profileId,
          providers,
          defaultProvider: nextDefault,
          project_origin: projectOrigin,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; config?: ConsensusConfig };
      if (!res.ok) {
        setError(json.error || "Save failed");
        return;
      }
      setDefaultProvider(nextDefault);
      setDualPartners(providers.filter((p) => p !== nextDefault));
      setMessage(`Saved: ${PRESET_LABELS[profileId] ?? profileId}`);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function saveProviderKey(provider: "gemini" | "anthropic" | "xai") {
    const apiKey = keyDrafts[provider].trim();
    if (!apiKey) return;
    setSaving(true);
    setError(null);
    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (tenantId?.trim()) headers["x-msgf-tenant-id"] = tenantId.trim();
      const res = await fetch("/api/msgf/tenant/provider-keys", {
        method: "POST",
        headers,
        body: JSON.stringify({ provider, api_key: apiKey }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error || "Key save failed");
        return;
      }
      setKeyDrafts((prev) => ({ ...prev, [provider]: "" }));
      setMessage(`${provider} key saved`);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function saveEcoTrio() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (tenantId?.trim()) headers["x-msgf-tenant-id"] = tenantId.trim();
      const res = await fetch("/api/msgf/tenant/consensus-config", {
        method: "PUT",
        headers,
        body: JSON.stringify({
          profileId: "eco_trio",
          project_origin: projectOrigin,
          customEcoEndpoints: ecoSlots.map((slot) => ({
            providerId: slot.providerId,
            displayName: slot.displayName,
            baseURL: slot.baseURL,
            modelName: slot.modelName,
            maxTokens: slot.maxTokens,
            costPer1kInput: slot.costPer1kInput,
            costPer1kOutput: slot.costPer1kOutput,
            isEcoModel: true,
            providerKind: slot.providerKind,
            privateHostAllowed: Boolean(slot.privateHostAllowed),
            ...(slot.apiKey.trim() ? { apiKey: slot.apiKey.trim() } : {}),
          })),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error || "Eco Trio save failed");
        return;
      }
      setEcoSlots((prev) => prev.map((slot) => ({ ...slot, apiKey: "" })));
      setMessage("Saved: Eco Trio");
      await load();
    } finally {
      setSaving(false);
    }
  }

  function applyPreset(id: string) {
    if (id === "eco_trio") {
      void saveEcoTrio();
      return;
    }
    if (id === "solo_fast") {
      void save(defaultProvider, []);
      return;
    }
    const preset = PRESET_PROVIDERS[id];
    if (!preset) return;
    const keepDefault = preset.includes(defaultProvider) ? defaultProvider : preset[0]!;
    const partners = preset.filter((p) => p !== keepDefault);
    void save(keepDefault, partners);
  }

  if (error && !data) {
    return (
      <section
        className="glass-panel mt-6 scroll-mt-24 rounded-2xl border border-emerald-500/20 p-5"
        id="converge-preset"
      >
        <h3 className="text-sm font-semibold text-slate-100">CONVERGE models</h3>
        <p className="mt-2 text-sm text-slate-400">{error}</p>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="mt-6 rounded-2xl border border-slate-700/50 p-5" id="converge-preset">
        <p className="text-sm text-slate-400">Loading consensus presets…</p>
      </section>
    );
  }

  return (
    <section
      className="glass-panel mt-6 scroll-mt-24 rounded-2xl border border-emerald-500/20 p-5"
      id="converge-preset"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300/90">
        Select baseline and consensus models.
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <h3 className="text-lg font-semibold text-slate-50">Model Routing Presets</h3>
        <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-100">
          {activePresetBadge(data.config)}
        </span>
      </div>
      <div className="mt-3 grid gap-2 text-xs text-slate-300" aria-label="Provider key presence">
        {(
          [
            ["gemini", "Gemini", data.keys.gemini_configured],
            ["anthropic", "Anthropic", data.keys.anthropic_configured],
            ["xai", "xAI", data.keys.xai_configured],
          ] as const
        ).map(([id, label, configured]) => (
          <label key={id} className="flex flex-wrap items-center gap-2">
            <span className="w-24">{label}: {configured ? "key set" : "missing"}</span>
            <input
              type="password"
              autoComplete="off"
              value={keyDrafts[id]}
              placeholder="API key"
              aria-label={`${label} API key`}
              onChange={(event) => setKeyDrafts((prev) => ({ ...prev, [id]: event.target.value }))}
              className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
            />
            <button
              type="button"
              disabled={saving || !keyDrafts[id].trim()}
              onClick={() => void saveProviderKey(id)}
              className="rounded-full border border-slate-600 px-2 py-1 text-slate-200 disabled:opacity-50"
            >
              Save
            </button>
          </label>
        ))}
      </div>
      <div className="mt-4 space-y-2">
        <h4 className="text-sm font-semibold text-slate-200">Eco Trio</h4>
        {ecoSlots.map((slot, index) => (
          <div key={slot.providerId} className="grid gap-1 rounded-xl border border-slate-700/80 p-2">
            <span className="text-xs text-slate-300">
              {slot.displayName}
              {slot.apiKeyConfigured ? " · key set" : ""}
            </span>
            <input
              value={slot.baseURL}
              placeholder="https://ollama.tenant.com/v1"
              title={customEndpointTooltip()}
              aria-label={`${slot.displayName} base URL`}
              onChange={(event) =>
                setEcoSlots((prev) =>
                  prev.map((row, rowIndex) =>
                    rowIndex === index ? { ...row, baseURL: event.target.value } : row
                  )
                )
              }
              className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
            />
            <input
              value={slot.modelName}
              aria-label={`${slot.displayName} model`}
              onChange={(event) =>
                setEcoSlots((prev) =>
                  prev.map((row, rowIndex) =>
                    rowIndex === index ? { ...row, modelName: event.target.value } : row
                  )
                )
              }
              className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
            />
            <input
              type="password"
              autoComplete="off"
              value={slot.apiKey}
              placeholder="Optional API key"
              aria-label={`${slot.displayName} API key`}
              onChange={(event) =>
                setEcoSlots((prev) =>
                  prev.map((row, rowIndex) =>
                    rowIndex === index ? { ...row, apiKey: event.target.value } : row
                  )
                )
              }
              className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
            />
            <label className="flex items-center gap-2 text-[11px] text-slate-400">
              <input
                type="checkbox"
                checked={Boolean(slot.privateHostAllowed)}
                onChange={(event) =>
                  setEcoSlots((prev) =>
                    prev.map((row, rowIndex) =>
                      rowIndex === index ? { ...row, privateHostAllowed: event.target.checked } : row
                    )
                  )
                }
              />
              VPC endpoint
              <select
                aria-label={`${slot.displayName} protocol`}
                value={slot.providerKind}
                onChange={(event) =>
                  setEcoSlots((prev) =>
                    prev.map((row, rowIndex) =>
                      rowIndex === index
                        ? {
                            ...row,
                            providerKind:
                              event.target.value === CUSTOM_ANTHROPIC
                                ? CUSTOM_ANTHROPIC
                                : CUSTOM_OPENAI_COMPATIBLE,
                          }
                        : row
                    )
                  )
                }
                className="rounded border border-slate-700 bg-slate-950 px-1 py-0.5 text-slate-200"
              >
                <option value={CUSTOM_OPENAI_COMPATIBLE}>OpenAI-compatible</option>
                <option value={CUSTOM_ANTHROPIC}>Anthropic-compatible</option>
              </select>
            </label>
          </div>
        ))}
        <button
          type="button"
          disabled={saving}
          onClick={() => void saveEcoTrio()}
          className="rounded-full border border-emerald-500/40 px-3 py-1 text-xs text-emerald-100 disabled:opacity-50"
        >
          Save Eco Trio
        </button>
      </div>

      <h4 className="mt-5 text-sm font-semibold text-slate-200">Default AI</h4>
      <div role="radiogroup" aria-label="Default AI provider" className="mt-2 flex flex-wrap gap-2">
        {PROVIDERS.map((p) => {
          const selected = defaultProvider === p.id;
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={saving}
              onClick={() => void save(p.id, dualPartners.filter((x) => x !== p.id))}
              className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                selected
                  ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-50"
                  : "border-slate-600/60 bg-slate-950/40 text-slate-200 hover:border-emerald-500/40"
              } ${saving ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
            >
              <span className="font-medium">{p.label}</span>
              <span className="ml-1 text-xs text-slate-400">{p.hint}</span>
              {selected ? " ✓" : ""}
              {!keyConfigured(data.keys, p.id) ? (
                <span className="ml-1 text-[11px] text-amber-300/80">no key</span>
              ) : null}
            </button>
          );
        })}
      </div>

      <h4 className="mt-5 text-sm font-semibold text-slate-200">Dual pair (optional)</h4>
      <ul className="mt-2 grid max-w-md gap-2">
        {PROVIDERS.filter((p) => p.id !== defaultProvider).map((p) => {
          const checked = dualPartners.includes(p.id);
          const wouldBeTri = !checked && dualPartners.length >= 1;
          const triLocked = wouldBeTri && !data.tri_entitlement_enabled;
          return (
            <li key={p.id}>
              <label
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm ${
                  checked
                    ? "border-cyan-400/50 bg-cyan-500/10 text-cyan-50"
                    : "border-slate-600/60 bg-slate-950/40 text-slate-200"
                } ${saving || triLocked ? "opacity-60" : ""}`}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-cyan-400"
                  checked={checked}
                  disabled={saving || triLocked}
                  onChange={() => {
                    const next = checked
                      ? dualPartners.filter((x) => x !== p.id)
                      : [...dualPartners, p.id];
                    void save(defaultProvider, next);
                  }}
                />
                <span>
                  {p.label}
                  <span className="ml-1 text-xs text-slate-400">{p.hint}</span>
                  {triLocked ? " — enable tenant TRI for a third model" : ""}
                  {!keyConfigured(data.keys, p.id) ? (
                    <span className="ml-1 text-[11px] text-amber-300/80">no key</span>
                  ) : null}
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      <h4 className="mt-5 text-sm font-semibold text-slate-200">Shortcuts</h4>
      <ul role="radiogroup" aria-label="CONVERGE presets" className="mt-2 grid gap-2">
        {(
          [
            "solo_fast",
            "balanced_dual",
            "bias_mitigated_dual",
            "gemini_grok_dual",
            "tri_tribunal",
            "eco_trio",
          ] as const
        ).map((id) => {
          const locked = id === "tri_tribunal" && !data.tri_entitlement_enabled;
          const selected =
            id === "eco_trio" ? data.config.profileId === "eco_trio" : currentProfile === id;
          return (
            <li key={id}>
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={saving || locked}
                onClick={() => applyPreset(id)}
                className={`w-full max-w-md rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                  selected
                    ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-50"
                    : "border-slate-600/60 bg-slate-950/40 text-slate-200 hover:border-emerald-500/40"
                } ${saving || locked ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
              >
                {PRESET_LABELS[id]}
                {locked ? " — enable tenant TRI entitlement" : ""}
                {selected ? " ✓" : ""}
              </button>
            </li>
          );
        })}
      </ul>
      {message ? <p className="mt-3 text-sm text-emerald-300/90">{message}</p> : null}
      {error ? <p className="mt-2 text-sm text-rose-300">{error}</p> : null}
    </section>
  );
}
