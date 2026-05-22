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
 * Distribution Build ID: MSGF-92d026a-20260522T181651Z-internal
 */
/**
 * Queue for promoting company-local `msgf_rules` mitigations to platform GLOBAL Brain rules.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { MitigationActionSchema } from "@/lib/schemas/mitigation-action";
import { GenealogicalBugIndexSchema } from "@/lib/schemas/vault-hall-metadata";
import { applyGlobalMitigation, type ApplyGlobalMitigationResult } from "@/lib/services/MitigationService";
import { MSGF_PLATFORM_GLOBAL_RULES_TENANT_ID } from "@/lib/services/msgf-global-rules";
import {
  redactProjectSensitiveText,
  sanitizeMitigationPromotionSnapshotForGlobal,
} from "@/lib/services/logic-pattern-sanitize";
import { resolveTenantIdForQuery } from "@/lib/services/tenant-query-scope";
import { invalidateTenantLineageCache } from "@/lib/services/vault-lineage-p2-cache";

export const RULE_SUBMISSION_STATUS_PENDING = "pending_global_review" as const;
export const RULE_SUBMISSION_STATUS_APPROVED = "approved" as const;
export const RULE_SUBMISSION_STATUS_REJECTED = "rejected" as const;
export const RULE_SUBMISSION_STATUS_WITHDRAWN = "withdrawn" as const;

export type RuleGlobalReviewSubmissionStatus =
  | typeof RULE_SUBMISSION_STATUS_PENDING
  | typeof RULE_SUBMISSION_STATUS_APPROVED
  | typeof RULE_SUBMISSION_STATUS_REJECTED
  | typeof RULE_SUBMISSION_STATUS_WITHDRAWN;

export const MitigationPromotionSnapshotSchema = z.object({
  bug_index: GenealogicalBugIndexSchema,
  mitigation_action: MitigationActionSchema,
  human_reasoning: z.string().max(8000).optional(),
  final_fix_applied: z.string().max(8000).optional(),
});

export type MitigationPromotionSnapshot = z.infer<typeof MitigationPromotionSnapshotSchema>;

/** IP-safe feed item for GLOBAL operators (no tenant / company / actor ids). */
export type ProposedBrainUpdatePublicDto = {
  id: string;
  created_at: string;
  status: RuleGlobalReviewSubmissionStatus;
  bug_index_instance: string;
  logic_pattern: MitigationPromotionSnapshot | null;
  note: string | null;
};

export function toProposedBrainUpdatePublicDto(
  row: MsgfRuleGlobalReviewSubmissionRow
): ProposedBrainUpdatePublicDto {
  const parsed = MitigationPromotionSnapshotSchema.safeParse(row.mitigation_snapshot);
  const logic_pattern = parsed.success
    ? sanitizeMitigationPromotionSnapshotForGlobal(parsed.data)
    : null;
  return {
    id: row.id,
    created_at: row.created_at,
    status: row.status,
    bug_index_instance: row.bug_index_instance,
    logic_pattern,
    note: row.human_note?.trim()
      ? redactProjectSensitiveText(row.human_note).slice(0, 2000)
      : null,
  };
}

export type MsgfRuleGlobalReviewSubmissionRow = {
  id: string;
  tenant_id: string;
  company_id: string;
  submitted_by_actor_id: string | null;
  bug_index_instance: string;
  mitigation_snapshot: MitigationPromotionSnapshot;
  human_note: string | null;
  status: RuleGlobalReviewSubmissionStatus;
  reviewer_actor_id: string | null;
  reviewed_at: string | null;
  reviewer_note: string | null;
  created_at: string;
  updated_at: string;
};

