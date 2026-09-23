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
 * Distribution Build ID: MSGF-fca2d532-20260923T201750Z-internal
 */
/**
 * Classroom-first Human Effort Certificate stub (pre-AGS / pre-gradebook API).
 * Mirrors Canvas AGS digest signing but persists as `classroom_stub` for teacher board / QA.
 */
import { createHash } from "crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { AssignmentInstance } from "@/lib/education/assignment-instance";
import {
  mintInternalEntityId,
  newCertificateId,
  signHumanEffortCertificateDigest,
} from "@/lib/education/privacy-gate";

export type ClassroomGradeStubResult = {
  certificateId: string;
  certificateDigest: string;
  halScore: number;
  teacherDashboardUrl: string;
  lineItemUrl: string;
  status: "classroom_stub";
  persisted: boolean;
};

function teacherDashboardBase(): string {
  return (
    process.env.EDUCATION_APP_URL?.replace(/\/+$/, "") ||
    process.env.NEXT_PUBLIC_EDUCATION_APP_URL?.replace(/\/+$/, "") ||
    "http://127.0.0.1:5175"
  );
}

/** Map HAL Lite confidence (0–1) → gradebook-style score (0–100). */
export function halConfidenceToScore(confidence: number): number {
  return Math.max(0, Math.min(100, Number((confidence * 100).toFixed(1))));
}

export function buildClassroomLineItemUrl(input: {
  courseId?: string | null;
  courseWorkId?: string | null;
  assignmentInstanceId: string;
}): string {
  const course = encodeURIComponent(input.courseId || "unknown-course");
  const work = encodeURIComponent(input.courseWorkId || "unknown-work");
  return `classroom://stub/${course}/${work}?instance=${encodeURIComponent(
    input.assignmentInstanceId
  )}`;
}

/**
 * Pure stub payload (no DB) — used in unit tests and when persistence is unavailable.
 */
export function mintClassroomGradeStub(input: {
  entityKey: string;
  halConfidence: number;
  courseId?: string | null;
  courseWorkId?: string | null;
  assignmentInstanceId: string;
  certificateId?: string;
  issuedAt?: string;
}): Omit<ClassroomGradeStubResult, "persisted"> {
  const certificateId = input.certificateId ?? newCertificateId();
  const issuedAt = input.issuedAt ?? new Date().toISOString();
  const halScore = halConfidenceToScore(input.halConfidence);
  const digest = signHumanEffortCertificateDigest({
    certificateId,
    entityId: input.entityKey,
    halScore,
    issuedAt,
  });
  const teacherDashboardUrl = `${teacherDashboardBase()}/teacher?certificate=${certificateId}&entity=${encodeURIComponent(
    input.entityKey
  )}`;
  return {
    certificateId,
    certificateDigest: digest,
    halScore,
    teacherDashboardUrl,
    lineItemUrl: buildClassroomLineItemUrl(input),
    status: "classroom_stub",
  };
}

/**
 * Issue + optionally persist Classroom grade stub after Turn-In Lockout.
 * Does not auto-grade learning outcomes (H.B. 273) — HAL confidence only.
 */
export async function issueClassroomGradeStubOnSubmit(params: {
  admin: SupabaseClient;
  instance: AssignmentInstance;
}): Promise<ClassroomGradeStubResult> {
  const stub = mintClassroomGradeStub({
    entityKey: params.instance.entityToken,
    halConfidence: params.instance.halLite.humanEffortConfidenceScore,
    courseId: params.instance.classroomCourseId,
    courseWorkId: params.instance.classroomCourseWorkId,
    assignmentInstanceId: params.instance.assignmentInstanceId,
  });

  const entityHash = createHash("sha256")
    .update(`classroom-stub:${params.instance.tenantId}:${params.instance.entityToken}`)
    .digest("hex");
  const entityId = mintInternalEntityId(entityHash, params.instance.tenantId);

  try {
    const { error } = await params.admin.from("education_human_effort_certificates").insert({
      id: stub.certificateId,
      tenant_id: params.instance.tenantId,
      entity_id: entityId,
      privacy_vault_id: null,
      resource_link_id: params.instance.classroomCourseWorkId ?? null,
      line_item_url: stub.lineItemUrl,
      hal_score: stub.halScore,
      certificate_digest: stub.certificateDigest,
      teacher_dashboard_url: stub.teacherDashboardUrl,
      ags_status: "classroom_stub",
      metadata: {
        host: "google_classroom",
        entity_token: params.instance.entityToken,
        assignment_instance_id: params.instance.assignmentInstanceId,
        assignment_id: params.instance.assignmentId,
        course_id: params.instance.classroomCourseId ?? null,
        course_work_id: params.instance.classroomCourseWorkId ?? null,
        hal_lite: params.instance.halLite,
        note: "Classroom grade stub — Human Effort Signal only; not an outcome grade.",
      },
    });

    if (error) {
      console.warn(
        "[human-effort-classroom-stub] persist skipped:",
        error.message
      );
      return { ...stub, persisted: false };
    }
    return { ...stub, persisted: true };
  } catch (e) {
    console.warn(
      "[human-effort-classroom-stub] persist error:",
      e instanceof Error ? e.message : e
    );
    return { ...stub, persisted: false };
  }
}
