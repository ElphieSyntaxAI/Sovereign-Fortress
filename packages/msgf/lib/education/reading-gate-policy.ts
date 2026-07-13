/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * Distribution Build ID: MSGF-a7aa881-20260620T084430Z-internal
 */
/**
 * Pure P2 reading-gate policy (pillars §2.2.1).
 */
export function isReadingGateSatisfied(
  focusBlockMs: number,
  minFocusBlockMs: number
): boolean {
  const focus = Math.max(0, focusBlockMs);
  const min = Math.max(0, minFocusBlockMs);
  return focus >= min;
}

export function remainingFocusMs(
  focusBlockMs: number,
  minFocusBlockMs: number
): number {
  return Math.max(0, Math.max(0, minFocusBlockMs) - Math.max(0, focusBlockMs));
}

export type ReadingGateBeatRow = {
  created_at?: unknown;
  metadata?: unknown;
};

/**
 * Find the newest `reading_gate_satisfied` beat for a resource context.
 */
export function findReadingGateBeat(
  rows: ReadingGateBeatRow[],
  resourceContextId: string
): {
  satisfied: boolean;
  satisfiedAt: string | null;
  focusBlockMs: number | null;
} {
  for (const row of rows) {
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    if (meta.resource_context_id === resourceContextId) {
      const focus =
        typeof meta.focus_block_ms === "number" ? meta.focus_block_ms : null;
      return {
        satisfied: true,
        satisfiedAt: row.created_at != null ? String(row.created_at) : null,
        focusBlockMs: focus,
      };
    }
  }
  return { satisfied: false, satisfiedAt: null, focusBlockMs: null };
}
