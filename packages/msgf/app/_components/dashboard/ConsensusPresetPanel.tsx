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
 * Distribution Build ID: MSGF-c122f849-20260911T161212Z-internal
 */
import { useEffect, useMemo, useState } from "react";

type ConsensusProvider = "google" | "anthropic" | "xai";

type ConsensusConfig = {
  mode: string;
  providers: string[];
  strictness: string;
  profileId?: string;
  defaultProvider?: string;
};

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
  tri_tribunal: "Tri-Model Tribunal (premium)",
  custom_byok: "Custom pair",
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

function keyConfigured(keys: ApiPayload["keys"], id: ConsensusProvider): boolean {
  if (id === "google") return keys.gemini_configured;
  if (id === "anthropic") return keys.anthropic_configured;
  return keys.xai_configured;
}

type Props = {
  tenantId?: string | null;
};

export function ConsensusPresetPanel({ tenantId }: Props) {
  const [data, setData] = useState<ApiPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [defaultProvider, setDefaultProvider] = useState<ConsensusProvider>("google");
  const [dualPartners, setDualPartners] = useState<ConsensusProvider[]>([]);

  async function load() {
    setError(null);
    const headers: HeadersInit = {};
    if (tenantId?.trim()) headers["x-msgf-tenant-id"] = tenantId.trim();
    const res = await fetch("/api/msgf/tenant/consensus-config", { headers });
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
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

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

  function applyPreset(id: string) {
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
        Small Brain verification
      </p>
      <h3 className="mt-1 text-lg font-semibold text-slate-50">Default AI + dual pair</h3>
      <p className="mt-2 max-w-xl text-sm text-slate-400">
        Pick the default model for SOLO_FAST (prompt optimize, Heal Cheap, single-model
        verification). Then optionally add a second model for dual CONVERGE — or a third when
        tenant TRI is enabled. Big Brain still uses platform TRI when drift is high.
      </p>
      <div
        className="mt-3 flex flex-wrap gap-3 text-xs text-slate-400"
        aria-label="Provider key presence"
      >
        <span>Gemini: {data.keys.gemini_configured ? "key set" : "missing"}</span>
        <span>Claude: {data.keys.anthropic_configured ? "key set" : "missing"}</span>
        <span>Grok: {data.keys.xai_configured ? "key set" : "missing"}</span>
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
      <p className="mt-1 max-w-xl text-xs text-slate-500">
        Check a second provider to run dual verification. Leave both unchecked for SOLO_FAST.
      </p>
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
          ] as const
        ).map((id) => {
          const locked = id === "tri_tribunal" && !data.tri_entitlement_enabled;
          const selected = currentProfile === id;
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
