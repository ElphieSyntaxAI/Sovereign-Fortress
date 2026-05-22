"use client";

import { useEffect, useState } from "react";

import type { SavingsFeaturesSummary } from "@/lib/services/savings-features-stats";

type Props = {
  tenantId: string;
  /** Use admin API when on /admin/dashboard (operator RBAC). */
  operatorView?: boolean;
};

export function TokenSavingsFeaturesPanel({ tenantId, operatorView = false }: Props) {
  const [summary, setSummary] = useState<SavingsFeaturesSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId.trim()) return;
    setError(null);
    const path = operatorView
      ? `/api/msgf/admin/dashboard/savings-features?tenant_id=${encodeURIComponent(tenantId)}`
      : `/api/msgf/dashboard/savings-features?tenant_id=${encodeURIComponent(tenantId)}`;

    fetch(path, { credentials: "include", cache: "no-store" })
      .then(async (res) => {
        const json = (await res.json()) as {
          ok?: boolean;
          summary?: SavingsFeaturesSummary;
          error?: string;
        };
        if (!res.ok || !json.ok || !json.summary) {
          throw new Error(json.error ?? `Savings features failed (${res.status})`);
        }
        setSummary(json.summary);
      })
      .catch((e) => {
        setSummary(null);
        setError(e instanceof Error ? e.message : "Failed to load savings features.");
      });
  }, [tenantId, operatorView]);

  if (error) {
    return (
      <p className="text-xs text-slate-500" id="token-savings">
        Token savings features unavailable ({error}). Configure Redis for live counters.
      </p>
    );
  }

  if (!summary) return null;

  const { counters, pulse_routing, catalog } = summary;
  const hasActivity =
    pulse_routing.total_pulses > 0 ||
    counters.converge_cache_hits > 0 ||
    counters.dev_events > 0 ||
    counters.pulse_idempotency_replays > 0 ||
    counters.ingest_hash_files_skipped > 0;

  return (
    <section
      id="token-savings"
      className="glass-panel scroll-mt-24 rounded-2xl border border-amber-500/25 p-5"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-300/90">
        Token savings layer
      </p>
      <h2 className="mt-1 text-lg font-semibold text-slate-50">
        Efficiency features {operatorView ? "(operator)" : ""}
      </h2>
      <p className="mt-2 text-sm text-slate-400">
        24h counters from Redis. Estimates are model-based — not Stripe billing truth.
        {!hasActivity ? " Activity appears after Pulse, ingest, IDE dev-events, or CONVERGE runs." : null}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Metric
          label="CONVERGE cache hits"
          value={counters.converge_cache_hits}
          hint={`${counters.converge_cache_tokens_saved.toLocaleString()} tokens saved (est.)`}
          disabled={!catalog.find((c) => c.id === "converge_cache")?.enabled}
        />
        <Metric
          label="IDE dev-events"
          value={counters.dev_events}
          hint={`${counters.dev_event_vault_hits} vault hits · ${counters.dev_event_tokens_saved.toLocaleString()} tokens saved`}
        />
        <Metric
          label="Pulse idempotency replays"
          value={counters.pulse_idempotency_replays}
          hint="Duplicate Idempotency-Key within TTL"
          disabled={!catalog.find((c) => c.id === "pulse_idempotency")?.enabled}
        />
        <Metric
          label="Ingest files skipped (hash)"
          value={counters.ingest_hash_files_skipped}
          hint="Unchanged content SHA"
          disabled={!catalog.find((c) => c.id === "ingest_hash")?.enabled}
        />
        <Metric
          label="Credit reservations"
          value={counters.credit_reservations}
          hint={`${counters.credit_reservation_denied} denied (402)`}
          disabled={!catalog.find((c) => c.id === "credit_reservation")?.enabled}
        />
        <Metric
          label="Dev-session pulses"
          value={counters.dev_session_pulses}
          hint="x-msgf-dev-session or IDE pulse"
        />
      </div>

      {pulse_routing.total_pulses > 0 ? (
        <p className="mt-4 text-sm text-slate-300">
          Pulse routing: <strong className="text-emerald-300">{pulse_routing.local_or_bypass_pct}%</strong>{" "}
          local/bypass · {pulse_routing.estimated_tokens_saved_vs_naive.toLocaleString()} tokens saved vs
          naive dual-cloud (24h).
        </p>
      ) : null}

      <details className="mt-4 rounded-xl border border-slate-700/60 bg-slate-950/50 p-3">
        <summary className="cursor-pointer text-sm font-medium text-slate-200">
          Feature catalog {operatorView ? "— admin visibility" : ""}
        </summary>
        <ul className="mt-3 space-y-2 text-xs text-slate-400">
          {catalog.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-baseline gap-2">
              <span
                className={
                  entry.enabled
                    ? "rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-300"
                    : "rounded bg-slate-700/50 px-1.5 py-0.5 text-slate-500"
                }
              >
                {entry.enabled ? "on" : "off"}
              </span>
              <span className="font-medium text-slate-200">{entry.label}</span>
              <span className="text-slate-500">— {entry.description}</span>
              <code className="text-[10px] text-violet-300/90">{entry.api_or_env}</code>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}

function Metric({
  label,
  value,
  hint,
  disabled,
}: {
  label: string;
  value: number;
  hint: string;
  disabled?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        disabled ? "border-slate-800 opacity-50" : "border-amber-500/20 bg-slate-950/60"
      }`}
    >
      <p className="text-[11px] uppercase tracking-wider text-amber-400/80">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-50">{value.toLocaleString()}</p>
      <p className="mt-1 text-[10px] text-slate-500">{hint}</p>
    </div>
  );
}