export async function insertRuleGlobalReviewSubmission(
  admin: SupabaseClient,
  params: {
    tenantId: string;
    companyId: string;
    submittedByActorId: string | null;
    mitigationSnapshot: MitigationPromotionSnapshot;
    humanNote?: string | null;
  }
): Promise<{ id: string }> {
  const tenantId = resolveTenantIdForQuery(params.tenantId);
  const companyId = params.companyId.trim();
  if (!companyId) {
    throw new Error("insertRuleGlobalReviewSubmission: companyId is required.");
  }

  const snapshot = MitigationPromotionSnapshotSchema.parse(params.mitigationSnapshot);
  const instance = snapshot.bug_index.level_1_1_1_instance.trim();
  if (!instance) {
    throw new Error("insertRuleGlobalReviewSubmission: bug_index.level_1_1_1_instance is required.");
  }

  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("msgf_rule_global_review_submissions")
    .insert({
      tenant_id: tenantId,
      company_id: companyId,
      submitted_by_actor_id: params.submittedByActorId,
      bug_index_instance: instance,
      mitigation_snapshot: snapshot,
      human_note: params.humanNote?.trim() || null,
      status: RULE_SUBMISSION_STATUS_PENDING,
      updated_at: now,
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error(`msgf_rule_global_review_submissions insert: ${error?.message ?? "no id"}`);
  }

  return { id: data.id as string };
}

export async function listPendingRuleGlobalReviewSubmissions(
  admin: SupabaseClient,
  limit = 100
): Promise<MsgfRuleGlobalReviewSubmissionRow[]> {
  const lim = Math.min(Math.max(1, limit), 200);
  const { data, error } = await admin
    .from("msgf_rule_global_review_submissions")
    .select("*")
    .eq("status", RULE_SUBMISSION_STATUS_PENDING)
    .order("created_at", { ascending: false })
    .limit(lim);

  if (error) {
    throw new Error(`msgf_rule_global_review_submissions list pending: ${error.message}`);
  }

  return (data ?? []) as MsgfRuleGlobalReviewSubmissionRow[];
}

export async function listCompanyRuleGlobalReviewSubmissions(
  admin: SupabaseClient,
  companyId: string,
  limit = 100
): Promise<MsgfRuleGlobalReviewSubmissionRow[]> {
  const cid = companyId.trim();
  if (!cid) return [];
  const lim = Math.min(Math.max(1, limit), 200);
  const { data, error } = await admin
    .from("msgf_rule_global_review_submissions")
    .select("*")
    .eq("company_id", cid)
    .order("created_at", { ascending: false })
    .limit(lim);

  if (error) {
    throw new Error(`msgf_rule_global_review_submissions list company: ${error.message}`);
  }

  return (data ?? []) as MsgfRuleGlobalReviewSubmissionRow[];
}

export async function getRuleGlobalReviewSubmissionById(
  admin: SupabaseClient,
  id: string
): Promise<MsgfRuleGlobalReviewSubmissionRow | null> {
  const { data, error } = await admin
    .from("msgf_rule_global_review_submissions")
    .select("*")
    .eq("id", id.trim())
    .maybeSingle();

  if (error) {
    throw new Error(`msgf_rule_global_review_submissions fetch: ${error.message}`);
  }

  return data ? (data as MsgfRuleGlobalReviewSubmissionRow) : null;
}

export async function approveRuleGlobalReviewSubmission(
  admin: SupabaseClient,
  params: {
    submissionId: string;
    reviewerActorId: string | null;
    reviewerNote?: string | null;
  }
): Promise<ApplyGlobalMitigationResult & { submission_id: string }> {
  const row = await getRuleGlobalReviewSubmissionById(admin, params.submissionId);
  if (!row) {
    throw new Error("Submission not found.");
  }
  if (row.status !== RULE_SUBMISSION_STATUS_PENDING) {
    throw new Error(`Submission is not pending (status=${row.status}).`);
  }

  const snap = MitigationPromotionSnapshotSchema.parse(row.mitigation_snapshot);
  if (snap.mitigation_action.kind !== "Global Fix") {
    throw new Error("Only Global Fix mitigations can be promoted to platform GLOBAL rules.");
  }

  const safe = sanitizeMitigationPromotionSnapshotForGlobal(snap);

  const humanReasoning =
    safe.human_reasoning?.trim() ||
    safe.mitigation_action.label?.trim() ||
    (row.human_note?.trim() ? redactProjectSensitiveText(row.human_note) : "") ||
    "Promoted from company-local global review.";
  const finalFixApplied =
    safe.final_fix_applied?.trim() || safe.mitigation_action.fix_template?.trim() || "";

  const applied = await applyGlobalMitigation({
    adminSupabase: admin,
    tenantId: MSGF_PLATFORM_GLOBAL_RULES_TENANT_ID,
    entityId: row.submitted_by_actor_id ?? row.tenant_id,
    bugIndex: safe.bug_index,
    mitigation: {
      ...safe.mitigation_action,
      kind: "Global Fix",
      apply_to_future_sessions: true,
      bug_index: safe.bug_index,
    },
    humanReasoning,
    finalFixApplied,
    isAdmin: true,
  });

  await invalidateTenantLineageCache(row.tenant_id);

  const now = new Date().toISOString();
  const { error: updErr } = await admin
    .from("msgf_rule_global_review_submissions")
    .update({
      status: RULE_SUBMISSION_STATUS_APPROVED,
      reviewer_actor_id: params.reviewerActorId,
      reviewed_at: now,
      reviewer_note: params.reviewerNote?.trim() || null,
      updated_at: now,
    })
    .eq("id", row.id)
    .eq("status", RULE_SUBMISSION_STATUS_PENDING);

  if (updErr) {
    throw new Error(`msgf_rule_global_review_submissions approve update: ${updErr.message}`);
  }

  return { ...applied, submission_id: row.id };
}

export async function rejectRuleGlobalReviewSubmission(
  admin: SupabaseClient,
  params: {
    submissionId: string;
    reviewerActorId: string | null;
    reviewerNote?: string | null;
  }
): Promise<void> {
  const row = await getRuleGlobalReviewSubmissionById(admin, params.submissionId);
  if (!row) {
    throw new Error("Submission not found.");
  }
  if (row.status !== RULE_SUBMISSION_STATUS_PENDING) {
    throw new Error(`Submission is not pending (status=${row.status}).`);
  }

  const now = new Date().toISOString();
  const { error } = await admin
    .from("msgf_rule_global_review_submissions")
    .update({
      status: RULE_SUBMISSION_STATUS_REJECTED,
      reviewer_actor_id: params.reviewerActorId,
      reviewed_at: now,
      reviewer_note: params.reviewerNote?.trim() || null,
      updated_at: now,
    })
    .eq("id", row.id)
    .eq("status", RULE_SUBMISSION_STATUS_PENDING);

  if (error) {
    throw new Error(`msgf_rule_global_review_submissions reject: ${error.message}`);
  }
}

export async function withdrawRuleGlobalReviewSubmission(
  admin: SupabaseClient,
  params: { submissionId: string; companyId: string }
): Promise<void> {
  const row = await getRuleGlobalReviewSubmissionById(admin, params.submissionId);
  if (!row) {
    throw new Error("Submission not found.");
  }
  if (row.company_id !== params.companyId.trim()) {
    throw new Error("Submission is outside your company scope.");
  }
  if (row.status !== RULE_SUBMISSION_STATUS_PENDING) {
    throw new Error(`Only pending submissions can be withdrawn (status=${row.status}).`);
  }

  const now = new Date().toISOString();
  const { error } = await admin
    .from("msgf_rule_global_review_submissions")
    .update({
      status: RULE_SUBMISSION_STATUS_WITHDRAWN,
      updated_at: now,
      reviewer_note: "withdrawn by company admin",
    })
    .eq("id", row.id)
    .eq("status", RULE_SUBMISSION_STATUS_PENDING);

  if (error) {
    throw new Error(`msgf_rule_global_review_submissions withdraw: ${error.message}`);
  }
}
