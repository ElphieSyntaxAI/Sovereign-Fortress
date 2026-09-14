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
 * Distribution Build ID: MSGF-c122f849-20260911T160051Z-internal
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
 * Distribution Build ID: MSGF-c122f849-20260911T155844Z-internal
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
 * Distribution Build ID: MSGF-c122f849-20260911T154800Z-internal
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
 * Distribution Build ID: MSGF-c122f849-20260812T073711Z-internal
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
 * Distribution Build ID: MSGF-c122f849-20260812T072718Z-internal
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
 * Distribution Build ID: MSGF-c122f849-20260812T071103Z-internal
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
 * Distribution Build ID: MSGF-c122f849-20260812T065535Z-internal
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
 * Distribution Build ID: MSGF-1b90a4ac-20260802T111608Z-internal
 */
import { useEffect, useState } from "react";

type ConsensusConfig = {
  mode: string;
  providers: string[];
  strictness: string;
  profileId?: string;
};

type ApiPayload = {
  config: ConsensusConfig;
  tri_entitlement_enabled: boolean;
  keys: {
    gemini_configured: boolean;
    anthropic_configured: boolean;
    xai_configured: boolean;
  };
  presets: Array<{ profileId: string; mode?: string; providers?: string[] }>;
};

const PRESET_LABELS: Record<string, string> = {
  balanced_dual: "Balanced Dual (Claude + Gemini)",
  bias_mitigated_dual: "Bias-Mitigated Dual (Claude + Grok)",
  gemini_grok_dual: "Gemini + Grok Dual",
  tri_tribunal: "Tri-Model Tribunal (premium)",
  custom_byok: "Custom BYOK (2–3 keys)",
};

type Props = {
  tenantId?: string | null;
};

export function ConsensusPresetPanel({ tenantId }: Props) {
  const [data, setData] = useState<ApiPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  async function selectPreset(profileId: string) {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (tenantId?.trim()) headers["x-msgf-tenant-id"] = tenantId.trim();
      const body: Record<string, unknown> = { profileId };
      if (profileId === "custom_byok" && data?.keys) {
        const providers: string[] = [];
        if (data.keys.anthropic_configured) providers.push("anthropic");
        if (data.keys.gemini_configured) providers.push("google");
        if (data.keys.xai_configured) providers.push("xai");
        if (providers.length < 2) {
          setError("Custom BYOK needs at least two provider keys configured.");
          return;
        }
        // Without tenant TRI entitlement, cap custom at dual.
        body.providers =
          providers.length === 3 && !data.tri_entitlement_enabled
            ? providers.slice(0, 2)
            : providers;
      }
      const res = await fetch("/api/msgf/tenant/consensus-config", {
        method: "PUT",
        headers,
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; config?: ConsensusConfig };
      if (!res.ok) {
        setError(json.error || "Save failed");
        return;
      }
      setMessage(`Saved: ${PRESET_LABELS[profileId] ?? profileId}`);
      await load();
    } finally {
      setSaving(false);
    }
  }

  if (error && !data) {
    return (
      <section
        className="glass-panel mt-6 scroll-mt-24 rounded-2xl border border-emerald-500/20 p-5"
        id="converge-preset"
      >
        <h3 className="text-sm font-semibold text-slate-100">CONVERGE model preset</h3>
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

  const current = data.config.profileId ?? "balanced_dual";
  const keyCount =
    Number(data.keys.anthropic_configured) +
    Number(data.keys.gemini_configured) +
    Number(data.keys.xai_configured);

  return (
    <section
      className="glass-panel mt-6 scroll-mt-24 rounded-2xl border border-emerald-500/20 p-5"
      id="converge-preset"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300/90">
        Small Brain verification
      </p>
      <h3 className="mt-1 text-lg font-semibold text-slate-50">CONVERGE model preset</h3>
      <p className="mt-2 max-w-xl text-sm text-slate-400">
        Tenant verification pairs. Prompt optimize stays SOLO_FAST. Big Brain uses TRI majority
        (Claude + Gemini + Grok) when drift is high — humans notify only above the high-drift
        threshold.
      </p>
      <div
        className="mt-3 flex flex-wrap gap-3 text-xs text-slate-400"
        aria-label="Provider key presence"
      >
        <span>Anthropic: {data.keys.anthropic_configured ? "key set" : "missing"}</span>
        <span>Google: {data.keys.gemini_configured ? "key set" : "missing"}</span>
        <span>xAI: {data.keys.xai_configured ? "key set" : "missing"}</span>
      </div>
      <ul role="radiogroup" aria-label="CONVERGE presets" className="mt-4 grid gap-2">
        {(
          [
            "balanced_dual",
            "bias_mitigated_dual",
            "gemini_grok_dual",
            "tri_tribunal",
            "custom_byok",
          ] as const
        ).map((id) => {
          const locked = id === "tri_tribunal" && !data.tri_entitlement_enabled;
          const customBlocked = id === "custom_byok" && keyCount < 2;
          const disabled = saving || locked || customBlocked;
          const selected = current === id;
          return (
            <li key={id}>
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={disabled}
                onClick={() => void selectPreset(id)}
                className={`w-full max-w-md rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                  selected
                    ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-50"
                    : "border-slate-600/60 bg-slate-950/40 text-slate-200 hover:border-emerald-500/40"
                } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
              >
                {PRESET_LABELS[id]}
                {locked ? " — enable tenant TRI entitlement" : ""}
                {customBlocked ? " — configure ≥2 provider keys" : ""}
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
