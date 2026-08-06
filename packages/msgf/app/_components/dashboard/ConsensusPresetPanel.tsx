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
        body.providers = providers;
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
      <section className="msgf-consensus-preset" style={{ marginTop: "1.5rem" }}>
        <h3 style={{ fontSize: "1.05rem", marginBottom: "0.35rem" }}>CONVERGE model preset</h3>
        <p style={{ color: "var(--msgf-muted, #666)", fontSize: "0.9rem" }}>{error}</p>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="msgf-consensus-preset" style={{ marginTop: "1.5rem" }}>
        <p style={{ fontSize: "0.9rem" }}>Loading consensus presets…</p>
      </section>
    );
  }

  const current = data.config.profileId ?? "balanced_dual";

  return (
    <section className="msgf-consensus-preset" style={{ marginTop: "1.5rem" }}>
      <h3 style={{ fontSize: "1.05rem", marginBottom: "0.35rem" }}>CONVERGE model preset</h3>
      <p style={{ color: "var(--msgf-muted, #666)", fontSize: "0.85rem", maxWidth: "40rem" }}>
        Small Brain verification pairs. Prompt optimize stays SOLO_FAST. Big Brain uses TRI (Claude +
        Gemini + Grok) when platform drift is high — humans notify only above the high-drift threshold.
      </p>
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", margin: "0.75rem 0", fontSize: "0.85rem" }}>
        <span>Anthropic: {data.keys.anthropic_configured ? "key set" : "missing"}</span>
        <span>Google: {data.keys.gemini_configured ? "key set" : "missing"}</span>
        <span>xAI: {data.keys.xai_configured ? "key set" : "missing"}</span>
      </div>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.5rem" }}>
        {(["balanced_dual", "bias_mitigated_dual", "gemini_grok_dual", "tri_tribunal", "custom_byok"] as const).map(
          (id) => {
            const locked =
              id === "tri_tribunal" && !data.tri_entitlement_enabled;
            return (
              <li key={id}>
                <button
                  type="button"
                  disabled={saving || locked}
                  onClick={() => void selectPreset(id)}
                  style={{
                    textAlign: "left",
                    width: "100%",
                    maxWidth: "28rem",
                    padding: "0.55rem 0.75rem",
                    border:
                      current === id
                        ? "2px solid var(--msgf-accent, #1a5f4a)"
                        : "1px solid var(--msgf-border, #ccc)",
                    background: "transparent",
                    cursor: locked ? "not-allowed" : "pointer",
                    opacity: locked ? 0.5 : 1,
                  }}
                >
                  {PRESET_LABELS[id]}
                  {locked ? " — enable tenant TRI entitlement" : ""}
                  {current === id ? " ✓" : ""}
                </button>
              </li>
            );
          }
        )}
      </ul>
      {message ? (
        <p style={{ fontSize: "0.85rem", color: "var(--msgf-accent, #1a5f4a)" }}>{message}</p>
      ) : null}
      {error ? (
        <p style={{ fontSize: "0.85rem", color: "crimson" }}>{error}</p>
      ) : null}
    </section>
  );
}
