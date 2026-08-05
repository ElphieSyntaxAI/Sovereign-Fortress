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
 * Teacher lesson packages — catalog slice + milestone + allowance → Classroom-ready row.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import {
  upsertAssignmentResource,
  AssignmentResourceSliceSchema,
} from "@/lib/education/assignment-resources";
import type { CatalogActor } from "@/lib/education/curriculum-catalog";
import { MilestoneTemplateIdSchema } from "@/lib/education/milestone-gate";

export const CreateLessonSchema = z
  .object({
    title: z.string().min(1).max(256),
    catalogId: z.string().uuid(),
    slice: AssignmentResourceSliceSchema,
    milestoneTemplateId: MilestoneTemplateIdSchema.default("generic_sections"),
    aiAllowanceLevel: z.number().int().min(0).max(4).default(3),
    requireReadingBlock: z.boolean().default(false),
    minFocusBlockMs: z.number().int().min(0).max(1_800_000).default(120_000),
    classroomCourseId: z.string().max(128).optional().nullable(),
    googleDocTemplateUrl: z.string().url().optional().nullable(),
    subjectDomain: z
      .enum(["ela", "history", "math", "science", "general"])
      .default("general"),
    gradeBand: z
      .enum(["k3", "4_6", "7_9", "10_12", "12_plus", "mixed"])
      .default("4_6"),
    assignmentId: z.string().uuid().optional(),
  })
  .strict();

export type CreateLessonInput = z.infer<typeof CreateLessonSchema>;

export type EducationLesson = {
  id: string;
  tenant_id: string;
  title: string;
  catalog_id: string | null;
  resource_context_id: string | null;
  milestone_template_id: string;
  ai_allowance_level: number;
  require_reading_block: boolean;
  classroom_course_id: string | null;
  google_doc_template_url: string | null;
  subject_domain: string;
  grade_band: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export async function createTeacherLesson(params: {
  admin: SupabaseClient;
  actor: CatalogActor;
  input: unknown;
}): Promise<{
  lesson: EducationLesson;
  resourceContextId: string;
  assignmentId: string;
}> {
  const parsed = CreateLessonSchema.parse(params.input);
  const assignmentId = parsed.assignmentId ?? cryptoRandomUuid();

  const resource = await upsertAssignmentResource({
    admin: params.admin,
    actor: params.actor,
    input: {
      assignmentId,
      catalogId: parsed.catalogId,
      slice: parsed.slice,
      requireReadingBlock: parsed.requireReadingBlock,
      minFocusBlockMs: parsed.minFocusBlockMs,
    },
  });

  await params.admin.from("education_assignment_workspace").upsert(
    {
      assignment_id: assignmentId,
      tenant_id: params.actor.districtTenantId,
      ai_allowance_level: parsed.aiAllowanceLevel,
      updated_at: new Date().toISOString(),
      updated_by: params.actor.userId ?? null,
    },
    { onConflict: "assignment_id" }
  );

  const { data, error } = await params.admin
    .from("education_lessons")
    .upsert(
      {
        id: assignmentId,
        tenant_id: params.actor.districtTenantId,
        title: parsed.title,
        catalog_id: parsed.catalogId,
        resource_context_id: resource.resource_context_id,
        milestone_template_id: parsed.milestoneTemplateId,
        ai_allowance_level: parsed.aiAllowanceLevel,
        require_reading_block: parsed.requireReadingBlock,
        classroom_course_id: parsed.classroomCourseId ?? null,
        google_doc_template_url: parsed.googleDocTemplateUrl ?? null,
        subject_domain: parsed.subjectDomain,
        grade_band: parsed.gradeBand,
        created_by: params.actor.userId ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    )
    .select("*")
    .single();

  if (error) throw new Error(`education lesson upsert: ${error.message}`);

  return {
    lesson: data as EducationLesson,
    resourceContextId: resource.resource_context_id,
    assignmentId,
  };
}

export async function listTeacherLessons(params: {
  admin: SupabaseClient;
  tenantId: string;
  limit?: number;
}): Promise<EducationLesson[]> {
  const { data, error } = await params.admin
    .from("education_lessons")
    .select("*")
    .eq("tenant_id", params.tenantId)
    .order("created_at", { ascending: false })
    .limit(params.limit ?? 50);

  if (error) throw new Error(`education lessons list: ${error.message}`);
  return (data ?? []) as EducationLesson[];
}

function cryptoRandomUuid(): string {
  return globalThis.crypto.randomUUID();
}
