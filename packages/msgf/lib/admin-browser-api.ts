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
 * Distribution Build ID: MSGF-149f647f-20260728T230931Z-internal
 */
/**
 * Browser admin API client for `/admin/ops` (same-origin Next app, Supabase session cookies).
 */

export type GenealogicalBugIndex = {
  level_1_category: string;
  level_1_1_branch: string;
  level_1_1_1_instance: string;
};

export type HitlIncidentStrategy = {
  id: "A" | "B" | "C";
  title: string;
  fix_summary: string;
  p2_step: string;
  consequence_score: number;
  consequence_factors: {
    roadmap_alignment: number;
    modular_compliance: number;
    risk_penalty: number;
    ai_assessment: number;
  };
  rationale: string;
};

export type HitlIncidentStrategies = {
  generated_at: string;
  roadmap_version: string;
  p2_pipeline: string[];
  strategies: HitlIncidentStrategy[];
};

/** RemediationEngine DTO from GET /api/msgf/admin/incidents/:id/strategies */
export type AdminRemediationStrategy = {
  pillar: string;
  label: string;
  fixTemplate: string;
  consequence: string;
  riskScore: number;
  /** `global` = P2 Roadmap / strategic; `local` = session telemetry / formatting. */
  scope?: "global" | "local";
  applyToFutureSessions?: boolean;
};

export type IncidentRemediationStrategiesResponse = {
  incidentId: string;
  strategies: AdminRemediationStrategy[];
};

import type { PillarHealthReport } from "@elphie-syntax/ui";

export type { PillarHealthReport };

export type MitigationKind = "Session Only" | "Global Fix";

export type MitigationAction = {
  kind: MitigationKind;
  pillar?: string;
  label?: string;
  fix_template?: string;
  apply_to_future_sessions?: boolean;
  bug_index?: GenealogicalBugIndex;
};

export function buildMitigationAction(params: {
  applyToAllFutureSessions: boolean;
  incident: MsgfIncident;
  strategy?: Pick<AdminRemediationStrategy, "pillar" | "label" | "fixTemplate">;
  fixTemplate?: string;
}): MitigationAction {
  return {
    kind: params.applyToAllFutureSessions ? "Global Fix" : "Session Only",
    pillar: params.strategy?.pillar,
    label: params.strategy?.label,
    fix_template: params.fixTemplate ?? params.strategy?.fixTemplate,
    apply_to_future_sessions: params.applyToAllFutureSessions,
    bug_index: params.incident.bug_index,
  };
}

export type MsgfIncident = {
  id: string;
  user_id: string;
  narrative_log_id: string | null;
  status: "pending" | "resolved";
  bug_index: GenealogicalBugIndex;
  resolution_note: string | null;
  strategies: HitlIncidentStrategies | null;
  created_at: string;
  updated_at: string;
};

/** Same-origin — session cookie auth via `resolveOperatorForAdminRequest`. */
export function apiBase(): string {
  return "";
}

export function adminAuthHeaders(extra?: Record<string, string>): HeadersInit {
  return {
    "Content-Type": "application/json",
    ...extra,
  };
}

export function adminFetchInit(init?: RequestInit): RequestInit {
  return {
    credentials: "include",
    cache: "no-store",
    ...init,
    headers: {
      ...adminAuthHeaders(),
      ...(init?.headers as Record<string, string> | undefined),
    },
  };
}

