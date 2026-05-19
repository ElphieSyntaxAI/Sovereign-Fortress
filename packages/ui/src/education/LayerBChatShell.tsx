import type { LayerBRuntimeFlags } from "@elphie-syntax/core";

import { cn } from "../lib/cn";

export type LayerBChatShellProps = {
  layerB: LayerBRuntimeFlags;
  children?: React.ReactNode;
  className?: string;
};

/**
 * Layer B — chat / LLM shell (visibility driven by ai_allowance_level).
 */
export function LayerBChatShell({ layerB, children, className }: LayerBChatShellProps) {
  if (!layerB.chatInterfaceEnabled) {
    return (
      <aside
        data-layer="B"
        data-ai-level={layerB.aiAllowanceLevel}
        className={cn(
          "flex w-72 shrink-0 flex-col border-l border-zinc-800 bg-zinc-900/80 p-4",
          className
        )}
      >
        <p className="text-xs font-medium text-zinc-400">
          AI chat disabled — Level {layerB.aiAllowanceLevel} ({layerB.levelName})
        </p>
        <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
          {layerB.aiAllowanceLevel === 0
            ? "The Call telemetry is still recording for human authorship verification."
            : "Use the Layer A toolbox on the left. AI conversation is locked for this assignment."}
        </p>
      </aside>
    );
  }

  return (
    <aside
      data-layer="B"
      data-ai-level={layerB.aiAllowanceLevel}
      className={cn(
        "flex w-80 shrink-0 flex-col border-l border-violet-900/40 bg-violet-950/20",
        className
      )}
    >
      <header className="border-b border-violet-900/30 px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-300/90">
          Layer B · Level {layerB.aiAllowanceLevel}
        </p>
        <p className="text-xs text-violet-200/80">{layerB.levelName}</p>
      </header>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3">
        {children ?? (
          <p className="text-xs text-violet-200/60">
            Tutor stream connects when allowance ≥ 2 and assignment gates pass.
          </p>
        )}
      </div>
    </aside>
  );
}
