import { useMemo } from "react";

import {
  mapGradeCohortToLayerAToolbox,
  resolveWorkspaceConfig,
  type AiAllowanceLevel,
  type GradeCohort,
} from "@elphie-syntax/core";

import { cn } from "../lib/cn";
import { LayerAToolbox } from "./LayerAToolbox";
import { LayerBChatShell } from "./LayerBChatShell";
import { useLayerBAllowanceStream } from "./useLayerBAllowanceStream";

export type WorkspaceCanvasProps = {
  assignmentId: string;
  gradeCohort: GradeCohort | string;
  initialAiAllowanceLevel?: AiAllowanceLevel;
  apiBase: string;
  /** Live Layer B updates via SSE (Layer A config is memoized from grade_cohort only). */
  subscribeAllowance?: boolean;
  editor?: React.ReactNode;
  chat?: React.ReactNode;
  className?: string;
};

/**
 * Dual-pane sandbox — Layer A structural toolbox + Layer B chat shell.
 */
export function WorkspaceCanvas({
  assignmentId,
  gradeCohort,
  initialAiAllowanceLevel = 3,
  apiBase,
  subscribeAllowance = true,
  editor,
  chat,
  className,
}: WorkspaceCanvasProps) {
  const layerA = useMemo(
    () => mapGradeCohortToLayerAToolbox(gradeCohort),
    [gradeCohort]
  );

  const { layerB } = useLayerBAllowanceStream({
    assignmentId,
    apiBase,
    initialLevel: initialAiAllowanceLevel,
    enabled: subscribeAllowance,
  });

  const workspace = useMemo(
    () =>
      resolveWorkspaceConfig({
        gradeCohort: layerA.gradeCohort,
        aiAllowanceLevel: layerB.aiAllowanceLevel,
      }),
    [layerA.gradeCohort, layerB.aiAllowanceLevel]
  );

  return (
    <div
      data-workspace-canvas
      data-grade-cohort={layerA.gradeCohort}
      data-ai-level={layerB.aiAllowanceLevel}
      className={cn(
        "flex min-h-[480px] overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950",
        className
      )}
    >
      <LayerAToolbox config={layerA} />
      <main
        data-layer="editor"
        className="flex min-w-0 flex-1 flex-col bg-zinc-900/40 p-4"
      >
        {editor ?? (
          <div className="flex h-full min-h-[320px] flex-col rounded-lg border border-dashed border-zinc-700 bg-zinc-900/60 p-4">
            <p className="text-sm font-medium text-zinc-300">Composition workspace</p>
            <p className="mt-1 text-xs text-zinc-500">
              {workspace.effectiveWorkspaceNote}
            </p>
          </div>
        )}
      </main>
      <LayerBChatShell layerB={layerB}>{chat}</LayerBChatShell>
    </div>
  );
}
