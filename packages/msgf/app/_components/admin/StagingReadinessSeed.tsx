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
import { useCallback, useEffect, useState } from "react";

type SeedStatus = {
  operatorReady?: boolean;
  operatorEmail?: string | null;
  buyerReady?: boolean;
  buyerEmail?: string | null;
  soloTenantReady?: boolean;
  soloLicenseReady?: boolean;
  authorLicenseReady?: boolean;
  stripeTestReady?: boolean;
  stripe_test_ready?: boolean;
  error?: string;
};

type SeedResult = {
  ok?: boolean;
  error?: string;
  operator_email?: string;
  buyer_email?: string;
  solo_license_minted?: boolean;
  author_license_minted?: boolean;
  solo_license_key?: string | null;
  author_license_key?: string | null;
  buyer_password?: string | null;
  note?: string;
};

function Row({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <span className={ok ? "text-emerald-300" : "text-amber-300"}>{ok ? "ready" : "needed"}</span>
    </li>
  );
}

export function StagingReadinessSeed() {
  const [status, setStatus] = useState<SeedStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SeedResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/msgf/admin/staging-seed");
    const json = (await res.json()) as SeedStatus & { ok?: boolean; error?: string };
    if (!res.ok) {
      setError(json.error || `HTTP ${res.status}`);
      return;
    }
    setStatus(json);
    setError(null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const run = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/msgf/admin/staging-seed", { method: "POST" });
      const json = (await res.json()) as SeedResult;
      if (!res.ok) {
        setError(json.error || `HTTP ${res.status}`);
        return;
      }
      setResult(json);
      await load();
    } finally {
      setBusy(false);
    }
  }, [load]);

  const stripeOk = Boolean(status?.stripeTestReady ?? status?.stripe_test_ready);

  return (
    <section className="glass-panel space-y-4 rounded-2xl border border-cyan-500/25 p-5 text-sm text-slate-300">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-cyan-100">Staging seed</h2>
          <p className="mt-1 max-w-2xl text-slate-400">
            One staging tenant for product-readiness: operator admin, Checkout buyer, Pulse license,
            and Author pulse license. Staging only — this panel is hidden in production.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void run()}
          disabled={busy}
          className="rounded-full border border-cyan-500/40 bg-cyan-500/15 px-4 py-2 text-sm font-medium text-cyan-100 hover:bg-cyan-500/25 disabled:opacity-60"
        >
          {busy ? "Seeding…" : "Seed staging tenant"}
        </button>
      </div>

      {error ? <p className="text-rose-300">{error}</p> : null}

      <ul className="space-y-1.5 text-slate-300">
        <Row ok={Boolean(status?.operatorReady)} label={`Operator admin (${status?.operatorEmail || "—"})`} />
        <Row ok={Boolean(status?.buyerReady)} label={`Checkout buyer (${status?.buyerEmail || "—"})`} />
        <Row ok={Boolean(status?.soloTenantReady)} label="Pulse tenant staging_readiness (pledge + brain)" />
        <Row ok={Boolean(status?.soloLicenseReady)} label="MSGF contract license" />
        <Row ok={Boolean(status?.authorLicenseReady)} label="Author pulse license" />
        <Row ok={stripeOk} label="Stripe test prices ($29 / $49 / $199 monthly + yearly)" />
      </ul>

      {result?.solo_license_key || result?.author_license_key || result?.buyer_password ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-50">
          <p className="font-medium">Newly minted secrets — copy now</p>
          {result.solo_license_key ? (
            <p className="mt-2 break-all">
              MSGF_CONTRACT_LICENSE_KEY={result.solo_license_key}
            </p>
          ) : null}
          {result.author_license_key ? (
            <p className="mt-2 break-all">
              MSGF_AUTHOR_PULSE_LICENSE_KEY={result.author_license_key}
            </p>
          ) : null}
          {result.buyer_password ? (
            <p className="mt-2">
              Buyer {result.buyer_email} password: {result.buyer_password}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2">
        <a className="text-cyan-300 hover:underline" href="/admin/sign-in?next=/admin/portal">
          Operator sign-in
        </a>
        <a className="text-cyan-300 hover:underline" href="/pricing">
          Pricing / Checkout
        </a>
        <a className="text-cyan-300 hover:underline" href="/dashboard">
          User dashboard
        </a>
        <a className="text-cyan-300 hover:underline" href="/admin/ops#heal-queue">
          Heal queue
        </a>
        <a className="text-cyan-300 hover:underline" href="/admin/dashboard#token-savings">
          Token savings
        </a>
        <a
          className="text-cyan-300 hover:underline"
          href="https://staging.authorecosystem.elphiesyntax.com"
          rel="noreferrer"
        >
          Author client
        </a>
      </div>
    </section>
  );
}
