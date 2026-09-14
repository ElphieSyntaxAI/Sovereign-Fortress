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
 * Prompt session ledger + fast harm classifier. Non-blocking writes.
 */

import { createHash, createHmac } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { emitPlatformAudit } from "@/lib/services/emit-platform-audit";

export type HarmCategory =
  | "human_harm"
  | "business_harm"
  | "illegal_facilitation"
  | "security_sabotage"
  | "self_harm"
  | "other";

export type PromptSessionInput = {
  tenant_id: string;
  company_id?: string | null;
  project_origin?: string | null;
  trace_id: string;
  product?: string;
  system_prompt_version_hash?: string | null;
  prompt_hash?: string | null;
  prompt_text: string;
  completion_text: string;
  model_provider?: string | null;
  model_id?: string | null;
  tokens_in?: number;
  tokens_out?: number;
  retrieved_context_ids?: unknown[];
  latency_ms?: number | null;
  observed_at?: string;
  /** Actor for HITL incident ownership when harm is flagged. */
  entity_id?: string | null;
};

const HUMAN_HARM =
  /\b(kill|murder|assault|how to (hurt|harm|poison)|self[- ]?harm|suicide)\b/i;
const BUSINESS_HARM =
  /\b(embezzle|cook the books|insider trading|sabotage (the )?(company|competitor)|steal (customer|trade) secrets)\b/i;
const ILLEGAL =
  /\b(how to (make|build) (a )?(bomb|explosive)|bypass (the )?law|commit fraud)\b/i;
const SECURITY =
  /\b(exfiltrate|ransomware|disable (all )?logging|backdoor (the )?(auth|admin))\b/i;
const SELF_HARM = /\b(kill myself|end my life|self[- ]?harm)\b/i;

export function classifyHarmFast(
  prompt: string,
  completion: string
): { categories: HarmCategory[]; confidence: number } {
  const text = `${prompt}\n${completion}`;
  const categories: HarmCategory[] = [];
  if (SELF_HARM.test(text)) categories.push("self_harm");
  if (HUMAN_HARM.test(text)) categories.push("human_harm");
  if (BUSINESS_HARM.test(text)) categories.push("business_harm");
  if (ILLEGAL.test(text)) categories.push("illegal_facilitation");
  if (SECURITY.test(text)) categories.push("security_sabotage");
  if (categories.length === 0) return { categories: [], confidence: 0 };
  return { categories: [...new Set(categories)], confidence: 0.75 };
}

function sessionSignSecret(): string | null {
  return (
    process.env.MSGF_ARBITRATE_AUDIT_KEY?.trim() ||
    process.env.MSGF_OPS_CRON_SECRET?.trim() ||
    process.env.MSGF_SKIP_AUDIT_SECRET?.trim() ||
    null
  );
}

function logSession(scope: string, err: unknown) {
  console.warn(`[prompt-sessions] ${scope}:`, err instanceof Error ? err.message : err);
}

