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
 * Distribution Build ID: MSGF-c122f849-20260911T161212Z-internal
 */
/**
 * Demo bootstrap — one-shot test-ready tenant objects (catalog, lesson, instance).
 * Gated by EDUCATION_DEMO_BOOTSTRAP=1 (or NODE_ENV=test).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { upsertAssignmentInstance } from "@/lib/education/assignment-instance";
import { upsertCatalogRow, type CatalogActor } from "@/lib/education/curriculum-catalog";
import { EDU_DEMO, EDU_DEMO_CURRICULUM_TEXT } from "@/lib/education/demo-fixtures";
import { seedDemoVaultStrength } from "@/lib/education/demo-vault-strength";
import { buildCatalogLayoutFromText } from "@/lib/education/layout-from-text";
import { acceptUtahDisclosure } from "@/lib/education/utah-disclosure";
import { createTeacherLesson } from "@/lib/education/teacher-lessons";
import { classroomOAuthConfigured } from "@/lib/education/classroom-oauth";

export function isEducationDemoBootstrapEnabled(): boolean {
  return (
    process.env.EDUCATION_DEMO_BOOTSTRAP === "1" ||
    process.env.NODE_ENV === "test" ||
    process.env.EDUCATION_OPEN_LESSON_API === "1"
  );
}

export type DemoBootstrapResult = {
  tenantId: string;
  catalogId: string;
  assignmentId: string;
  resourceContextId: string;
  assignmentInstanceId: string;
  entityToken: string;
  disclosureAccepted: boolean;
  vaultStrengthSeeded: boolean;
  oauthConfigured: boolean;
  classroomMockLaunchPath: string;
  sandboxPath: string;
};

export async function bootstrapEducationDemo(params: {
  admin: SupabaseClient;
  acceptDisclosure?: boolean;
}): Promise<DemoBootstrapResult> {
  if (!isEducationDemoBootstrapEnabled()) {
    throw new Error(
      "Demo bootstrap disabled. Set EDUCATION_DEMO_BOOTSTRAP=1 or EDUCATION_OPEN_LESSON_API=1."
    );
  }

  const actor: CatalogActor = {
    role: "admin",
    districtTenantId: EDU_DEMO.tenantId,
    userId: undefined,
  };

  const layout = buildCatalogLayoutFromText(
    EDU_DEMO_CURRICULUM_TEXT,
    EDU_DEMO.catalogTitle
  );

  const catalog = await upsertCatalogRow({
    admin: params.admin,
    actor,
    input: {
      id: EDU_DEMO.catalogId,
      title: EDU_DEMO.catalogTitle,
      publisher: "Syntax Educates Demo",
      subjectDomain: EDU_DEMO.subjectDomain,
      gradeBand: EDU_DEMO.gradeBand,
      sourceType: "local_pdf",
      storageObjectPath: `inline/demo/${EDU_DEMO.catalogId}.txt`,
      layout,
      isActive: true,
    },
  });

  const chapterId = layout[0]?.chapters[0]?.chapterId;
  const sectionId = layout[0]?.chapters[0]?.sections[0]?.sectionId;

  const teacherActor: CatalogActor = {
    role: "teacher",
    districtTenantId: EDU_DEMO.tenantId,
  };

  const created = await createTeacherLesson({
    admin: params.admin,
    actor: teacherActor,
    input: {
      title: EDU_DEMO.title,
      catalogId: catalog.id,
      assignmentId: EDU_DEMO.assignmentId,
      slice: {
        unitIds: layout[0] ? [layout[0].unitId] : ["u1"],
        chapterIds: chapterId ? [chapterId] : [],
        sectionIds: sectionId ? [sectionId] : [],
      },
      milestoneTemplateId: EDU_DEMO.milestoneTemplateId,
      aiAllowanceLevel: 3,
      requireReadingBlock: false,
      classroomCourseId: EDU_DEMO.courseId,
      subjectDomain: EDU_DEMO.subjectDomain,
      gradeBand: EDU_DEMO.gradeBand,
    },
  });

  const assignmentId = created.assignmentId;
  const resourceContextId = created.resourceContextId;

  const instance = await upsertAssignmentInstance({
    admin: params.admin,
    tenantId: EDU_DEMO.tenantId,
    assignmentId,
    entityToken: EDU_DEMO.entityToken,
    milestoneTemplateId: EDU_DEMO.milestoneTemplateId,
    resourceContextId,
    classroomCourseId: EDU_DEMO.courseId,
    classroomCourseWorkId: EDU_DEMO.courseWorkId,
  });

  let disclosureAccepted = false;
  if (params.acceptDisclosure !== false) {
    await acceptUtahDisclosure({
      admin: params.admin,
      tenantId: EDU_DEMO.tenantId,
      entityToken: EDU_DEMO.entityToken,
      assignmentInstanceId: instance.assignmentInstanceId,
      assignmentId,
    });
    disclosureAccepted = true;
  }

  const strengthSeed = await seedDemoVaultStrength({
    admin: params.admin,
    tenantId: EDU_DEMO.tenantId,
    entityToken: EDU_DEMO.entityToken,
  });

  const qs = new URLSearchParams({
    assignmentInstanceId: instance.assignmentInstanceId,
    entityToken: EDU_DEMO.entityToken,
  });

  return {
    tenantId: EDU_DEMO.tenantId,
    catalogId: catalog.id,
    assignmentId,
    resourceContextId,
    assignmentInstanceId: instance.assignmentInstanceId,
    entityToken: EDU_DEMO.entityToken,
    disclosureAccepted,
    vaultStrengthSeeded: strengthSeed.seeded,
    oauthConfigured: classroomOAuthConfigured(),
    classroomMockLaunchPath: `/api/education/classroom/mock-launch`,
    sandboxPath: `/sandbox?${qs.toString()}`,
  };
}
