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
 * Distribution Build ID: MSGF-149f647f-20260728T230931Z-internal
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
 * Distribution Build ID: MSGF-c1a5d75-20260723T221428Z-internal
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
 * Distribution Build ID: MSGF-c1a5d75-20260723T221141Z-internal
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
 * Distribution Build ID: MSGF-c1a5d75-20260723T220451Z-internal
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
 * Distribution Build ID: MSGF-a7aa881-20260620T084430Z-internal
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
 * Distribution Build ID: MSGF-48a02b8-20260530T050749Z-internal
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
 * Distribution Build ID: MSGF-48a02b8-20260530T050211Z-internal
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
 * Distribution Build ID: MSGF-48a02b8-20260530T045550Z-internal
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
 * Distribution Build ID: MSGF-48a02b8-20260530T045125Z-internal
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
 * Distribution Build ID: MSGF-48a02b8-20260530T044603Z-internal
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
 * Distribution Build ID: MSGF-3a4c1de-20260529T200349Z-internal
 */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const CO2_LBS_PER_TREE_SEEDLING_10_YEARS = 48.5;

type EcoMetrics = {
  tokens_saved: number;
  grid_compute_prevented_kwh: number;
  co2e_offset_lbs: number;
  freshwater_conserved_gallons: number;
};

type MyEcoUsageResponse = {
  ok: true;
  user_total: { metrics: EcoMetrics };
};

function formatNum(n: number, digits = 0): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatBillions(tokens: number): string {
  return (tokens / 1_000_000_000).toFixed(2);
}

export function GovernanceEnvironmentalShelf() {
  const [metrics, setMetrics] = useState<EcoMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/msgf/eco/my-usage", { credentials: "include", cache: "no-store" });
      const json = (await res.json()) as MyEcoUsageResponse | { ok: false; error: string };
      if (!res.ok || !("ok" in json) || json.ok !== true) {
        throw new Error("error" in json ? json.error : `HTTP ${res.status}`);
      }
      setMetrics(json.user_total.metrics);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load environmental stats.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(id);
  }, [load]);

  const treeEquivalent = metrics
    ? metrics.co2e_offset_lbs / CO2_LBS_PER_TREE_SEEDLING_10_YEARS
    : 0;

  return (
    <section className="glass-panel rounded-2xl border border-emerald-500/20 p-5 sm:p-6">
      <div className="text-center sm:text-left">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-300/90">
          Your account · proven impact
        </p>
        <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-50 sm:text-2xl">
          Sustainable compute across your repositories
        </h2>
        <p className="mt-2 max-w-2xl text-xs text-slate-500">
          Private to this login — not the public marketing totals on the platform hub.
        </p>
      </div>

      {loading ? (
        <p className="mt-4 text-center text-sm text-slate-500">Loading environmental metrics…</p>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-100">
          {error}
        </p>
      ) : null}

      {metrics ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/10 p-4 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-cyan-200/80">
              Tokens saved
            </p>
            <p className="mt-2 text-2xl font-semibold text-cyan-50">
              {formatBillions(metrics.tokens_saved)}B
            </p>
            <p className="mt-1 text-xs text-cyan-200/70">Local sharding total</p>
          </div>
          <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-200/80">
              kWh prevented
            </p>
            <p className="mt-2 text-2xl font-semibold text-emerald-50">
              {formatNum(metrics.grid_compute_prevented_kwh, 2)}
            </p>
            <p className="mt-1 text-xs text-emerald-200/70">Grid compute avoided</p>
          </div>
          <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-200/80">
              Trees saved
            </p>
            <p className="mt-2 text-2xl font-semibold text-emerald-50">
              {formatNum(treeEquivalent, 1)}
            </p>
            <p className="mt-1 text-xs text-emerald-200/70">Seedling CO₂e equivalent</p>
          </div>
          <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-200/80">
              Freshwater cooling
            </p>
            <p className="mt-2 text-2xl font-semibold text-emerald-50">
              {formatNum(metrics.freshwater_conserved_gallons, 1)}
            </p>
            <p className="mt-1 text-xs text-emerald-200/70">Gallons conserved</p>
          </div>
        </div>
      ) : null}

      <p className="mt-4 text-center text-xs text-slate-500">
        <Link href="/workspace?tab=setup" className="text-cyan-300 hover:underline">
          Map projects
        </Link>{" "}
        to scope metrics · Auto-refresh 30s
      </p>
    </section>
  );
}
