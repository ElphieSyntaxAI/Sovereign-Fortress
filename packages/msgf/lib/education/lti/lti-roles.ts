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
 * Distribution Build ID: MSGF-81e8259-20260519T153428Z-internal
 */
/**
 * LTI role → Syntax Education persona (P3).
 */
import { personaToProfileRole } from "@/lib/platform-persona-auth";

const INSTRUCTOR_ROLES = new Set([
  "http://purl.imsglobal.org/vocab/lis/v2/institution/person#Administrator",
  "http://purl.imsglobal.org/vocab/lis/v2/institution/person#Instructor",
  "http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor",
  "http://purl.imsglobal.org/vocab/lis/v2/system/person#SysAdmin",
]);

const STUDENT_ROLES = new Set([
  "http://purl.imsglobal.org/vocab/lis/v2/institution/person#Student",
  "http://purl.imsglobal.org/vocab/lis/v2/membership#Learner",
]);

export type EducationLtiPersona = "student" | "teacher" | "administration_it" | "parent";

export function mapLtiRolesToPersona(roles: string[]): EducationLtiPersona {
  const normalized = roles.map((r) => r.trim()).filter(Boolean);

  if (normalized.some((r) => INSTRUCTOR_ROLES.has(r))) {
    return "teacher";
  }

  if (
    normalized.some(
      (r) =>
        r.includes("Administrator") &&
        !r.includes("Institution") &&
        !STUDENT_ROLES.has(r)
    )
  ) {
    return "administration_it";
  }

  if (normalized.some((r) => STUDENT_ROLES.has(r) || r.includes("Learner"))) {
    return "student";
  }

  return "student";
}

export function ltiPersonaToProfileRole(persona: EducationLtiPersona): string {
  if (persona === "parent") return "parent";
  return personaToProfileRole("education", persona);
}
