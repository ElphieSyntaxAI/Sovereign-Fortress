import type { LayerAToolboxConfig } from "@elphie-syntax/core";

import { cn } from "../lib/cn";

export type LayerAToolboxProps = {
  config: LayerAToolboxConfig;
  className?: string;
};

/**
 * Layer A — structural toolbox rail (immutable while Layer B changes).
 */
export function LayerAToolbox({ config, className }: LayerAToolboxProps) {
  return (
    <aside
      data-layer="A"
      data-grade-cohort={config.gradeCohort}
      data-structural-locked={config.structuralLocked ? "true" : "false"}
      aria-label="Grade-appropriate toolbox"
      className={cn(
        "flex shrink-0 flex-col gap-2 border-r border-emerald-900/40 bg-emerald-950/30 p-3",
        className
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400/90">
        Layer A · {config.gradeCohort.replace("_", "–")}
      </p>
      <ul className="flex flex-col gap-1.5">
        {config.tools.map((tool) => (
          <li key={tool.id}>
            <button
              type="button"
              data-tool-id={tool.id}
              data-component={tool.component}
              className="w-full rounded-md border border-emerald-800/50 bg-emerald-950/50 px-2 py-2 text-left text-xs text-emerald-100 transition hover:border-emerald-600/60 hover:bg-emerald-900/40"
            >
              {tool.label}
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
