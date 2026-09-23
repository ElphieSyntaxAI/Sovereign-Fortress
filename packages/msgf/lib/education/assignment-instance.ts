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
 * Distribution Build ID: MSGF-08289e1a-20260923T172846Z-internal
 */
/**
 * Education assignment instance lifecycle — Author p4_manuscripts states → edu_assignments.
 *
 * STATE_SOVEREIGN  → EDU_ACTIVE_DRAFTING
 * STATE_AUDIT      → EDU_MILESTONE_CHECKING
 * STATE_COOLDOWN   → EDU_SUBMITTED_LOCK (Classroom turn-in read-only)
 */
import { z } from "zod";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  emptyHalLiteMetrics,
  HalLiteMetricsSchema,
  toHalLiteWire,
  type HalLiteMetrics,
} from "@/lib/education/hal-lite";
import {
  MilestoneTemplateIdSchema,
  type MilestoneTemplateId,
} from "@/lib/education/milestone-gate";

export const EduAssignmentStateSchema = z.enum([
  "EDU_ACTIVE_DRAFTING",
  "EDU_MILESTONE_CHECKING",
  "EDU_SUBMITTED_LOCK",
]);
export type EduAssignmentState = z.infer<typeof EduAssignmentStateSchema>;

/** Author SSoT → classroom state map (immutable contract). */
export const MSGF_STATE_MAPPING = {
  STATE_SOVEREIGN: "EDU_ACTIVE_DRAFTING",
  STATE_COOLDOWN: "EDU_SUBMITTED_LOCK",
  STATE_AUDIT: "EDU_MILESTONE_CHECKING",
} as const satisfies Record<string, EduAssignmentState>;

