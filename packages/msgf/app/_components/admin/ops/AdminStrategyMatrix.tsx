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
import type { AdminRemediationStrategy } from "@/lib/admin-browser-api";
import { buildSystemImpact, riskScoreTier } from "@/lib/admin-system-impact";

const CONSEQUENCE_BADGE: Record<
  "low" | "medium" | "high",
  { label: string; className: string }
> = {
  low: {
    label: "Low impact",
    className: "border-emerald-700/70 bg-emerald-950/60 text-emerald-200",
  },
  medium: {
    label: "Caution",
    className: "border-amber-700/70 bg-amber-950/60 text-amber-200",
  },
  high: {
    label: "High warning",
    className: "border-red-800/70 bg-red-950/60 text-red-200",
  },
};

function ConsequenceWarningBadge({
  riskScore,
  consequence,
}: {
  riskScore: number;
  consequence: string;
}) {
  const tier = riskScoreTier(riskScore);
  const { label, className } = CONSEQUENCE_BADGE[tier];
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${className}`}
      title={`${label} — ${consequence} (risk ${riskScore}/100)`}
    >
      <span className="uppercase tracking-wide">{label}</span>
      <span className="truncate font-normal normal-case opacity-90">· {consequence}</span>
    </span>
  );
}

type Props = {
  strategies: AdminRemediationStrategy[];
  selectedIndex: number | null;
  onSelect: (strategy: AdminRemediationStrategy, index: number) => void;
  loading?: boolean;
  error?: string | null;
};

export function AdminStrategyMatrix({
  strategies,
  selectedIndex,
  onSelect,
  loading,
  error,
}: Props) {
  const selected =
    selectedIndex != null && strategies[selectedIndex] ? strategies[selectedIndex] : null;

  return (
    <section className="space-y-3">
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-300">
          Strategy matrix
        </h4>
        <p className="mt-0.5 text-[11px] text-zinc-500">
          Select a remediation card to pre-fill the approved delta for Pulse tie-break.
        </p>
      </div>

      {loading ? (
        <p className="text-xs text-zinc-500">Loading remediation strategies…</p>
      ) : error ? (
        <p className="text-xs text-amber-400/90">{error}</p>
      ) : null}

      {!loading && strategies.length === 0 ? (
        <p className="text-xs text-zinc-500">No remediation strategies for this incident.</p>
      ) : null}

      {!loading && strategies.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-zinc-800">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-zinc-900/80 text-[10px] uppercase tracking-wide text-zinc-400">
              <tr>
                <th className="px-3 py-2 font-medium">Pillar / Action</th>
                <th className="px-3 py-2 font-medium">Risk</th>
                <th className="px-3 py-2 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {strategies.map((strategy, index) => {
                const isSelected = index === selectedIndex;
                const tier = riskScoreTier(strategy.riskScore);
                const pill =
                  tier === "high"
                    ? "bg-red-950 text-red-200"
                    : tier === "medium"
                      ? "bg-amber-950 text-amber-200"
                      : "bg-emerald-950 text-emerald-200";
                return (
                  <tr
                    key={`${strategy.pillar}-${strategy.label}-${index}`}
                    className={isSelected ? "bg-violet-950/30" : "border-t border-zinc-800"}
                  >
                    <td className="px-3 py-2">
                      <label className="flex items-start gap-2">
                        <input
                          type="radio"
                          name="strategy"
                          checked={isSelected}
                          onChange={() => onSelect(strategy, index)}
                        />
                        <span>
                          <span className="font-mono text-violet-300">{strategy.pillar}</span>
                          <span className="mt-1 block text-zinc-100">{strategy.label}</span>
                        </span>
                      </label>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 font-semibold ${pill}`}>
                        {strategy.riskScore}/100
                      </span>
                    </td>
                    <td className="px-3 py-2 text-zinc-400">{strategy.consequence}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {selected ? (
        <p className="text-xs leading-relaxed text-zinc-500">{buildSystemImpact(selected)}</p>
      ) : null}
    </section>
  );
}
