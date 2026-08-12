"use client";

/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * Distribution Build ID: MSGF-1b90a4ac-20260802T111608Z-internal
 */
/**
 * Free 24h Shadow Proxy trial — signup + live projected savings dashboard.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

const MSGF_HOST =
  typeof window !== "undefined"
    ? window.location.origin
    : "https://elphiesgatedai.elphiesyntax.com";

const OPENAI_SNIPPET = `import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: "${MSGF_HOST}/api/v1",
  defaultHeaders: {
    "x-msgf-mode": "shadow",
    "x-msgf-key": process.env.MSGF_TRIAL_KEY!,
  },
});`;

type TrialSummary = {
  evaluation_count: number;
  actual_cost_usd: number;
  projected_savings_usd: number;
  expired: boolean;
  expires_at: string;
  started_at: string;
  email: string;
  report_sent: boolean;
};

type StartResponse =
  | {
      ok: true;
      reused: false;
      msgf_key: string;
      status_token: string;
      status_url: string;
      expires_at: string;
      email_sent: boolean;
    }
  | {
      ok: true;
      reused: true;
      message: string;
      expires_at: string;
    }
  | { ok: false; error: string };

function formatCountdown(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "Trial ended";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m remaining`;
}

export function ShadowTrialPanel({ statusToken }: { statusToken?: string | null }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState<StartResponse | null>(null);
  const [summary, setSummary] = useState<TrialSummary | null>(null);
  const [recent, setRecent] = useState<Record<string, unknown>[]>([]);
  const [token, setToken] = useState(statusToken?.trim() || "");

  const activeKey =
    started && "msgf_key" in started && started.ok && !started.reused
      ? started.msgf_key
      : null;

  const loadStatus = useCallback(async (t: string) => {
    if (!t.trim()) return;
    try {
      const res = await fetch(
        `/api/shadow-trial/status?t=${encodeURIComponent(t.trim())}`,
        { cache: "no-store" }
      );
      const json = (await res.json()) as {
        ok?: boolean;
        summary?: TrialSummary;
        recent?: Record<string, unknown>[];
        error?: string;
      };
      if (!res.ok || !json.ok || !json.summary) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      setSummary(json.summary);
      setRecent(json.recent ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load trial status.");
    }
  }, []);

  useEffect(() => {
    if (!token.trim()) return;
    void loadStatus(token);
    const id = window.setInterval(() => void loadStatus(token), 30_000);
    return () => window.clearInterval(id);
  }, [token, loadStatus]);

  const snippet = useMemo(() => {
    if (!activeKey) return OPENAI_SNIPPET.replace("process.env.MSGF_TRIAL_KEY!", "YOUR_MSGF_KEY");
    return OPENAI_SNIPPET.replace("process.env.MSGF_TRIAL_KEY!", `"${activeKey}"`);
  }, [activeKey]);

  const onStart = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setStarted(null);
    try {
      const res = await fetch("/api/shadow-trial/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), name: name.trim() || null }),
      });
      const json = (await res.json()) as StartResponse;
      if (!res.ok || !json.ok) {
        throw new Error("error" in json ? json.error : `HTTP ${res.status}`);
      }
      setStarted(json);
      if ("status_token" in json && json.status_token) {
        setToken(json.status_token);
        window.history.replaceState(
          {},
          "",
          `/shadow-trial?t=${encodeURIComponent(json.status_token)}`
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start trial.");
    } finally {
      setLoading(false);
    }
  };

  const showDashboard = Boolean(token.trim() && summary);

  return (
    <div className="space-y-8">
      {!showDashboard ? (
        <section className="glass-panel glass-panel-emerald mx-auto max-w-lg rounded-3xl p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300/90">
            Free · 24 hours
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            Shadow Proxy trial
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            Point your OpenAI or Anthropic SDK at MSGF in shadow mode — zero latency
            pass-through, projected bill savings recorded live. We email your 24h report when
            the window closes.
          </p>

          <form onSubmit={(e) => void onStart(e)} className="mt-6 space-y-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-400">Email</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-700/80 bg-slate-950/60 px-4 py-2.5 text-sm text-slate-100 outline-none ring-emerald-500/30 focus:ring-2"
                placeholder="you@company.com"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-400">Name (optional)</span>
              <input
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-slate-700/80 bg-slate-950/60 px-4 py-2.5 text-sm text-slate-100 outline-none ring-emerald-500/30 focus:ring-2"
                placeholder="Jessica"
              />
            </label>
            {error ? (
              <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {error}
              </p>
            ) : null}
            {started?.ok && started.reused ? (
              <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                {started.message}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-gradient-to-r from-emerald-600 to-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:brightness-110 disabled:opacity-60"
            >
              {loading ? "Starting trial…" : "Start free 24h Shadow Proxy"}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-slate-500">
            Already have a key?{" "}
            <Link href="/sign-in" className="text-emerald-400/90 hover:underline">
              Sign in to MSGF
            </Link>
          </p>
        </section>
      ) : null}

      {started?.ok && !started.reused && activeKey ? (
        <section className="glass-panel rounded-2xl border border-emerald-500/25 p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300/90">
            Save this key — shown once
          </p>
          <code className="mt-3 block overflow-x-auto rounded-xl bg-slate-950/70 p-4 text-xs text-emerald-100">
            {activeKey}
          </code>
          <p className="mt-3 text-sm text-slate-400">
            {started.email_sent
              ? "We also emailed your key and live dashboard link."
              : "Copy your key now. Add RESEND_API_KEY on the server to email it automatically."}
          </p>
        </section>
      ) : null}

      {showDashboard && summary ? (
        <section className="space-y-6">
          <div className="glass-panel rounded-2xl border border-sky-500/25 bg-sky-950/20 p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300/90">
                  Live Shadow Proxy savings
                </p>
                <h2 className="mt-1 text-xl font-semibold text-slate-50">
                  {summary.expired ? "Trial complete" : "Trial active"}
                </h2>
                <p className="mt-1 text-sm text-slate-400">{summary.email}</p>
              </div>
              <span
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  summary.expired
                    ? "border-slate-600/50 bg-slate-800/50 text-slate-400"
                    : "border-emerald-500/35 bg-emerald-500/15 text-emerald-200"
                }`}
              >
                {summary.expired
                  ? summary.report_sent
                    ? "Report emailed"
                    : "Report pending"
                  : formatCountdown(summary.expires_at)}
              </span>
            </div>

            <dl className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                <dt className="text-[11px] uppercase tracking-wide text-slate-500">
                  Evaluations
                </dt>
                <dd className="mt-1 text-2xl font-semibold text-slate-100">
                  {summary.evaluation_count.toLocaleString()}
                </dd>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                <dt className="text-[11px] uppercase tracking-wide text-slate-500">
                  Pass-through $
                </dt>
                <dd className="mt-1 text-2xl font-semibold text-slate-100">
                  ${summary.actual_cost_usd.toFixed(4)}
                </dd>
              </div>
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                <dt className="text-[11px] uppercase tracking-wide text-emerald-200/80">
                  Projected savings $
                </dt>
                <dd className="mt-1 text-2xl font-semibold text-emerald-200">
                  ${summary.projected_savings_usd.toFixed(4)}
                </dd>
              </div>
            </dl>

            <p className="mt-4 text-xs text-slate-500">
              Projected ≠ proven eco. When the trial ends we email this summary to{" "}
              {summary.email}.
            </p>
          </div>

          <figure className="overflow-hidden rounded-2xl border border-emerald-500/20 bg-slate-950/55">
            <figcaption className="border-b border-emerald-500/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300/85">
              Quick start · OpenAI SDK
            </figcaption>
            <pre className="overflow-x-auto p-4 text-[11px] leading-relaxed text-slate-300 sm:text-xs">
              <code>{snippet}</code>
            </pre>
          </figure>

          {recent.length > 0 ? (
            <div className="rounded-2xl border border-slate-800/80 bg-slate-950/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Recent shadow evals
              </p>
              <ul className="mt-3 space-y-2 text-xs text-slate-400">
                {recent.slice(0, 8).map((row, i) => (
                  <li key={i} className="flex flex-wrap justify-between gap-2">
                    <span>
                      {String(row.model ?? "model")} · {String(row.endpoint ?? "endpoint")}
                    </span>
                    <span className="text-emerald-300/90">
                      ${Number(row.savings_potential_usd ?? 0).toFixed(4)} projected
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3 text-sm text-slate-500">
              No shadow evaluations yet — point traffic at{" "}
              <code className="text-slate-400">{MSGF_HOST}/api/v1</code> with your trial key.
            </p>
          )}
        </section>
      ) : null}

      <p className="text-center text-sm text-slate-500">
        <Link href="/" className="text-emerald-400/90 hover:underline">
          ← Back to MSGF home
        </Link>
        {" · "}
        <Link href="/getting-started#shadow-savings-how-to" className="text-violet-300 hover:underline">
          Shadow Proxy guide
        </Link>
      </p>
    </div>
  );
}
