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
        <ul className="space-y-2" role="listbox" aria-label="Strategy matrix">
          {strategies.map((strategy, index) => {
            const isSelected = index === selectedIndex;
            return (
              <li
                key={`${strategy.pillar}-${strategy.label}-${index}`}
                role="option"
                aria-selected={isSelected}
              >
                <button
                  type="button"
                  onClick={() => onSelect(strategy, index)}
                  className={`w-full rounded-lg border px-3 py-3 text-left transition ${
                    isSelected
                      ? "border-violet-700/80 bg-violet-950/25 ring-1 ring-violet-700/50"
                      : "border-zinc-700/80 bg-zinc-950/80 hover:border-zinc-600 hover:bg-zinc-900"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-violet-300">
                      Pillar: {strategy.pillar}
                    </span>
                    {strategy.scope ? (
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                          strategy.scope === "global"
                            ? "bg-sky-950/80 text-sky-300"
                            : "bg-zinc-800 text-zinc-400"
                        }`}
                      >
                        {strategy.scope === "global" ? "Global logic" : "Local logic"}
                      </span>
                    ) : null}
                    <ConsequenceWarningBadge
                      riskScore={strategy.riskScore}
                      consequence={strategy.consequence}
                    />
                    <span className="ml-auto font-mono text-[10px] text-zinc-500">
                      risk {strategy.riskScore}
                    </span>
                  </div>
                  <p className="mt-2 text-xs font-medium text-zinc-200">
                    Recommended fix: {strategy.label}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {selected ? (
        <div className="space-y-2 rounded-lg border border-zinc-700/80 bg-zinc-950/90 p-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-sky-400/90">
            System impact
          </p>
          <p className="text-xs leading-relaxed text-zinc-300">{buildSystemImpact(selected)}</p>
        </div>
      ) : null}
    </section>
  );
}
