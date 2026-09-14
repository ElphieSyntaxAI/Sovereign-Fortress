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
 * Model fitness labeling + rollup updates (non-blocking).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { emitPlatformAudit } from "@/lib/services/emit-platform-audit";

export type FitnessLabel = "under_provisioned" | "over_provisioned" | "fit";

export type FitnessEventInput = {
  tenant_id: string;
  product?: string;
  purpose?: string | null;
  model_provider?: string | null;
  model_id: string;
  prompt_class?: string;
  prompt_hash?: string | null;
  label: FitnessLabel;
  tokens_in?: number;
  tokens_out?: number;
  cost_usd_estimate?: number | null;
  latency_ms?: number | null;
  logic_drift_score?: number | null;
  escalated_from?: string | null;
  escalated_to?: string | null;
  trace_id?: string | null;
};

export function inferFitnessLabel(opts: {
  escalated?: boolean;
  lowDrift?: boolean;
  usedBigBrain?: boolean;
  trivialPrompt?: boolean;
}): FitnessLabel {
  if (opts.escalated) return "under_provisioned";
  if (opts.usedBigBrain && (opts.lowDrift || opts.trivialPrompt)) return "over_provisioned";
  return "fit";
}

export function emitModelFitness(admin: SupabaseClient, input: FitnessEventInput): void {
  void (async () => {
    try {
      const tid = input.tenant_id.trim();
      const modelId = input.model_id.trim();
      if (!tid || !modelId) return;
      const prompt_class = input.prompt_class?.trim() || "unknown";

      await admin.from("msgf_model_fitness_events").insert({
        tenant_id: tid,
        product: input.product ?? "msgf",
        purpose: input.purpose ?? null,
        model_provider: input.model_provider ?? null,
        model_id: modelId,
        prompt_class,
        prompt_hash: input.prompt_hash ?? null,
        label: input.label,
        tokens_in: input.tokens_in ?? 0,
        tokens_out: input.tokens_out ?? 0,
        cost_usd_estimate: input.cost_usd_estimate ?? null,
        latency_ms: input.latency_ms ?? null,
        logic_drift_score: input.logic_drift_score ?? null,
        escalated_from: input.escalated_from ?? null,
        escalated_to: input.escalated_to ?? null,
        trace_id: input.trace_id ?? null,
      });

      const scope_key = `tenant:${tid}`;
      const { data: existing } = await admin
        .from("msgf_model_fitness_rollup")
        .select("under_count, over_count, fit_count, sample_count, avg_cost_usd")
        .eq("scope_key", scope_key)
        .eq("prompt_class", prompt_class)
        .eq("model_id", modelId)
        .maybeSingle();

      const under =
        Number(existing?.under_count ?? 0) + (input.label === "under_provisioned" ? 1 : 0);
      const over =
        Number(existing?.over_count ?? 0) + (input.label === "over_provisioned" ? 1 : 0);
      const fit = Number(existing?.fit_count ?? 0) + (input.label === "fit" ? 1 : 0);
      const sample = Number(existing?.sample_count ?? 0) + 1;
      const prevAvg = Number(existing?.avg_cost_usd ?? 0);
      const cost = Number(input.cost_usd_estimate ?? 0);
      const avg = sample === 1 ? cost : (prevAvg * (sample - 1) + cost) / sample;

      await admin.from("msgf_model_fitness_rollup").upsert(
        {
          scope_key,
          tenant_id: tid,
          prompt_class,
          model_id: modelId,
          under_count: under,
          over_count: over,
          fit_count: fit,
          sample_count: sample,
          avg_cost_usd: avg,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "scope_key,prompt_class,model_id" }
      );

      emitPlatformAudit(admin, {
        product: input.product ?? "msgf",
        tenant_id: tid,
        kind: "model_fitness",
        severity: "info",
        trace_id: input.trace_id ?? null,
        summary: `Fitness ${input.label} for ${modelId} (${prompt_class})`,
        metadata: { label: input.label, model_id: modelId, prompt_class },
      });
    } catch (e) {
      console.warn(
        "[model-fitness]",
        e instanceof Error ? e.message : e
      );
    }
  })();
}

