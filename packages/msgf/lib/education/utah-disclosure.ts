/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * Distribution Build ID: MSGF-a7aa881-20260620T084430Z-internal
 */
/**
 * Utah S.B. 149 AI disclosure gate + H.B. 273 hard constraints (P1).
 * Must be accepted before HAL Lite, Socratic, or other AI/telemetry processing.
 */
import { createHash } from "crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { CURRENT_LEGAL_VERSION } from "@/lib/msgf-legal";
import { EducationPolicyHaltError } from "@/lib/education/p1-static-ledger";

export const UTAH_DISCLOSURE_POLICY_ID = "utah_sb149_hb273" as const;

export type UtahDisclosureCopy = {
  policyId: typeof UTAH_DISCLOSURE_POLICY_ID;
  legalVersion: string;
  title: string;
  summary: string;
  bullets: string[];
  hb273Bullets: string[];
  acceptLabel: string;
  declineLabel: string;
};

export function getUtahDisclosureCopy(
  legalVersion: string = CURRENT_LEGAL_VERSION
): UtahDisclosureCopy {
  return {
    policyId: UTAH_DISCLOSURE_POLICY_ID,
    legalVersion,
    title: "Before you start — a quick note about AI helpers",
    summary:
      "Utah law (S.B. 149) says we must tell you when a school tool can use AI. Syntax Educates can check how you write and ask thinking questions. Please read this with a trusted adult if you want.",
    bullets: [
      "An AI helper may ask you questions to help you think. It will not write your answers for you (unless your teacher turns on a special logged mode).",
      "The tool may notice typing and big paste-ins so your teacher can see you did your own writing.",
      "We do not send your real name to the AI. We use a private student code instead.",
      "Your draft is not used to train big public AI models.",
      "You or a parent/guardian can ask the school how long this information is kept.",
    ],
    hb273Bullets: [
      "H.B. 273: The AI cannot change your grade by itself.",
      "H.B. 273: The AI cannot change IEP or 504 plans — only a teacher or authorized adult can.",
      "Your teacher stays in charge of scores, help tools, and how much AI is allowed.",
    ],
    acceptLabel: "I understand — continue",
    declineLabel: "I do not agree — exit",
  };
}

export function disclosureCopyHash(copy: UtahDisclosureCopy): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        v: copy.legalVersion,
        t: copy.title,
        s: copy.summary,
        b: copy.bullets,
        h: copy.hb273Bullets,
      })
    )
    .digest("hex");
}

export type DisclosureStatus = {
  required: boolean;
  accepted: boolean;
  legalVersion: string;
  acceptedAt: string | null;
  copy: UtahDisclosureCopy;
};

export async function getDisclosureStatus(params: {
  admin: SupabaseClient;
  tenantId: string;
  entityToken: string;
  assignmentInstanceId?: string | null;
}): Promise<DisclosureStatus> {
  const copy = getUtahDisclosureCopy();
  const { data, error } = await params.admin
    .from("education_disclosure_attestations")
    .select("attested_at, legal_version")
    .eq("tenant_id", params.tenantId)
    .eq("entity_token", params.entityToken)
    .eq("legal_version", copy.legalVersion)
    .order("attested_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`disclosure status: ${error.message}`);

  const accepted = Boolean(data?.attested_at);
  return {
    required: true,
    accepted,
    legalVersion: copy.legalVersion,
    acceptedAt: data?.attested_at ? String(data.attested_at) : null,
    copy,
  };
}

export async function acceptUtahDisclosure(params: {
  admin: SupabaseClient;
  tenantId: string;
  entityToken: string;
  assignmentInstanceId?: string | null;
  assignmentId?: string | null;
}): Promise<DisclosureStatus> {
  const copy = getUtahDisclosureCopy();
  const hash = disclosureCopyHash(copy);
  const attestedAt = new Date().toISOString();

  const { error } = await params.admin.from("education_disclosure_attestations").upsert(
    {
      tenant_id: params.tenantId,
      entity_token: params.entityToken,
      assignment_instance_id: params.assignmentInstanceId ?? null,
      assignment_id: params.assignmentId ?? null,
      legal_version: copy.legalVersion,
      policy_id: copy.policyId,
      acknowledgement_text_hash: hash,
      attested_at: attestedAt,
    },
    {
      onConflict: "tenant_id,entity_token,legal_version",
    }
  );

  if (error) throw new Error(`disclosure accept: ${error.message}`);

  if (params.assignmentInstanceId) {
    await params.admin
      .from("education_assignment_instances")
      .update({
        utah_disclosure_accepted_at: attestedAt,
        utah_disclosure_legal_version: copy.legalVersion,
        updated_at: attestedAt,
      })
      .eq("id", params.assignmentInstanceId)
      .eq("tenant_id", params.tenantId);
  }

  return {
    required: true,
    accepted: true,
    legalVersion: copy.legalVersion,
    acceptedAt: attestedAt,
    copy,
  };
}

/** HALT if S.B. 149 disclosure has not been accepted for current legal version. */
export async function assertUtahDisclosureAccepted(params: {
  admin: SupabaseClient;
  tenantId: string;
  entityToken: string;
}): Promise<void> {
  const status = await getDisclosureStatus(params);
  if (!status.accepted) {
    throw new EducationPolicyHaltError(
      "Utah S.B. 149 disclosure must be accepted before AI or authenticity processing can continue.",
      "P1_UTAH_SB149_DISCLOSURE_REQUIRED"
    );
  }
}

/** H.B. 273 hard rules — use before any grade/IEP mutation path. */
export function assertHb273NoAutoGradeOrIep(action: "auto_grade" | "iep_mutate"): never {
  throw new EducationPolicyHaltError(
    action === "auto_grade"
      ? "H.B. 273 HALT: automatic grading by AI is forbidden without teacher authorization."
      : "H.B. 273 HALT: IEP / 504 mutation by AI is forbidden.",
    action === "auto_grade" ? "P1_HB273_AUTO_GRADE_HALT" : "P1_HB273_IEP_MUTATE_HALT"
  );
}