export type AssignmentInstance = {
  assignmentInstanceId: string;
  assignmentId: string;
  tenantId: string;
  entityToken: string;
  classroomCourseId?: string | null;
  classroomCourseWorkId?: string | null;
  resourceContextId?: string | null;
  milestoneTemplateId: MilestoneTemplateId;
  currentState: EduAssignmentState;
  halLite: HalLiteMetrics;
  documentReadOnly: boolean;
  utahDisclosureAcceptedAt?: string | null;
  utahDisclosureLegalVersion?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AssignmentInstanceWire = {
  assignment_instance_id: string;
  entity_token: string;
  msgf_state_mapping: typeof MSGF_STATE_MAPPING;
  current_state: EduAssignmentState;
  hal_lite_metrics: ReturnType<typeof toHalLiteWire>;
  document_read_only: boolean;
  milestone_template_id: MilestoneTemplateId;
  utah_disclosure_accepted: boolean;
  utah_disclosure_accepted_at: string | null;
  utah_disclosure_legal_version: string | null;
};

const ALLOWED_TRANSITIONS: Record<EduAssignmentState, EduAssignmentState[]> = {
  EDU_ACTIVE_DRAFTING: ["EDU_MILESTONE_CHECKING", "EDU_SUBMITTED_LOCK"],
  EDU_MILESTONE_CHECKING: ["EDU_ACTIVE_DRAFTING", "EDU_SUBMITTED_LOCK"],
  EDU_SUBMITTED_LOCK: [],
};

export function canTransition(
  from: EduAssignmentState,
  to: EduAssignmentState
): boolean {
  if (from === to) return true;
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function toAssignmentInstanceWire(
  instance: AssignmentInstance
): AssignmentInstanceWire {
  return {
    assignment_instance_id: instance.assignmentInstanceId,
    entity_token: instance.entityToken,
    msgf_state_mapping: MSGF_STATE_MAPPING,
    current_state: instance.currentState,
    hal_lite_metrics: toHalLiteWire(instance.halLite),
    document_read_only: instance.documentReadOnly,
    milestone_template_id: instance.milestoneTemplateId,
    utah_disclosure_accepted: Boolean(instance.utahDisclosureAcceptedAt),
    utah_disclosure_accepted_at: instance.utahDisclosureAcceptedAt ?? null,
    utah_disclosure_legal_version: instance.utahDisclosureLegalVersion ?? null,
  };
}

function rowToInstance(row: Record<string, unknown>): AssignmentInstance {
  const halRaw = row.hal_lite_metrics;
  const halParsed = HalLiteMetricsSchema.safeParse(halRaw ?? {});
  return {
    assignmentInstanceId: String(row.id),
    assignmentId: String(row.assignment_id),
    tenantId: String(row.tenant_id),
    entityToken: String(row.entity_token),
    classroomCourseId: row.classroom_course_id
      ? String(row.classroom_course_id)
      : null,
    classroomCourseWorkId: row.classroom_course_work_id
      ? String(row.classroom_course_work_id)
      : null,
    resourceContextId: row.resource_context_id
      ? String(row.resource_context_id)
      : null,
    milestoneTemplateId: MilestoneTemplateIdSchema.parse(
      row.milestone_template_id ?? "generic_sections"
    ),
    currentState: EduAssignmentStateSchema.parse(row.current_state),
    halLite: halParsed.success ? halParsed.data : emptyHalLiteMetrics(),
    documentReadOnly: Boolean(row.document_read_only),
    utahDisclosureAcceptedAt: row.utah_disclosure_accepted_at
      ? String(row.utah_disclosure_accepted_at)
      : null,
    utahDisclosureLegalVersion: row.utah_disclosure_legal_version
      ? String(row.utah_disclosure_legal_version)
      : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function getAssignmentInstance(params: {
  admin: SupabaseClient;
  assignmentInstanceId: string;
  tenantId: string;
}): Promise<AssignmentInstance | null> {
  const { data, error } = await params.admin
    .from("education_assignment_instances")
    .select("*")
    .eq("id", params.assignmentInstanceId)
    .eq("tenant_id", params.tenantId)
    .maybeSingle();

  if (error) throw new Error(`assignment instance read: ${error.message}`);
  if (!data) return null;
  return rowToInstance(data as Record<string, unknown>);
}

export async function upsertAssignmentInstance(params: {
  admin: SupabaseClient;
  tenantId: string;
  assignmentId: string;
  entityToken: string;
  milestoneTemplateId?: MilestoneTemplateId;
  resourceContextId?: string | null;
  classroomCourseId?: string | null;
  classroomCourseWorkId?: string | null;
}): Promise<AssignmentInstance> {
  const { data: existing } = await params.admin
    .from("education_assignment_instances")
    .select("*")
    .eq("tenant_id", params.tenantId)
    .eq("assignment_id", params.assignmentId)
    .eq("entity_token", params.entityToken)
    .maybeSingle();

  if (existing) {
    return rowToInstance(existing as Record<string, unknown>);
  }

  const { data, error } = await params.admin
    .from("education_assignment_instances")
    .insert({
      tenant_id: params.tenantId,
      assignment_id: params.assignmentId,
      entity_token: params.entityToken,
      milestone_template_id: params.milestoneTemplateId ?? "generic_sections",
      resource_context_id: params.resourceContextId ?? null,
      classroom_course_id: params.classroomCourseId ?? null,
      classroom_course_work_id: params.classroomCourseWorkId ?? null,
      current_state: "EDU_ACTIVE_DRAFTING",
      document_read_only: false,
      hal_lite_metrics: emptyHalLiteMetrics(),
    })
    .select("*")
    .single();

  if (error) throw new Error(`assignment instance insert: ${error.message}`);
  return rowToInstance(data as Record<string, unknown>);
}

export async function transitionAssignmentInstance(params: {
  admin: SupabaseClient;
  assignmentInstanceId: string;
  tenantId: string;
  nextState: EduAssignmentState;
}): Promise<AssignmentInstance> {
  const current = await getAssignmentInstance({
    admin: params.admin,
    assignmentInstanceId: params.assignmentInstanceId,
    tenantId: params.tenantId,
  });
  if (!current) throw new Error("assignment instance not found");

  if (!canTransition(current.currentState, params.nextState)) {
    throw new Error(
      `invalid transition ${current.currentState} → ${params.nextState}`
    );
  }

  const documentReadOnly = params.nextState === "EDU_SUBMITTED_LOCK";

  const { data, error } = await params.admin
    .from("education_assignment_instances")
    .update({
      current_state: params.nextState,
      document_read_only: documentReadOnly,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.assignmentInstanceId)
    .eq("tenant_id", params.tenantId)
    .select("*")
    .single();

  if (error) throw new Error(`assignment instance transition: ${error.message}`);
  return rowToInstance(data as Record<string, unknown>);
}

export async function patchHalLiteMetrics(params: {
  admin: SupabaseClient;
  assignmentInstanceId: string;
  tenantId: string;
  metrics: HalLiteMetrics;
}): Promise<AssignmentInstance> {
  const { data, error } = await params.admin
    .from("education_assignment_instances")
    .update({
      hal_lite_metrics: params.metrics,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.assignmentInstanceId)
    .eq("tenant_id", params.tenantId)
    .select("*")
    .single();

  if (error) throw new Error(`hal lite patch: ${error.message}`);
  return rowToInstance(data as Record<string, unknown>);
}

/** Submit → Turn-In Lockout (Author Cool Down Lock → classroom vector). */
export async function submitAssignmentInstance(params: {
  admin: SupabaseClient;
  assignmentInstanceId: string;
  tenantId: string;
}): Promise<AssignmentInstance> {
  return transitionAssignmentInstance({
    ...params,
    nextState: "EDU_SUBMITTED_LOCK",
  });
}

export type { ClassroomGradeStubResult } from "@/lib/education/human-effort-classroom-stub";

/**
 * Submit + issue Classroom Human Effort Certificate stub (non-blocking if DB unavailable).
 */
export async function submitAssignmentInstanceWithCertificate(params: {
  admin: SupabaseClient;
  assignmentInstanceId: string;
  tenantId: string;
}): Promise<{
  instance: AssignmentInstance;
  certificate: import("@/lib/education/human-effort-classroom-stub").ClassroomGradeStubResult;
}> {
  const instance = await submitAssignmentInstance(params);
  const { issueClassroomGradeStubOnSubmit } = await import(
    "@/lib/education/human-effort-classroom-stub"
  );
  const certificate = await issueClassroomGradeStubOnSubmit({
    admin: params.admin,
    instance,
  });
  return { instance, certificate };
}
