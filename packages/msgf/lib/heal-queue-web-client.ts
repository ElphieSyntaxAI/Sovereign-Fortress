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
 * Distribution Build ID: MSGF-48a02b8-20260530T050749Z-internal
 */
import {
  HealQueueGetEnvelopeSchema,
  HealQueuePostEnvelopeSchema,
  HealQueueHumanArbitrationBodySchema,
  IngestRemediationActionSchema,
  type HealQueueGetResponse,
  type HealQueueHumanArbitrationBody,
  type HealQueuePostOk,
  type HealQueuePresetInterval,
  type HealQueueActionType,
  type HumanArbitrationAction,
  type IngestRemediationAction,
} from "@/lib/schemas/heal-queue";

export type HealQueueClientError = {
  ok: false;
  message: string;
  issues?: { path: string; message: string }[];
};

export type HealQueueFetchResult =
  | { ok: true; data: HealQueueGetResponse }
  | HealQueueClientError;

export type HealQueuePostResult =
  | { ok: true; data: HealQueuePostOk }
  | HealQueueClientError;

function clientError(message: string, issues?: { path: string; message: string }[]): HealQueueClientError {
  return { ok: false, message, issues };
}

export async function fetchHealQueueForTenant(tenantId: string): Promise<HealQueueFetchResult> {
  const url = `/api/msgf/heal-queue?tenant_id=${encodeURIComponent(tenantId)}`;
  const res = await fetch(url, { credentials: "include", cache: "no-store" });
  let raw: unknown;
  try {
    raw = await res.json();
  } catch {
    return clientError(`Heal queue GET returned non-JSON (${res.status}).`);
  }

  const parsed = HealQueueGetEnvelopeSchema.safeParse(raw);
  if (!parsed.success) {
    return clientError("Heal queue GET response failed schema validation.");
  }

  if (parsed.data.ok !== true) {
    return clientError(
      parsed.data.message ?? parsed.data.error ?? `Heal queue GET failed (${res.status}).`,
      parsed.data.issues
    );
  }

  if (!res.ok) {
    return clientError(`Heal queue GET failed (${res.status}).`);
  }

  return { ok: true, data: parsed.data };
}

export function buildHealQueuePostBody(params: {
  tenant_id: string;
  action_type: HealQueueActionType;
  file_paths?: string[];
  preset_interval?: HealQueuePresetInterval;
}): IngestRemediationAction {
  const parsed = IngestRemediationActionSchema.safeParse(params);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => ({
      path: i.path.join("."),
      message: i.message,
    }));
    throw new Error(
      issues.map((i) => `${i.path}: ${i.message}`).join("; ") || "Invalid heal-queue payload"
    );
  }
  return parsed.data;
}

export async function postHealQueueRemediation(
  body: IngestRemediationAction
): Promise<HealQueuePostResult> {
  const validated = IngestRemediationActionSchema.parse(body);

  const res = await fetch("/api/msgf/heal-queue", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(validated),
  });

  let raw: unknown;
  try {
    raw = await res.json();
  } catch {
    return clientError(`Heal queue POST returned non-JSON (${res.status}).`);
  }

  const parsed = HealQueuePostEnvelopeSchema.safeParse(raw);
  if (!parsed.success) {
    return clientError("Heal queue POST response failed schema validation.");
  }

  if (parsed.data.ok !== true) {
    return clientError(
      parsed.data.message ?? parsed.data.error ?? `Heal queue POST failed (${res.status}).`,
      parsed.data.issues
    );
  }

  if (!res.ok) {
    return clientError(`Heal queue POST failed (${res.status}).`);
  }

  return { ok: true, data: parsed.data };
}

export type HumanArbitrationPostResult =
  | {
      ok: true;
      action: HumanArbitrationAction;
      file_path: string;
      remediation_state: string;
      message: string;
      security_clean_signal: boolean;
    }
  | HealQueueClientError;

export async function postHealQueueHumanArbitration(
  body: HealQueueHumanArbitrationBody
): Promise<HumanArbitrationPostResult> {
  const validated = HealQueueHumanArbitrationBodySchema.parse(body);

  const res = await fetch("/api/msgf/heal-queue/human-arbitration", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(validated),
  });

  let raw: unknown;
  try {
    raw = await res.json();
  } catch {
    return clientError(`Human arbitration POST returned non-JSON (${res.status}).`);
  }

  if (!res.ok || (raw as { ok?: boolean }).ok !== true) {
    const err = raw as { message?: string; error?: string; issues?: { path: string; message: string }[] };
    return clientError(
      err.message ?? err.error ?? `Human arbitration POST failed (${res.status}).`,
      err.issues
    );
  }

  const data = raw as {
    action: HumanArbitrationAction;
    file_path: string;
    remediation_state: string;
    message: string;
    security_clean_signal: boolean;
  };

  return { ok: true, ...data };
}

/** Count remediation tasks per governance pillar. */
export function misalignmentCountByPillar(
  tasks: HealQueueGetResponse["remediation_tasks"]
): Record<"P1" | "P2" | "P3" | "P4" | "P5" | "P6", number> {
  const counts = { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0, P6: 0 };
  for (const task of tasks) {
    counts[task.governance_pillar] += 1;
  }
  return counts;
}
