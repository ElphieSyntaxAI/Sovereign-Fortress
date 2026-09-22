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
 * Distribution Build ID: MSGF-191e80fa-20260921T055901Z-internal
 */
/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * Distribution Build ID: MSGF-c122f849-20260911T161212Z-internal
 */

import { useCallback, useState } from "react";

export function AdminSiemIntegrationsPanel() {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [authSecret, setAuthSecret] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch("/api/msgf/admin/siem-integrations", {
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          webhook_url: webhookUrl.trim(),
          auth_secret: authSecret.trim() || null,
          enabled,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setStatus("Saved SIEM integration.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }, [webhookUrl, authSecret, enabled]);

  return (
    <section
      id="siem-integrations"
      className="glass-panel rounded-2xl border border-slate-600/40 p-5 sm:p-6"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
        Integrations
      </p>
      <h2 className="mt-1 text-xl font-semibold text-slate-100">SIEM &amp; Integrations</h2>
      <p className="mt-1 max-w-2xl text-sm text-slate-400">
        Stream audit hub and harm-flagged sessions as OpenTelemetry JSON. Failures never block
        product paths.
      </p>
      <div className="mt-4 space-y-2">
        <input
          value={webhookUrl}
          onChange={(e) => setWebhookUrl(e.target.value)}
          placeholder="Webhook URL (Splunk / Datadog / custom)"
          className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
        />
        <input
          value={authSecret}
          onChange={(e) => setAuthSecret(e.target.value)}
          placeholder="Authorization secret (optional)"
          type="password"
          className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
        />
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          Enabled
        </label>
        <button
          type="button"
          disabled={saving || !webhookUrl.trim()}
          onClick={() => void save()}
          className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {status ? <p className="text-sm text-emerald-300">{status}</p> : null}
        {error ? (
          <p className="text-sm text-rose-300" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
