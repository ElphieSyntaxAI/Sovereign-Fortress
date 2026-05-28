/**
 * Dev heal cycle — occurrence threshold before dev handoff is recommended.
 */

export const DEV_HEAL_OCCURRENCE_THRESHOLD = 3;

export type DevHandoffDto = {
  threshold: number;
  max_occurrence_count: number;
  dev_cycle_required: boolean;
  incident_id: string | null;
};

export function computeDevHandoff(params: {
  max_occurrence_count: number;
  incident_id?: string | null;
  threshold?: number;
}): DevHandoffDto {
  const threshold = params.threshold ?? DEV_HEAL_OCCURRENCE_THRESHOLD;
  const max_occurrence_count = Math.max(0, Math.floor(params.max_occurrence_count));
  return {
    threshold,
    max_occurrence_count,
    dev_cycle_required: max_occurrence_count >= threshold,
    incident_id: params.incident_id ?? null,
  };
}

export function recommendDevHealPath(dev_handoff: DevHandoffDto): "self" | "cloud" {
  return dev_handoff.dev_cycle_required ? "self" : "cloud";
}
