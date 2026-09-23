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
 * Distribution Build ID: MSGF-fca2d532-20260923T201750Z-internal
 */
import { createHmac } from "crypto";

import type { StoredCustomEndpoint } from "@/lib/services/model-routing/types";

export type DriftBand = "low" | "medium" | "high";

export type PresetId =
  | "solo_fast"
  | "balanced_dual"
  | "bias_mitigated_dual"
  | "gemini_grok_dual"
  | "tri_tribunal"
  | "custom_byok"
  | "eco_trio";

export function classifyRoutingDrift(input: {
  promptChars: number;
  logicDriftScore?: number;
  p1Risk?: boolean;
}): DriftBand {
  if (input.p1Risk) return "high";
  const score = input.logicDriftScore ?? Math.min(1, input.promptChars / 80_000);
  if (score >= 0.55) return "high";
  const tokens = Math.ceil(input.promptChars / 4);
  if (tokens <= 800 && score < 0.25) return "low";
  return "medium";
}

export function cheapestEcoEndpoints(endpoints: StoredCustomEndpoint[]): StoredCustomEndpoint[] {
  return [...endpoints].sort(
    (a, b) => a.costPer1kInput + a.costPer1kOutput - (b.costPer1kInput + b.costPer1kOutput)
  );
}

export type RouteAction =
  | { action: "dispatch"; preset: PresetId; width: 1 | 2 | 3; endpoints?: StoredCustomEndpoint[] }
  | { action: "hitl"; preset: PresetId; queue: "/admin/ops" }
  | { action: "frontier"; preset: "tri_tribunal"; width: 3 };

export function routeWithinPreset(input: {
  preset: PresetId;
  band: DriftBand;
  ecoEndpoints?: StoredCustomEndpoint[];
  reasoningEndpoint?: StoredCustomEndpoint | null;
}): RouteAction {
  if (input.preset === "eco_trio") {
    if (input.band === "high") return { action: "hitl", preset: "eco_trio", queue: "/admin/ops" };
    if (
      input.band === "medium" &&
      input.reasoningEndpoint?.useForReasoning &&
      input.reasoningEndpoint.baseURL?.trim()
    ) {
      return {
        action: "dispatch",
        preset: "eco_trio",
        width: 1,
        endpoints: [input.reasoningEndpoint],
      };
    }
    const ordered = cheapestEcoEndpoints(input.ecoEndpoints ?? []);
    const width: 1 | 2 = input.band === "low" ? 1 : 2;
    return {
      action: "dispatch",
      preset: "eco_trio",
      width,
      endpoints: ordered.slice(0, width),
    };
  }

  if (input.band === "high") {
    if (input.preset === "tri_tribunal") {
      return { action: "frontier", preset: "tri_tribunal", width: 3 };
    }
    return { action: "hitl", preset: input.preset, queue: "/admin/ops" };
  }

  if (input.preset === "solo_fast") {
    return { action: "dispatch", preset: "solo_fast", width: 1 };
  }

  if (input.preset === "tri_tribunal") {
    return {
      action: "dispatch",
      preset: "tri_tribunal",
      width: input.band === "low" ? 1 : 2,
    };
  }

  if (input.band === "low") {
    return { action: "dispatch", preset: input.preset, width: 1 };
  }
  return { action: "dispatch", preset: input.preset, width: 2 };
}

export type HitlArbitrationItem = {
  queue: "/admin/ops";
  remediation_state: "PENDING_HUMAN_ARBITRATION";
  routing: "HITL_ARBITRATION_PENDING";
  preset: PresetId;
  project_origin: string;
  ts: string;
  signature: string;
};

export function signHitlPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}

export function buildHitlArbitrationItem(input: {
  preset: PresetId;
  projectOrigin: string;
  secret: string;
  now?: string;
}): HitlArbitrationItem {
  const ts = input.now ?? new Date().toISOString();
  const body = JSON.stringify({
    preset: input.preset,
    project_origin: input.projectOrigin,
    queue: "/admin/ops",
    remediation_state: "PENDING_HUMAN_ARBITRATION",
    ts,
  });
  return {
    queue: "/admin/ops",
    remediation_state: "PENDING_HUMAN_ARBITRATION",
    routing: "HITL_ARBITRATION_PENDING",
    preset: input.preset,
    project_origin: input.projectOrigin,
    ts,
    signature: signHitlPayload(body, input.secret),
  };
}

export function arbitrationPendingBody(item: HitlArbitrationItem): string {
  return JSON.stringify({
    ok: false,
    routing: item.routing,
    remediation_state: item.remediation_state,
    queue: item.queue,
    preset: item.preset,
    signature: item.signature,
  });
}

/** Metered baseline characters minus the eco completion characters, in tokens. */
export function provenTokensFromEcoDelta(baselineChars: number, localChars: number): number {
  const baseline = Math.max(0, Math.ceil(baselineChars / 4));
  const local = Math.max(0, Math.ceil(localChars / 4));
  return Math.max(0, baseline - local);
}
