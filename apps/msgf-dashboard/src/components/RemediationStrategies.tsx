import type { GenealogicalBugIndex } from "../lib/msgf-admin-api";
import { brainStabilityTier, type EnrichedRemediationStrategy } from "../lib/decision-portal";
import { StabilityBadge } from "./StabilityBadge";
import { ConsequenceVisualizer } from "./ConsequenceVisualizer";

type Props = {
  bugIndex: GenealogicalBugIndex;
  strategies: EnrichedRemediationStrategy[];
  selectedId: EnrichedRemediationStrategy["id"] | null;
  onSelect: (strategy: EnrichedRemediationStrategy) => void;
  synthetic?: boolean;
};

export function RemediationStrategies({
  bugIndex,
  strategies,
  selectedId,
  onSelect,
  synthetic,
}: Props) {
  const selected = strategies.find((s) => s.id === selectedId) ?? null;
  const instanceLabel = bugIndex.level_1_1_1_instance
    .replace(/^1\.1\.1_/, "")
    .replace(/_/g, " ");

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-medium text-zinc-300">Remediation strategies</p>
        <p className="mt-0.5 text-[11px] text-zinc-500">
          Indexed for{" "}
          <span className="font-mono text-zinc-400">{instanceLabel}</span>
          {synthetic ? " · fallback templates (no AI bundle on incident)" : " · P2-ranked fixes"}
        </p>
      </div>

      <ul className="space-y-2" role="listbox" aria-label="Remediation strategies">
        {strategies.map((strategy) => {
          const isSelected = strategy.id === selectedId;
          const stability = brainStabilityTier(strategy);

          return (
            <li key={strategy.id} role="option" aria-selected={isSelected}>
              <button
                type="button"
                onClick={() => onSelect(strategy)}
                className={`w-full rounded-lg border px-3 py-3 text-left transition ${
                  isSelected
                    ? "border-emerald-700/80 bg-emerald-950/20 ring-1 ring-emerald-800/50"
                    : "border-zinc-700/80 bg-zinc-950/80 hover:border-zinc-600 hover:bg-zinc-900"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-zinc-100">
                    {strategy.id}. {strategy.title}
                  </span>
                  <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-violet-300">
                    {strategy.p2_step}
                  </span>
                  <StabilityBadge tier={stability} />
                </div>

                <div className="mt-2">
                  <ConsequenceVisualizer consequences={strategy.consequences} compact />
                </div>

                <p className="mt-2 text-[11px] leading-relaxed text-zinc-500 line-clamp-2">
                  {strategy.fix_summary}
                </p>
              </button>
            </li>
          );
        })}
      </ul>

      {selected ? (
        <div className="space-y-3 rounded-lg border border-emerald-900/30 bg-zinc-950/90 p-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-500/90">
              Fix template (approved delta)
            </p>
            <p className="mt-2 font-mono text-sm leading-relaxed text-zinc-100 whitespace-pre-wrap">
              {selected.fix_template}
            </p>
          </div>
          <ConsequenceVisualizer consequences={selected.consequences} />
        </div>
      ) : (
        <p className="text-xs text-amber-400/90">
          Select a remediation strategy to pre-fill the Pulse override.
        </p>
      )}
    </div>
  );
}
