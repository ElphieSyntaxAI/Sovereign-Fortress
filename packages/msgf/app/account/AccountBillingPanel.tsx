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
import { useCallback, useEffect, useState } from "react";

type Card = {
  id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  is_default: boolean;
};

type Invoice = {
  id: string;
  number: string | null;
  status: string | null;
  amount_due: number;
  currency: string;
  created: number;
  hosted_invoice_url: string | null;
};

type ReportRow = {
  period_key: string;
  period_label: string;
  period_kind: string;
  tokens_saved_proven: number;
};

type Snapshot = {
  ok: boolean;
  error?: string;
  customer_linked?: boolean;
  card_limit?: number;
  cards?: Card[];
  invoices?: Invoice[];
  subscription?: {
    status: string;
    cancel_at_period_end: boolean;
    current_period_end: number | null;
    plan_label: string | null;
  } | null;
  reports?: ReportRow[];
  tenant_id?: string;
};

async function postAction(body: Record<string, unknown>) {
  const res = await fetch("/api/billing/account", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await res.json()) as { ok?: boolean; error?: string; url?: string; checkout?: boolean; current_period_end?: number };
}

export function AccountBillingPanel({ email, status }: { email: string; status: string }) {
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<"pro_individual" | "startup_team" | "enterprise">("pro_individual");
  const [interval, setInterval] = useState<"month" | "year">("month");

  const load = useCallback(async () => {
    const res = await fetch("/api/billing/account", { cache: "no-store" });
    const json = (await res.json()) as Snapshot;
    if (!res.ok || !json.ok) setError(json.error ?? "Billing unavailable.");
    else setData(json);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const json = await postAction(body);
      if (json.url) {
        window.location.assign(json.url);
        return;
      }
      if (json.checkout) {
        const checkout = await fetch("/api/billing/checkout", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ plan, interval }),
        });
        const session = (await checkout.json()) as { url?: string; error?: string };
        if (session.url) window.location.assign(session.url);
        else setError(session.error ?? "Checkout unavailable.");
        return;
      }
      if (!json.ok) setError(json.error ?? "Request failed.");
      else await load();
    } finally {
      setBusy(false);
    }
  }

  const cards = data?.cards ?? [];
  const atLimit = cards.length >= (data?.card_limit ?? 3);
  const ends = data?.subscription?.current_period_end
    ? new Date(data.subscription.current_period_end * 1000).toLocaleDateString()
    : null;

  return (
    <div className="space-y-6">
      <section className="glass-panel space-y-3 rounded-2xl border border-slate-600/30 p-5">
        <h2 className="text-lg font-semibold text-slate-50">Profile</h2>
        <p className="text-sm text-slate-300">{email}</p>
        <p className="text-sm text-slate-400">Status: {data?.subscription?.status ?? status}</p>
        {data?.subscription?.plan_label ? (
          <p className="text-sm text-slate-300">Plan: {data.subscription.plan_label}</p>
        ) : null}
        {data?.subscription?.cancel_at_period_end && ends ? (
          <p className="text-sm text-amber-200">Access stops on {ends}.</p>
        ) : null}
      </section>

      <section className="glass-panel space-y-3 rounded-2xl border border-slate-600/30 p-5">
        <h2 className="text-lg font-semibold text-slate-50">Cards</h2>
        <p className="text-xs text-slate-500">Up to 3 cards. Numbers stay with Stripe.</p>
        {cards.length === 0 ? <p className="text-sm text-slate-400">No card saved.</p> : null}
        <ul className="space-y-2">
          {cards.map((card) => (
            <li key={card.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-slate-100">
                {card.brand} ···· {card.last4}
                {card.is_default ? " · default" : ""}
              </span>
              <span className="flex gap-2">
                {!card.is_default ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void run({ action: "default", paymentMethodId: card.id })}
                    className="text-emerald-300 hover:underline"
                  >
                    Make default
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void run({ action: "detach", paymentMethodId: card.id })}
                  className="text-rose-300 hover:underline"
                >
                  Remove
                </button>
              </span>
            </li>
          ))}
        </ul>
        <button
          type="button"
          disabled={busy || atLimit || !data?.customer_linked}
          onClick={() => void run({ action: "add_card" })}
          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {atLimit ? "Three cards saved" : "Add card"}
        </button>
      </section>

      <section className="glass-panel space-y-3 rounded-2xl border border-slate-600/30 p-5">
        <h2 className="text-lg font-semibold text-slate-50">Invoices</h2>
        {data?.invoices?.length ? (
          <ul className="space-y-2 text-sm">
            {data.invoices.map((inv) => (
              <li key={inv.id} className="flex flex-wrap justify-between gap-2 text-slate-300">
                <span>
                  {inv.number ?? inv.id} · {inv.status} · {(inv.amount_due / 100).toFixed(2)}{" "}
                  {inv.currency.toUpperCase()}
                </span>
                {inv.hosted_invoice_url ? (
                  <a href={inv.hosted_invoice_url} className="text-emerald-300 hover:underline">
                    View
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-400">No invoices yet.</p>
        )}
      </section>

      <section className="glass-panel space-y-3 rounded-2xl border border-slate-600/30 p-5">
        <h2 className="text-lg font-semibold text-slate-50">Membership</h2>
        <div className="flex flex-wrap gap-2">
          <select
            value={plan}
            onChange={(e) => setPlan(e.target.value as typeof plan)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          >
            <option value="pro_individual">Pro</option>
            <option value="startup_team">Startup</option>
            <option value="enterprise">Enterprise</option>
          </select>
          <select
            value={interval}
            onChange={(e) => setInterval(e.target.value as typeof interval)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          >
            <option value="month">Monthly</option>
            <option value="year">Yearly</option>
          </select>
          <button
            type="button"
            disabled={busy}
            onClick={() => void run({ action: "change_plan", plan, interval })}
            className="rounded-xl border border-emerald-500/40 px-4 py-2 text-sm text-emerald-100"
          >
            Change plan
          </button>
          <button
            type="button"
            disabled={busy || data?.subscription?.cancel_at_period_end}
            onClick={() => void run({ action: "cancel" })}
            className="rounded-xl border border-rose-500/40 px-4 py-2 text-sm text-rose-100"
          >
            Cancel at period end
          </button>
        </div>
      </section>

      <section className="glass-panel space-y-3 rounded-2xl border border-slate-600/30 p-5">
        <h2 className="text-lg font-semibold text-slate-50">Exported reports</h2>
        {data?.reports?.length ? (
          <ul className="space-y-2 text-sm">
            {data.reports.map((row) => (
              <li key={`${row.period_kind}-${row.period_key}`} className="flex justify-between gap-2">
                <span className="text-slate-300">
                  {row.period_label} · {row.period_kind} · {row.tokens_saved_proven.toLocaleString()} proven
                </span>
                <a
                  href={`/api/msgf/dashboard/period-reports/pdf?tenant_id=${encodeURIComponent(data.tenant_id ?? "")}&scope=${row.period_kind === "weekly" ? "weekly" : "monthly"}`}
                  className="text-emerald-300 hover:underline"
                >
                  Download PDF
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-400">No saved reports yet.</p>
        )}
      </section>

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
    </div>
  );
}
