import type { LayerAToolboxConfig } from "./layer-a-toolbox";
import { mapGradeCohortToLayerAToolbox } from "./layer-a-toolbox";
import type {
  AiAllowanceLevel,
  LayerBAllowanceEvent,
  LayerBRuntimeFlags,
} from "./layer-b-allowance";
import {
  normalizeAiAllowanceLevel,
  resolveLayerBFlags,
} from "./layer-b-allowance";

export type ResolvedWorkspaceConfig = {
  gradeCohort: LayerAToolboxConfig["gradeCohort"];
  layerA: LayerAToolboxConfig;
  layerB: LayerBRuntimeFlags;
  /** Pillar §2.1.2 — independent dimensions; Layer A tools persist across B changes. */
  effectiveWorkspaceNote: string;
};

export function resolveWorkspaceConfig(input: {
  gradeCohort: string;
  aiAllowanceLevel: unknown;
}): ResolvedWorkspaceConfig {
  const layerA = mapGradeCohortToLayerAToolbox(input.gradeCohort);
  const level = normalizeAiAllowanceLevel(input.aiAllowanceLevel);
  const layerB = resolveLayerBFlags(level);

  return {
    gradeCohort: layerA.gradeCohort,
    layerA,
    layerB,
    effectiveWorkspaceNote:
      "layer_a(grade_cohort) ∩ layer_b(ai_allowance_level); toolbox rendering is independent of allowance updates.",
  };
}

export type { AiAllowanceLevel, LayerBAllowanceEvent };
