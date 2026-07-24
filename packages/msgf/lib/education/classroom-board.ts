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
/**
 * Teacher Classroom Board — Author Publisher Hub → Education vector.
 * Aggregate cohort trends only; never returns raw student draft text.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { anonymizeEntityToken } from "@/lib/education/anonymize-entity-token";
import { EduAssignmentStateSchema } from "@/lib/education/assignment-instance";
import { HalLiteMetricsSchema } from "@/lib/education/hal-lite";
import {
  recommendCatalogForBoardFriction,
  type BoardCatalogRecommendation,
} from "@/lib/education/friction-recommend";
import { listCatalog } from "@/lib/education/curriculum-catalog";

export type ClassroomBoardStudentRow = {
  /** Anonymous display or truncated entity token — never legal name. */
  displayLabel: string;
  currentState: string;
  humanEffortConfidence: number;
  pasteEvents: number;
  pasteInjectionWarnings: number;
  activeWritingSeconds: number;
  stuck: boolean;
};

export type ClassroomBoardSummary = {
  assignmentId: string;
  tenantId: string;
  studentCount: number;
  draftingCount: number;
  milestoneCheckingCount: number;
  submittedCount: number;
  avgConfidence: number;
  pasteSpikeStudentCount: number;
  commonBottlenecks: Array<{ label: string; count: number }>;
  catalogRecommendations: BoardCatalogRecommendation[];
  students: ClassroomBoardStudentRow[];
};

/**
 * Build classroom board from assignment instances (HAL Lite metrics only).
 */
export async function buildClassroomBoard(params: {
  admin: SupabaseClient;
  tenantId: string;
  assignmentId: string;
}): Promise<ClassroomBoardSummary> {
  const { data, error } = await params.admin
    .from("education_assignment_instances")
    .select(
      "entity_token, current_state, hal_lite_metrics, document_read_only, updated_at"
    )
    .eq("tenant_id", params.tenantId)
    .eq("assignment_id", params.assignmentId);

  if (error) throw new Error(`classroom board: ${error.message}`);

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  let draftingCount = 0;
  let milestoneCheckingCount = 0;
  let submittedCount = 0;
  let confidenceSum = 0;
  let pasteSpikeStudentCount = 0;

  const bottleneckMap = new Map<string, number>();
  const students: ClassroomBoardStudentRow[] = [];

  for (const row of rows) {
    const stateParsed = EduAssignmentStateSchema.safeParse(row.current_state);
    const state = stateParsed.success
      ? stateParsed.data
      : "EDU_ACTIVE_DRAFTING";
    if (state === "EDU_ACTIVE_DRAFTING") draftingCount += 1;
    if (state === "EDU_MILESTONE_CHECKING") {
      milestoneCheckingCount += 1;
      bottleneckMap.set(
        "Structural milestone incomplete",
        (bottleneckMap.get("Structural milestone incomplete") ?? 0) + 1
      );
    }
    if (state === "EDU_SUBMITTED_LOCK") submittedCount += 1;

    const hal = HalLiteMetricsSchema.safeParse(row.hal_lite_metrics ?? {});
    const metrics = hal.success
      ? hal.data
      : {
          activeWritingTimeSeconds: 0,
          pasteEventsCount: 0,
          pasteInjectionWarnings: 0,
          keystrokeEventsCount: 0,
          documentDeltaChars: 0,
          humanEffortConfidenceScore: 1,
        };

    confidenceSum += metrics.humanEffortConfidenceScore;
    if (metrics.pasteInjectionWarnings > 0) pasteSpikeStudentCount += 1;
    if (metrics.pasteInjectionWarnings > 0) {
      bottleneckMap.set(
        "Paste injection spike",
        (bottleneckMap.get("Paste injection spike") ?? 0) + 1
      );
    }

    const stuck =
      state === "EDU_MILESTONE_CHECKING" ||
      (metrics.activeWritingTimeSeconds > 300 &&
        metrics.humanEffortConfidenceScore < 0.7);

    students.push({
      displayLabel: anonymizeEntityToken(String(row.entity_token ?? "unknown")),
      currentState: state,
      humanEffortConfidence: metrics.humanEffortConfidenceScore,
      pasteEvents: metrics.pasteEventsCount,
      pasteInjectionWarnings: metrics.pasteInjectionWarnings,
      activeWritingSeconds: metrics.activeWritingTimeSeconds,
      stuck,
    });
  }

  const commonBottlenecks = [...bottleneckMap.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  let catalogRecommendations: BoardCatalogRecommendation[] = [];
  try {
    const catalogRows = await listCatalog({
      admin: params.admin,
      districtTenantId: params.tenantId,
      query: { activeOnly: true, limit: 40 },
    });
    catalogRecommendations = recommendCatalogForBoardFriction({
      bottlenecks: commonBottlenecks,
      catalogRows,
      limit: 5,
    });
  } catch (e) {
    console.warn(
      "[classroom-board] catalog recommend skipped:",
      e instanceof Error ? e.message : e
    );
  }

  return {
    assignmentId: params.assignmentId,
    tenantId: params.tenantId,
    studentCount: rows.length,
    draftingCount,
    milestoneCheckingCount,
    submittedCount,
    avgConfidence:
      rows.length === 0
        ? 1
        : Number((confidenceSum / rows.length).toFixed(3)),
    pasteSpikeStudentCount,
    commonBottlenecks,
    catalogRecommendations,
    students: students.sort((a, b) => Number(b.stuck) - Number(a.stuck)),
  };
}
