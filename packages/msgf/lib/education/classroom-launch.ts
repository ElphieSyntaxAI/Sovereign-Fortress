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
 * Distribution Build ID: MSGF-1b90a4ac-20260802T111608Z-internal
 */
/**
 * Google Classroom launch — mint privacy-gated entity token (Classroom-first host).
 * Complements Canvas LTI; does not store Google PII beyond hashed subject.
 */
import { createHash, createHmac } from "crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  mintAnonymousDisplayToken,
  mintInternalEntityId,
} from "@/lib/education/privacy-gate";
import { privacyGateSecret } from "@/lib/education/lti/lti-config";
import {
  upsertAssignmentInstance,
  toAssignmentInstanceWire,
  type AssignmentInstance,
} from "@/lib/education/assignment-instance";
import type { MilestoneTemplateId } from "@/lib/education/milestone-gate";

export function hashClassroomSubject(
  googleSub: string,
  tenantId: string
): string {
  return createHash("sha256")
    .update(`gclass:${tenantId}:${googleSub}`, "utf8")
    .digest("hex");
}

export function mintClassroomEntityToken(input: {
  subjectHash: string;
  tenantId: string;
  courseId: string;
}): string {
  const hmac = createHmac("sha256", privacyGateSecret())
    .update(`gclass-tok:${input.tenantId}:${input.courseId}:${input.subjectHash}`)
    .digest("hex")
    .slice(0, 16);
  return `tok_anon_stu_${hmac}`;
}

export type ClassroomLaunchResult = {
  entityId: string;
  entityToken: string;
  anonymousDisplayToken: string;
  subjectHash: string;
  assignmentInstance: AssignmentInstance;
  wire: ReturnType<typeof toAssignmentInstanceWire>;
  createdVault: boolean;
};

/**
 * Classroom assign/open → privacy vault + assignment instance in EDU_ACTIVE_DRAFTING.
 */
export async function launchFromGoogleClassroom(params: {
  admin: SupabaseClient;
  tenantId: string;
  /** Google user `sub` — hashed immediately; never stored plaintext. */
  googleSub: string;
  courseId: string;
  courseWorkId: string;
  assignmentId: string;
  gradeCohort?: string;
  milestoneTemplateId?: MilestoneTemplateId;
  resourceContextId?: string | null;
  role?: "student" | "teacher";
}): Promise<ClassroomLaunchResult> {
  const subjectHash = hashClassroomSubject(params.googleSub, params.tenantId);
  const entityId = mintInternalEntityId(subjectHash, params.tenantId);
  const anonymousDisplayToken = mintAnonymousDisplayToken({
    canvasSubHash: subjectHash,
    tenantId: params.tenantId,
    deploymentId: `gclass:${params.courseId}`,
  });
  const entityToken = mintClassroomEntityToken({
    subjectHash,
    tenantId: params.tenantId,
    courseId: params.courseId,
  });

  const { data: existing, error: readErr } = await params.admin
    .from("education_privacy_vault")
    .select("id, entity_id, anonymous_display_token")
    .eq("tenant_id", params.tenantId)
    .eq("canvas_sub_hash", subjectHash)
    .eq("deployment_id", `gclass:${params.courseId}`)
    .maybeSingle();

  if (readErr) throw new Error(`classroom privacy vault read: ${readErr.message}`);

  let createdVault = false;
  if (!existing?.id) {
    const { error: insertErr } = await params.admin
      .from("education_privacy_vault")
      .insert({
        tenant_id: params.tenantId,
        entity_id: entityId,
        anonymous_display_token: anonymousDisplayToken,
        canvas_sub_hash: subjectHash,
        lti_role: params.role ?? "student",
        deployment_id: `gclass:${params.courseId}`,
        issuer: "https://classroom.google.com",
        grade_cohort: params.gradeCohort ?? "4_6",
      });
    if (insertErr) {
      throw new Error(`classroom privacy vault insert: ${insertErr.message}`);
    }
    createdVault = true;
  }

  const assignmentInstance = await upsertAssignmentInstance({
    admin: params.admin,
    tenantId: params.tenantId,
    assignmentId: params.assignmentId,
    entityToken,
    milestoneTemplateId: params.milestoneTemplateId,
    resourceContextId: params.resourceContextId,
    classroomCourseId: params.courseId,
    classroomCourseWorkId: params.courseWorkId,
  });

  return {
    entityId: existing?.entity_id ? String(existing.entity_id) : entityId,
    entityToken,
    anonymousDisplayToken: existing?.anonymous_display_token
      ? String(existing.anonymous_display_token)
      : anonymousDisplayToken,
    subjectHash,
    assignmentInstance,
    wire: toAssignmentInstanceWire(assignmentInstance),
    createdVault,
  };
}