async function parseJson<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T & { error?: string; ok?: boolean };
  if (!res.ok) {
    const msg =
      typeof data === "object" && data && "error" in data && typeof data.error === "string"
        ? data.error
        : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

export async function fetchPillarHealth(options?: {
  userId?: string;
  lookbackHours?: number;
}): Promise<PillarHealthReport> {
  const params = new URLSearchParams();
  if (options?.userId?.trim()) params.set("user_id", options.userId.trim());
  if (options?.lookbackHours != null) {
    params.set("lookback_hours", String(options.lookbackHours));
  }
  const qs = params.toString();
  const res = await fetch(
    `${apiBase()}/api/msgf/health/pillars${qs ? `?${qs}` : ""}`,
    adminFetchInit()
  );
  return parseJson<PillarHealthReport>(res);
}

export type AdminDashboardSession = {
  operator_role?: string;
  dashboard_view?: "tenant_health" | "team_overview";
  can_promote_to_global?: boolean;
};

export async function fetchPendingIncidents(): Promise<{
  incidents: MsgfIncident[];
  session: AdminDashboardSession;
}> {
  const res = await fetch(
    `${apiBase()}/api/msgf/admin/incidents?status=pending&limit=50`,
    adminFetchInit()
  );
  const data = await parseJson<{
    ok: boolean;
    incidents: MsgfIncident[];
    operator_role?: string;
    dashboard_view?: "tenant_health" | "team_overview";
    can_promote_to_global?: boolean;
  }>(res);
  return {
    incidents: data.incidents ?? [],
    session: {
      operator_role: data.operator_role,
      dashboard_view: data.dashboard_view,
      can_promote_to_global: data.can_promote_to_global,
    },
  };
}

export async function applyGlobalMitigationRules(params: {
  incident: MsgfIncident;
  mitigationAction: MitigationAction;
  humanReasoning?: string;
  finalFixApplied?: string;
  remediationStrategyLabel?: string;
}): Promise<{
  global_mitigation_id?: string;
  global_rules_updated?: boolean;
}> {
  const res = await fetch(`${apiBase()}/api/msgf/admin/global-rules`, {
    method: "POST",
    ...adminFetchInit(),
    body: JSON.stringify({
      incident_id: params.incident.id,
      mitigation_action: {
        ...params.mitigationAction,
        kind: "Global Fix" as const,
        apply_to_future_sessions: true,
      },
      human_reasoning: params.humanReasoning,
      final_fix_applied: params.finalFixApplied,
      remediation_strategy_label: params.remediationStrategyLabel,
      bug_index: params.incident.bug_index,
    }),
  });
  return parseJson(res);
}

export async function resolveIncident(params: {
  id: string;
  resolutionNote: string;
  remediationStrategyLabel?: string;
  humanReasoning?: string;
  finalFixApplied?: string;
  mitigationAction?: MitigationAction;
}): Promise<MsgfIncident> {
  const res = await fetch(
    `${apiBase()}/api/msgf/admin/incidents/${encodeURIComponent(params.id)}`,
    {
      method: "PATCH",
      ...adminFetchInit(),
      body: JSON.stringify({
        status: "resolved",
        resolution_note: params.resolutionNote,
        ...(params.remediationStrategyLabel
          ? { remediation_strategy_label: params.remediationStrategyLabel }
          : {}),
        ...(params.humanReasoning ? { human_reasoning: params.humanReasoning } : {}),
        ...(params.finalFixApplied ? { final_fix_applied: params.finalFixApplied } : {}),
        ...(params.mitigationAction
          ? { mitigation_action: params.mitigationAction }
          : {}),
      }),
    }
  );
  const data = await parseJson<{ ok: boolean; incident: MsgfIncident }>(res);
  return data.incident;
}

export const PULSE_TIEBREAK_FAILED_TOAST =
  "Pulse Tie-break failed. Incident remains open for retry.";

/** Thrown when admin tie-break Pulse does not return `{ ok: true }` — incident must stay pending. */
export class PulseTiebreakFailedError extends Error {
  readonly incidentStaysPending = true;

  constructor(detail?: string) {
    super(detail?.trim() ? `${PULSE_TIEBREAK_FAILED_TOAST} (${detail})` : PULSE_TIEBREAK_FAILED_TOAST);
    this.name = "PulseTiebreakFailedError";
  }
}

export async function postAdminTiebreakPulse(params: {
  userId: string;
  approvedDelta: string;
}): Promise<Record<string, unknown>> {
  const res = await fetch(`${apiBase()}/api/msgf/pulse`, {
    method: "POST",
    ...adminFetchInit({
      headers: {
        "x-msgf-admin-tiebreak": "1",
        "x-msgf-act-as-user": params.userId,
      },
    }),
    body: JSON.stringify({
      keystrokes: [{ ts: Date.now(), key: " ", type: "input" as const }],
      humanTieBreakerResolved: true,
      approvedDelta: params.approvedDelta,
    }),
  });

  const data = (await res.json()) as Record<string, unknown> & { error?: string; ok?: boolean };
  if (!res.ok || data.ok !== true) {
    const detail =
      typeof data.error === "string"
        ? data.error
        : !res.ok
          ? `HTTP ${res.status}`
          : "Pulse did not return ok: true";
    throw new PulseTiebreakFailedError(detail);
  }
  return data;
}

export async function approveIncident(params: {
  incident: MsgfIncident;
  approvedDelta: string;
  operatorNote?: string;
  remediationStrategyLabel?: string;
  applyToAllFutureSessions?: boolean;
  mitigationAction?: MitigationAction;
}): Promise<{ incident: MsgfIncident; pulse: Record<string, unknown> }> {
  const resolutionNote =
    params.operatorNote?.trim() ||
    `Operator approved HITL tie-break (${params.incident.bug_index.level_1_1_1_instance}).`;

  const mitigationAction =
    params.mitigationAction ??
    buildMitigationAction({
      applyToAllFutureSessions: params.applyToAllFutureSessions === true,
      incident: params.incident,
      fixTemplate: params.approvedDelta,
    });

  const pulse = await postAdminTiebreakPulse({
    userId: params.incident.user_id,
    approvedDelta: params.approvedDelta,
  });

  if (params.applyToAllFutureSessions) {
    await applyGlobalMitigationRules({
      incident: params.incident,
      mitigationAction: { ...mitigationAction, kind: "Global Fix" },
      humanReasoning: params.operatorNote?.trim() || resolutionNote,
      finalFixApplied: params.approvedDelta,
      remediationStrategyLabel: params.remediationStrategyLabel,
    });
  }

  const incident = await resolveIncident({
    id: params.incident.id,
    resolutionNote,
    remediationStrategyLabel: params.remediationStrategyLabel,
    humanReasoning: params.operatorNote?.trim() || resolutionNote,
    finalFixApplied: params.approvedDelta,
    mitigationAction,
  });

  return { incident, pulse };
}

export const REJECTED_BY_ADMIN_PREFIX = "REJECTED_BY_ADMIN:";

export function formatAdminRejectionNote(reason = "Policy Violation"): string {
  const detail = reason.trim() || "Policy Violation";
  return `${REJECTED_BY_ADMIN_PREFIX} ${detail}`;
}

export async function notifyAuthorPulseRejected(params: {
  incident: MsgfIncident;
  resolutionNote: string;
}): Promise<{ notified: boolean; skipped?: string }> {
  const res = await fetch(`${apiBase()}/api/msgf/admin/incidents/notify-reject`, {
    method: "POST",
    ...adminFetchInit(),
    body: JSON.stringify({
      user_id: params.incident.user_id,
      incident_id: params.incident.id,
      narrative_log_id: params.incident.narrative_log_id,
      resolution_note: params.resolutionNote,
      bug_index: params.incident.bug_index,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    notified?: boolean;
    skipped?: string;
    error?: string;
  };

  if (!res.ok) {
    throw new Error(
      typeof data.error === "string" ? data.error : `Author notify failed (${res.status})`
    );
  }

  if (data.notified === true) {
    return { notified: true };
  }

  return {
    notified: false,
    skipped: typeof data.skipped === "string" ? data.skipped : "Webhook not configured.",
  };
}

export async function rejectIncident(params: {
  incident: MsgfIncident;
  reason?: string;
  remediationStrategyLabel?: string;
  /** When true (default), POST Author webhook if configured on MSGF. */
  notifyAuthor?: boolean;
}): Promise<{
  incident: MsgfIncident;
  authorNotified: boolean;
  authorNotifySkipped?: string;
}> {
  const resolutionNote = formatAdminRejectionNote(params.reason);
  const humanReasoning = params.reason?.trim() || "Policy Violation";

  const incident = await resolveIncident({
    id: params.incident.id,
    resolutionNote,
    remediationStrategyLabel: params.remediationStrategyLabel,
    humanReasoning,
    finalFixApplied: "(no fix applied — admin rejected)",
  });

  let authorNotified = false;
  let authorNotifySkipped: string | undefined;

  if (params.notifyAuthor !== false) {
    try {
      const notify = await notifyAuthorPulseRejected({ incident, resolutionNote });
      authorNotified = notify.notified;
      authorNotifySkipped = notify.skipped;
    } catch (e) {
      authorNotifySkipped =
        e instanceof Error ? e.message : "Author notify failed (incident still resolved).";
    }
  }

  return { incident, authorNotified, authorNotifySkipped };
}

export function incidentSummary(incident: MsgfIncident): string {
  return incident.bug_index.level_1_1_1_instance.replace(/^1\.1\.1_/, "").replace(/_/g, " ");
}

export type AdminNarrativeLog = {
  id: string;
  created_at: string;
  tenant_id: string;
  actor_id: string | null;
  action_type: string | null;
  message: string;
  severity: string | null;
  metadata: Record<string, unknown> | null;
  keystrokes_plain_text: string | null;
  models_disagree: Record<string, unknown> | null;
};

export async function fetchIncidentRemediationStrategies(
  incidentId: string
): Promise<IncidentRemediationStrategiesResponse> {
  const res = await fetch(
    `${apiBase()}/api/msgf/admin/incidents/${encodeURIComponent(incidentId)}/strategies`,
    adminFetchInit()
  );
  return parseJson<IncidentRemediationStrategiesResponse>(res);
}

export async function fetchAdminNarrativeLog(
  narrativeLogId: string
): Promise<AdminNarrativeLog> {
  const res = await fetch(
    `${apiBase()}/api/msgf/admin/logs/${encodeURIComponent(narrativeLogId)}`,
    adminFetchInit()
  );
  const data = await parseJson<{ ok: boolean; log: AdminNarrativeLog }>(res);
  return data.log;
}

export function incidentDetail(incident: MsgfIncident): string {
  return [
    `Incident ${incident.id}`,
    `User: ${incident.user_id}`,
    `Index: ${incident.bug_index.level_1_category} / ${incident.bug_index.level_1_1_branch} / ${incident.bug_index.level_1_1_1_instance}`,
    `Narrative log: ${incident.narrative_log_id ?? "(none)"}`,
    `Opened: ${new Date(incident.created_at).toLocaleString()}`,
    incident.resolution_note ? `Note: ${incident.resolution_note}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** GET /api/msgf/admin/promotions/pending — LogicDelta queues (role-scoped). */
export type PendingGlobalPromotionRow = {
  id: string;
  tenant_id: string;
  entity_id: string;
  suggested_by_entity_id: string;
  suggested_by_tenant_id: string;
  promotion_status: string;
  created_at: string;
  expires_at: string | null;
  company_validated_at?: string | null;
  preview: {
    summary_beat: string | null;
    source: string | null;
    content_snippet: string;
  };
};

export async function fetchPendingGlobalPromotions(options?: {
  tenantId?: string;
  limit?: number;
}): Promise<PendingGlobalPromotionRow[]> {
  const params = new URLSearchParams();
  if (options?.tenantId?.trim()) params.set("tenant_id", options.tenantId.trim());
  if (options?.limit != null) params.set("limit", String(options.limit));
  const qs = params.toString();
  const res = await fetch(
    `${apiBase()}/api/msgf/admin/promotions/pending${qs ? `?${qs}` : ""}`,
    adminFetchInit()
  );
  const data = await parseJson<{
    ok: boolean;
    entries: PendingGlobalPromotionRow[];
    count: number;
    queue_mode?: string;
  }>(res);
  return data.entries ?? [];
}

/**
 * POST /api/msgf/admin/promotions/approve — promote local_state_cache row → vault_core.
 * Set `promotedByActorId` to attribute the approving operator (also accepts `x-msgf-promoted-by` header).
 */
export async function approveGlobalVaultPromotion(params: {
  cacheId: string;
  tenantId: string;
  adminNote?: string;
  promotedByActorId?: string;
}): Promise<{
  ok: boolean;
  local_cache_id?: string;
  vault_narrative_log_id?: string | null;
  audit?: {
    suggested_by_entity_id?: string;
    suggested_by_tenant_id?: string;
    promoted_by_actor_id?: string;
    vault_narrative_log_id?: string | null;
  };
}> {
  const extra: Record<string, string> =
    params.promotedByActorId?.trim() != null && params.promotedByActorId.trim() !== ""
      ? { "x-msgf-promoted-by": params.promotedByActorId.trim() }
      : {};
  const res = await fetch(`${apiBase()}/api/msgf/admin/promotions/approve`, {
    method: "POST",
    headers: adminAuthHeaders(extra),
    body: JSON.stringify({
      cache_id: params.cacheId,
      tenant_id: params.tenantId,
      admin_note: params.adminNote,
      promoted_by_actor_id: params.promotedByActorId,
    }),
  });
  return parseJson(res);
}

export type LawBookExcerptDto = {
  id: string;
  content: string;
  metadata: Record<string, unknown> | null;
  law_book: string;
};

/** COMPANY_ADMIN: Local Law Book only (tenant_vault). GLOBAL_ADMIN may pass book=local + tenant_id. */
export async function fetchLocalLawBookExcerpts(params: {
  tenantId: string;
  limit?: number;
}): Promise<LawBookExcerptDto[]> {
  const tid = params.tenantId.trim();
  if (!tid) {
    throw new Error("tenantId is required for Local Law Book.");
  }
  const search = new URLSearchParams();
  search.set("book", "local");
  search.set("tenant_id", tid);
  if (params.limit != null) search.set("limit", String(params.limit));
  const res = await fetch(`${apiBase()}/api/msgf/admin/law-book?${search.toString()}`, {
    ...adminFetchInit(),
  });
  const data = await parseJson<{ ok: boolean; excerpts: LawBookExcerptDto[] }>(res);
  return data.excerpts ?? [];
}

/** GLOBAL_ADMIN: read-only core Hall (global_vault). */
export async function fetchGlobalLawBookExcerpts(options?: {
  limit?: number;
}): Promise<LawBookExcerptDto[]> {
  const search = new URLSearchParams();
  search.set("book", "global");
  if (options?.limit != null) search.set("limit", String(options.limit));
  const res = await fetch(`${apiBase()}/api/msgf/admin/law-book?${search.toString()}`, {
    ...adminFetchInit(),
  });
  const data = await parseJson<{ ok: boolean; excerpts: LawBookExcerptDto[] }>(res);
  return data.excerpts ?? [];
}

export type ProposedBrainUpdateDto = {
  id: string;
  created_at: string;
  status: string;
  bug_index_instance: string;
  logic_pattern: {
    bug_index: GenealogicalBugIndex;
    mitigation_action: MitigationAction;
    human_reasoning?: string;
    final_fix_applied?: string;
  } | null;
  note: string | null;
};

/** GET pending proposed Brain rule updates (GLOBAL_ADMIN — redacted server-side). */
export async function fetchProposedBrainUpdates(options?: {
  limit?: number;
}): Promise<ProposedBrainUpdateDto[]> {
  const params = new URLSearchParams();
  if (options?.limit != null) params.set("limit", String(options.limit));
  const qs = params.toString();
  const res = await fetch(
    `${apiBase()}/api/msgf/admin/rule-submissions${qs ? `?${qs}` : ""}`,
    adminFetchInit()
  );
  const data = await parseJson<{
    ok: boolean;
    proposed_brain_updates?: ProposedBrainUpdateDto[];
  }>(res);
  return data.proposed_brain_updates ?? [];
}

export async function patchRuleGlobalReviewSubmission(params: {
  id: string;
  action: "approve" | "reject";
  reviewer_note?: string;
}): Promise<Record<string, unknown>> {
  const res = await fetch(
    `${apiBase()}/api/msgf/admin/rule-submissions/${encodeURIComponent(params.id)}`,
    {
      method: "PATCH",
      ...adminFetchInit(),
      body: JSON.stringify({
        action: params.action,
        reviewer_note: params.reviewer_note,
      }),
    }
  );
  return parseJson(res);
}

/** COMPANY_ADMIN: allow a LogicDelta onto the global vault promotion queue. */
export async function validateCompanyLogicDelta(params: {
  cacheId: string;
  tenantId: string;
}): Promise<{ ok: boolean }> {
  const res = await fetch(`${apiBase()}/api/msgf/admin/promotions/company-validate`, {
    method: "POST",
    ...adminFetchInit(),
    body: JSON.stringify({
      cache_id: params.cacheId,
      tenant_id: params.tenantId,
    }),
  });
  return parseJson(res);
}

/** GLOBAL_ADMIN — anonymized successful local heals (cross-tenant). */
export type GlobalInsightFeedItem = {
  narrative_log_id: string;
  created_at: string;
  silo_ref: string;
  logic_pattern: string;
  pillar_hint: string | null;
  drift_score: number | null;
  strategy_id: string | null;
  already_absorbed: boolean;
};

export async function fetchGlobalInsightFeed(options?: {
  take?: number;
  scan?: number;
}): Promise<GlobalInsightFeedItem[]> {
  const params = new URLSearchParams();
  if (options?.take != null) params.set("take", String(options.take));
  if (options?.scan != null) params.set("scan", String(options.scan));
  const qs = params.toString();
  const res = await fetch(
    `${apiBase()}/api/msgf/admin/global-insight/feed${qs ? `?${qs}` : ""}`,
    adminFetchInit()
  );
  const data = await parseJson<{
    ok: boolean;
    insights: GlobalInsightFeedItem[];
    count: number;
  }>(res);
  return data.insights ?? [];
}

/** GLOBAL_ADMIN — copy anonymized logic pattern into global_vault lineage. */
export async function absorbGlobalInsightPattern(params: {
  narrativeLogId: string;
}): Promise<{
  ok: boolean;
  already_absorbed: boolean;
  vault_narrative_log_id: string | null;
}> {
  const res = await fetch(`${apiBase()}/api/msgf/admin/global-insight/absorb`, {
    method: "POST",
    ...adminFetchInit(),
    body: JSON.stringify({ narrative_log_id: params.narrativeLogId }),
  });
  return parseJson(res);
}
