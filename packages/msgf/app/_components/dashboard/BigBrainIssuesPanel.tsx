"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { BIG_BRAIN_ADMIN_SURFACES } from "@/lib/services/brain-routing-policy";
import type { SavingsFeaturesSummary } from "@/lib/services/savings-features-stats";
import type { HealQueueGetResponse } from "@/lib/schemas/heal-queue";

type Props = {
  tenantId: string;
};

export function BigBrainIssuesPanel({ tenantId }: Props) {
  const [savings, setSavings] = useState<SavingsFeaturesSummary | null>(null);
  const [healPending, setHealPending] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId.trim()) return;
    setError(null);

    Promise.all([
      fetch(
        `/api/msgf/admin/dashboard/savings-features?tenant_id=${encodeURIComponent(tenantId)}`,
        { credentials: "include", cache: "no-store" }
      ).then(async (res) => {
        const json = (await res.json()) as { ok?: boolean; summary?: SavingsFeaturesSummary };
        if (!res.ok || !json.ok || !json.summary) throw new Error("savings load failed");
        return json.summary;
      }),
      fetch(`/api/msgf/heal-queue?tenant_id=${encodeURIComponent(tenantId)}`, {
        credentials: "include",
        cache: "no-store",
      }).then(async (res) => {
        const json = (await res.json()) as HealQueueGetResponse & { ok?: boolean };
        if (!res.ok || !json.ok) throw new Error("heal-queue load failed");
        return json.big_brain_escalations_pending ?? json.human_arbitration_packages?.length ?? 0;
      }),
    ])
      .then(([summary, pending]) => {
        setSavings(summary);
        setHealPending(pending);
      })
      .catch((e) => {
        setSavings(null);
        setHealPending(0);
        setError(e instanceof Error ? e.message : "Failed to load Big Brain queue.");
      });
  }, [tenantId]);

  if (error) {
    return (
      <p className="text-xs text-slate-500" id="big-brain-issues">
        Big Brain operator queue unavailable ({error}).
      </p>
    );
  }

  const globalConverge = savings?.big_brain_global_converge_pulses ?? 0;
  const totalBigBrain = globalConverge + healPending;

  return (
    <section
      id="big-brain-issues"
      className="glass-panel scroll-mt-24 rounded-2xl border border-violet-500/30 p-5"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-300/90">
        Big Brain — operator queue
      </p>
      <h2 className="mt-1 text-lg font-semibold text-slate-50">Global issues (admin)</h2>
      <p className="mt-2 text-sm text-slate-400">
        Dual-model CONVERGE, human arbitration, and global DNA promotions are reviewed here — not on
        tenant dashboards. Tenants keep Small Brain heals and workspace-scoped Vault logic.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-violet-500/25 bg-slate-950/60 p-3">
          <p className="text-[11px] uppercase tracking-wider text-violet-400/80">
            Global CONVERGE pulses (24h)
          </p>
          <p className="mt-1 text-2xl font-semibold text-violet-100">{globalConverge}</p>
        </div>
        <div className="rounded-xl border border-violet-500/25 bg-slate-950/60 p-3">
          <p className="text-[11px] uppercase tracking-wider text-violet-400/80">
            Heal queue escalations
          </p>
          <p className="mt-1 text-2xl font-semibold text-violet-100">{healPending}</p>
        </div>
      </div>

      {totalBigBrain === 0 ? (
        <p className="mt-3 text-xs text-slate-500">No Big Brain escalations in this window.</p>
      ) : null}

      <ul className="mt-4 space-y-2 text-sm">
        {BIG_BRAIN_ADMIN_SURFACES.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="text-violet-300 hover:underline">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