export type ModelFitnessRollupRow = {
  scope_key: string;
  tenant_id: string | null;
  prompt_class: string;
  model_id: string;
  under_count: number;
  over_count: number;
  fit_count: number;
  sample_count: number;
  avg_cost_usd: number;
  updated_at: string | null;
  fit_rate: number;
  under_rate: number;
  over_rate: number;
};

export async function listModelFitnessRollups(
  admin: SupabaseClient,
  opts: {
    tenant_id: string;
    prompt_class?: string | null;
    limit?: number;
  }
): Promise<ModelFitnessRollupRow[]> {
  const tid = opts.tenant_id.trim();
  if (!tid) return [];
  const limit = Math.min(100, Math.max(1, opts.limit ?? 40));
  let query = admin
    .from("msgf_model_fitness_rollup")
    .select(
      "scope_key, tenant_id, prompt_class, model_id, under_count, over_count, fit_count, sample_count, avg_cost_usd, updated_at"
    )
    .eq("tenant_id", tid)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (opts.prompt_class?.trim()) {
    query = query.eq("prompt_class", opts.prompt_class.trim());
  }
  const { data, error } = await query;
  if (error) {
    console.warn("[model-fitness] list rollups:", error.message);
    return [];
  }
  return (data ?? []).map((row) => {
    const sample = Math.max(1, Number(row.sample_count ?? 0));
    const under = Number(row.under_count ?? 0);
    const over = Number(row.over_count ?? 0);
    const fit = Number(row.fit_count ?? 0);
    return {
      scope_key: String(row.scope_key ?? ""),
      tenant_id: typeof row.tenant_id === "string" ? row.tenant_id : null,
      prompt_class: String(row.prompt_class ?? "unknown"),
      model_id: String(row.model_id ?? ""),
      under_count: under,
      over_count: over,
      fit_count: fit,
      sample_count: sample,
      avg_cost_usd: Number(row.avg_cost_usd ?? 0),
      updated_at: typeof row.updated_at === "string" ? row.updated_at : null,
      fit_rate: fit / sample,
      under_rate: under / sample,
      over_rate: over / sample,
    };
  });
}

/**
 * Prefer cheapest model with adequate fit_rate for a prompt_class.
 * Safety: returns null when under_rate is high (caller must not downshift past safety).
 */
export async function preferCheapestFitModel(
  admin: SupabaseClient,
  opts: {
    tenant_id: string;
    prompt_class?: string | null;
    min_samples?: number;
    max_under_rate?: number;
  }
): Promise<{ model_id: string; avg_cost_usd: number; fit_rate: number } | null> {
  const rows = await listModelFitnessRollups(admin, {
    tenant_id: opts.tenant_id,
    prompt_class: opts.prompt_class ?? null,
    limit: 80,
  });
  const minSamples = opts.min_samples ?? 5;
  const maxUnder = opts.max_under_rate ?? 0.25;
  const eligible = rows
    .filter((r) => r.sample_count >= minSamples && r.under_rate <= maxUnder)
    .sort((a, b) => a.avg_cost_usd - b.avg_cost_usd || b.fit_rate - a.fit_rate);
  const best = eligible[0];
  if (!best?.model_id) return null;
  return {
    model_id: best.model_id,
    avg_cost_usd: best.avg_cost_usd,
    fit_rate: best.fit_rate,
  };
}

/** Pure helper: if over_provisioned spike dominates, prefer small-brain path. */
export function fitnessSuggestsSmallBrain(rollup: {
  under_rate: number;
  over_rate: number;
  sample_count: number;
}): boolean {
  if (rollup.sample_count < 5) return false;
  if (rollup.under_rate > 0.2) return false;
  return rollup.over_rate >= 0.35;
}