/** Fire-and-forget session persist + optional harm flag. */
export function emitPromptSession(admin: SupabaseClient, input: PromptSessionInput): void {
  void (async () => {
    try {
      const tid = input.tenant_id?.trim();
      const trace = input.trace_id?.trim();
      if (!tid || !trace) return;

      const harm = classifyHarmFast(input.prompt_text ?? "", input.completion_text ?? "");
      const secret = sessionSignSecret();
      const observed_at = input.observed_at ?? new Date().toISOString();
      const body = {
        tenant_id: tid,
        company_id: input.company_id ?? null,
        project_origin: input.project_origin ?? null,
        trace_id: trace,
        product: input.product ?? "msgf",
        system_prompt_version_hash: input.system_prompt_version_hash ?? null,
        prompt_hash: input.prompt_hash ?? null,
        prompt_text: input.prompt_text ?? "",
        completion_text: input.completion_text ?? "",
        model_provider: input.model_provider ?? null,
        model_id: input.model_id ?? null,
        tokens_in: input.tokens_in ?? 0,
        tokens_out: input.tokens_out ?? 0,
        retrieved_context_ids: input.retrieved_context_ids ?? [],
        observed_at,
        latency_ms: input.latency_ms ?? null,
        harm_categories: harm.categories,
        classifier_confidence: harm.categories.length ? harm.confidence : null,
      };

      const rowHash = createHash("sha256")
        .update(JSON.stringify(body), "utf8")
        .digest("hex");
      const signature = secret
        ? createHmac("sha256", secret).update(rowHash, "utf8").digest("hex")
        : null;

      if (harm.categories.length > 0 && !secret) {
        logSession("harm flag without signing key — recording unsigned", "missing key");
      }

      const { data: inserted, error } = await admin
        .from("msgf_prompt_sessions")
        .insert({
          ...body,
          prev_hash: null,
          row_hash: rowHash,
          signature,
        })
        .select("id")
        .maybeSingle();

      if (error) {
        logSession("insert", error);
        return;
      }

      const sessionId = (inserted?.id as string | undefined) ?? null;
      let incidentId: string | null = null;

      if (harm.categories.length > 0 && sessionId) {
        try {
          const { insertMsgfArbitrateIncident } = await import(
            "@/lib/services/msgf-incidents"
          );
          const { PULSE_BUG_INDEX } = await import("@/lib/schemas/vault-hall-metadata");
          const actor =
            input.entity_id?.trim() ||
            (typeof input.company_id === "string" && input.company_id.trim()) ||
            tid;
          incidentId =
            (await insertMsgfArbitrateIncident({
              adminSupabase: admin,
              userId: actor,
              bugIndex: PULSE_BUG_INDEX.hallHitlRequired,
              scope: {
                tenantId: tid,
                entityId: actor,
                companyId: input.company_id ?? null,
                projectOrigin: input.project_origin ?? null,
              },
              metadataExtra: {
                kind: "HARM_RECOMMENDATION",
                harm_categories: harm.categories,
                prompt_session_id: sessionId,
                trace_id: trace,
                classifier_confidence: harm.confidence,
                notify: ["GLOBAL_ADMIN", "COMPANY_ADMIN"],
              },
            })) ?? null;

          if (incidentId) {
            await admin
              .from("msgf_prompt_sessions")
              .update({ incident_id: incidentId })
              .eq("id", sessionId);
          }
        } catch (hitlErr) {
          logSession("harm HITL open", hitlErr);
        }
      }

      emitPlatformAudit(admin, {
        product: body.product,
        tenant_id: tid,
        company_id: body.company_id,
        kind: harm.categories.length ? "harm_flag" : "prompt_session",
        severity: harm.categories.length ? "critical" : "info",
        trace_id: trace,
        ref_table: "msgf_prompt_sessions",
        ref_id: sessionId,
        summary: harm.categories.length
          ? `HARM_RECOMMENDATION pending HITL: ${harm.categories.join(",")}`
          : `Prompt session recorded (${body.model_id ?? "model"})`,
        metadata: {
          harm_categories: harm.categories,
          model_id: body.model_id,
          incident_id: incidentId,
          notify: harm.categories.length
            ? ["GLOBAL_ADMIN", "COMPANY_ADMIN"]
            : undefined,
        },
      });
    } catch (e) {
      logSession("emitPromptSession", e);
    }
  })();
}

export async function searchPromptSessions(
  admin: SupabaseClient,
  opts: {
    tenant_id?: string | null;
    company_id?: string | null;
    cross_tenant?: boolean;
    q?: string | null;
    harm_only?: boolean;
    product?: string | null;
    model_id?: string | null;
    trace_id?: string | null;
    limit?: number;
  }
): Promise<Record<string, unknown>[]> {
  const limit = Math.min(50, Math.max(1, opts.limit ?? 25));
  let query = admin
    .from("msgf_prompt_sessions")
    .select(
      "id, tenant_id, company_id, project_origin, trace_id, product, prompt_hash, prompt_text, completion_text, model_provider, model_id, tokens_in, tokens_out, observed_at, latency_ms, harm_categories, classifier_confidence, incident_id"
    )
    .order("observed_at", { ascending: false })
    .limit(limit * 3);

  if (!opts.cross_tenant) {
    if (opts.tenant_id?.trim()) query = query.eq("tenant_id", opts.tenant_id.trim());
    if (opts.company_id?.trim()) query = query.eq("company_id", opts.company_id.trim());
  } else if (opts.tenant_id?.trim()) {
    query = query.eq("tenant_id", opts.tenant_id.trim());
  }

  if (opts.product?.trim()) query = query.eq("product", opts.product.trim());
  if (opts.model_id?.trim()) query = query.eq("model_id", opts.model_id.trim());
  if (opts.trace_id?.trim()) query = query.eq("trace_id", opts.trace_id.trim());

  const { data, error } = await query;
  if (error) {
    logSession("search", error);
    return [];
  }

  let rows = (data ?? []) as Record<string, unknown>[];
  if (opts.harm_only) {
    rows = rows.filter((r) => {
      const cats = r.harm_categories;
      return Array.isArray(cats) && cats.length > 0;
    });
  }
  const needle = opts.q?.trim().toLowerCase() ?? "";
  if (needle) {
    rows = rows.filter((r) => {
      const p = String(r.prompt_text ?? "").toLowerCase();
      const c = String(r.completion_text ?? "").toLowerCase();
      const t = String(r.trace_id ?? "").toLowerCase();
      return p.includes(needle) || c.includes(needle) || t.includes(needle);
    });
  }
  return rows.slice(0, limit);
}
