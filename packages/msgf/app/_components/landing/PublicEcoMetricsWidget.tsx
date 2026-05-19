"use client";

/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 */

import { useEffect, useMemo, useState } from "react";

import { calculateEcoSavings, type EcoMetrics } from "@/lib/utils/ecoCalculator";
import {
  buildEcoEquivalencyStatements,
  type EcoEquivalencyStatements,
} from "@/lib/utils/ecoEquivalencies";

type PublicEcoMetricsPayload = {
  ok: true;
  source: "live" | "mock";
  generated_at: string;
  metrics: EcoMetrics;
  equivalencies: EcoEquivalencyStatements;
};

type StatCardProps = {
  label: string;
  value: string;
  equivalent: string;
  tone: "water" | "carbon" | "energy";
};

const FALLBACK_METRICS = calculateEcoSavings(5_230_000);
const FALLBACK_PAYLOAD: PublicEcoMetricsPayload = {
  ok: true,
  source: "mock",
  generated_at: new Date(0).toISOString(),
  metrics: FALLBACK_METRICS,
  equivalencies: buildEcoEquivalencyStatements(FALLBACK_METRICS),
};

function formatMetric(value: number, unit: string): string {
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${unit}`;
}

function toneClasses(tone: StatCardProps["tone"]): string {
  if (tone === "water") return "border-cyan-400/25 bg-cyan-500/10 text-cyan-100";
  if (tone === "carbon") return "border-emerald-400/25 bg-emerald-500/10 text-emerald-100";
  return "border-amber-400/25 bg-amber-500/10 text-amber-100";
}

function StatCard({ label, value, equivalent, tone }: StatCardProps) {
  return (
    <article className={`rounded-2xl border p-5 ${toneClasses(tone)}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] opacity-75">
        {label}
      </p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-white">{value}</p>
      <p className="mt-3 text-sm leading-relaxed opacity-85">{equivalent}</p>
    </article>
  );
}

export function PublicEcoMetricsWidget() {
  const [payload, setPayload] = useState<PublicEcoMetricsPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function loadMetrics() {
      try {
        const res = await fetch("/api/public-eco-metrics", {
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error(`public eco metrics returned ${res.status}`);
        }
        const json = (await res.json()) as PublicEcoMetricsPayload;
        if (active && json.ok) {
          setPayload(json);
        }
      } catch {
        if (active) {
          setPayload(FALLBACK_PAYLOAD);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadMetrics();
    return () => {
      active = false;
    };
  }, []);

  const data = payload ?? FALLBACK_PAYLOAD;
  const generatedAt = useMemo(() => new Date(data.generated_at), [data.generated_at]);

  return (
    <section className="rounded-3xl border border-emerald-500/20 bg-slate-950/70 p-6 shadow-2xl shadow-emerald-950/20 backdrop-blur-xl sm:p-8">
      <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-300/90">
            Public Sustainable Compute Telemetry
          </p>
          <h2 className="mt-4 text-4xl font-black leading-[1.02] tracking-tight text-white sm:text-5xl">
            AI that doesn&apos;t cost the Earth
          </h2>
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base">
            Pillar 5 Context Sharding reduces redundant prompt overhead before it reaches the grid. These public
            network totals convert token diversion into water, carbon, and energy impact.
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-400">
            <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-emerald-100">
              {loading ? "Loading live metrics" : `${data.source} metrics`}
            </span>
            <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-violet-100">
              Updated {Number.isNaN(generatedAt.getTime()) ? "recently" : generatedAt.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
          {loading ? (
            <>
              <div className="h-40 animate-pulse rounded-2xl border border-cyan-400/15 bg-cyan-500/5" />
              <div className="h-40 animate-pulse rounded-2xl border border-emerald-400/15 bg-emerald-500/5" />
              <div className="h-40 animate-pulse rounded-2xl border border-amber-400/15 bg-amber-500/5" />
            </>
          ) : (
            <>
              <StatCard
                label="Water"
                value={formatMetric(data.metrics.freshwater_conserved_gallons, "gal")}
                equivalent={data.equivalencies.water_bottles_saved}
                tone="water"
              />
              <StatCard
                label="Carbon"
                value={formatMetric(data.metrics.co2e_offset_lbs, "lbs CO2e")}
                equivalent={data.equivalencies.tree_seedlings_equivalent}
                tone="carbon"
              />
              <StatCard
                label="Energy"
                value={formatMetric(data.metrics.grid_compute_prevented_kwh, "kWh")}
                equivalent={data.equivalencies.tesla_model_3_charges_equivalent}
                tone="energy"
              />
            </>
          )}
        </div>
      </div>
    </section>
  );
}
