import { useCallback, useMemo, useState } from "react";

import {
  mapGradeCohortToLayerAToolbox,
  resolveWorkspaceConfig,
  type AiAllowanceLevel,
  type GradeCohort,
} from "@elphie-syntax/core";

import { cn } from "../lib/cn";
import { LayerAToolbox } from "./LayerAToolbox";
import { LayerBChatShell } from "./LayerBChatShell";
import { ResourceReaderPane, type ResourceReaderPayload } from "./ResourceReaderPane";
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
  /**
   * Approved-reading payload from `/api/msgf/education/teacher/assignment-resources`
   * (masterdoc §4.3). When provided, the canvas renders a split viewport:
   * left = reader pane, right = composition sandbox.
   */
  resource?: ResourceReaderPayload;
  /** Called once the P2 reading dependency trigger is satisfied. */
  onReadingGateSatisfied?: (info: { focusBlockMs: number; resourceContextId: string }) => void;
  className?: string;
};

/**
 * Dual-pane sandbox — Layer A structural toolbox + (optional) approved-reading
 * pane + composition workspace + Layer B chat shell.
 *
 * P2 Reading Dependency Trigger (pillars §2.2.1):
 *   When `resource.requireReadingBlock === true`, the composition pane is rendered
 *   read-only until a contiguous focus block of `minFocusBlockMs` elapses inside
 *   the reader pane. The unlock callback fires once and is then idempotent.
 */
export function WorkspaceCanvas({
  assignmentId,
  gradeCohort,
  initialAiAllowanceLevel = 3,
  apiBase,
  subscribeAllowance = true,
  editor,
  chat,
  resource,
  onReadingGateSatisfied,
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

  const [readingGateSatisfied, setReadingGateSatisfied] = useState(
    () => !(resource?.requireReadingBlock ?? false)
  );

  const compositionLocked = !!(resource?.requireReadingBlock && !readingGateSatisfied);

  const handleGateSatisfied = useCallback(
    (info: { focusBlockMs: number }) => {
      if (!resource) return;
      setReadingGateSatisfied(true);
      onReadingGateSatisfied?.({
        focusBlockMs: info.focusBlockMs,
        resourceContextId: resource.resourceContextId,
      });
    },
    [resource, onReadingGateSatisfied]
  );

  return (
    <div
      data-workspace-canvas
      data-grade-cohort={layerA.gradeCohort}
      data-ai-level={layerB.aiAllowanceLevel}
      data-reading-locked={compositionLocked ? "true" : "false"}
      className={cn(
        "flex min-h-[480px] overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950",
        className
      )}
    >
      <LayerAToolbox config={layerA} />

      <main
        data-layer="content"
        className={cn(
          "flex min-w-0 flex-1 flex-col gap-3 bg-zinc-900/40 p-4",
          resource ? "lg:grid lg:grid-cols-2 lg:gap-3" : ""
        )}
      >
        {resource && (
          <ResourceReaderPane
            payload={resource}
            onReadingGateSatisfied={handleGateSatisfied}
          />
        )}

        <section
          data-layer="editor"
          data-locked={compositionLocked ? "true" : "false"}
          aria-disabled={compositionLocked}
          className={cn(
            "flex min-h-[320px] flex-col rounded-lg border border-dashed border-zinc-700 bg-zinc-900/60 p-4",
            compositionLocked && "pointer-events-none opacity-60"
          )}
        >
          {compositionLocked && (
            <div className="mb-3 rounded border border-amber-700/60 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
              Read the assigned pages before composing — the editor unlocks after a
              {" "}
              {Math.round((resource?.minFocusBlockMs ?? 0) / 1000)}s focus block on the
              {" "}
              reader pane.
            </div>
          )}
          {editor ?? (
            <>
              <p className="text-sm font-medium text-zinc-300">Composition workspace</p>
              <p className="mt-1 text-xs text-zinc-500">
                {workspace.effectiveWorkspaceNote}
              </p>
            </>
          )}
        </section>
      </main>

      <LayerBChatShell layerB={layerB}>{chat}</LayerBChatShell>
    </div>
  );
}
