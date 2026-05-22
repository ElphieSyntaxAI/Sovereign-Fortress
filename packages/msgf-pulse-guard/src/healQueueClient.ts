import { createHash } from "crypto";

import type { MsgfGuardSettings } from "./config";
import { buildApiAuthHeaders } from "./pulseAuth";
import type {
  HealConsoleTask,
  HealQueueGetResponse,
  HealQueueGovernancePillar,
  HealQueuePresetInterval,
  HealQueueRemediationTask,
} from "./healQueueTypes";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Deterministic UUID for heal-queue when workspace tenantKey is not a UUID. */
export function resolveHealQueueTenantUuid(tenantKey: string): string {
  const trimmed = tenantKey.trim();
  if (UUID_RE.test(trimmed)) return trimmed.toLowerCase();

  const hash = createHash("sha256").update(`msgf-heal-queue:${trimmed}`, "utf8").digest("hex");
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    `4${hash.slice(13, 16)}`,
    hash.slice(16, 20),
    hash.slice(20, 32),
  ].join("-");
}

function parseTask(raw: unknown): HealQueueRemediationTask | null {
  if (!raw || typeof raw !== "object") return null;
  const t = raw as Record<string, unknown>;
  const pillar = t.governance_pillar;
  const bug = t.bug_index;
  if (
    typeof t.task_id !== "string" ||
    typeof t.file_path !== "string" ||
    typeof t.reason !== "string" ||
    (pillar !== "P1" &&
      pillar !== "P2" &&
      pillar !== "P3" &&
      pillar !== "P4" &&
      pillar !== "P5" &&
      pillar !== "P6") ||
    !bug ||
    typeof bug !== "object"
  ) {
    return null;
  }
  const b = bug as Record<string, unknown>;
  if (
    typeof b.level_1_category !== "string" ||
    typeof b.level_1_1_branch !== "string" ||
    typeof b.level_1_1_1_instance !== "string"
  ) {
    return null;
  }

  return {
    task_id: t.task_id,
    file_path: t.file_path,
    governance_pillar: pillar,
    bug_index: {
      level_1_category: b.level_1_category,
      level_1_1_branch: b.level_1_1_branch,
      level_1_1_1_instance: b.level_1_1_1_instance,
    },
    reason: t.reason,
    source:
      t.source === "brain_readiness" || t.source === "pillar_vector" || t.source === "scheduled"
        ? t.source
        : "pillar_vector",
    pillar_vector_id: typeof t.pillar_vector_id === "string" ? t.pillar_vector_id : null,
    scheduling_tier:
      t.scheduling_tier === "RED" || t.scheduling_tier === "YELLOW" || t.scheduling_tier === "GREEN"
        ? t.scheduling_tier
        : null,
    preset_interval:
      t.preset_interval === "immediate" ||
      t.preset_interval === "1h" ||
      t.preset_interval === "6h" ||
      t.preset_interval === "nightly"
        ? t.preset_interval
        : null,
  };
}

export function toHealConsoleTasks(tasks: HealQueueRemediationTask[]): HealConsoleTask[] {
  return tasks.map((t) => ({
    ...t,
    row_key: `${t.file_path}::${t.bug_index.level_1_1_1_instance}`,
  }));
}

/** Build tasks from shadow-scan rule errors when heal-queue API is unavailable. */
export function tasksFromScanRuleErrors(ruleErrors: string[]): HealQueueRemediationTask[] {
  const tasks: HealQueueRemediationTask[] = [];
  const seen = new Set<string>();

  for (const line of ruleErrors) {
    const missingMatch = /Missing governance pillars:\s*([P1-P6,\s]+)/i.exec(line);
    if (missingMatch) {
      const pillars = missingMatch[1]
        .split(/[,\s]+/)
        .map((p) => p.trim())
        .filter((p): p is HealQueueGovernancePillar =>
          ["P1", "P2", "P3", "P4", "P5", "P6"].includes(p as HealQueueGovernancePillar)
        );
      for (const pillar of pillars) {
        const path = `governance://baseline/${pillar}`;
        const key = path;
        if (seen.has(key)) continue;
        seen.add(key);
        tasks.push({
          task_id: key,
          file_path: path,
          governance_pillar: pillar,
          bug_index: {
            level_1_category: "1.0_PULSE",
            level_1_1_branch: "1.1_INGEST",
            level_1_1_1_instance: "1.1.1_HEAL_QUEUE_BASELINE",
          },
          reason: line,
          source: "brain_readiness",
          pillar_vector_id: null,
          scheduling_tier: null,
          preset_interval: null,
        });
      }
      continue;
    }

    if (/baseline|brain|genealogical|bug_index|1\.1\.1/i.test(line)) {
      const path = `scan://diagnostic/${tasks.length}`;
      if (!seen.has(path)) {
        seen.add(path);
        tasks.push({
          task_id: path,
          file_path: path,
          governance_pillar: "P2",
          bug_index: {
            level_1_category: "1.0_CORE",
            level_1_1_branch: "1.1_SWEEP",
            level_1_1_1_instance: "1.1.1_INGEST_BASELINE",
          },
          reason: line,
          source: "brain_readiness",
          pillar_vector_id: null,
          scheduling_tier: null,
          preset_interval: null,
        });
      }
    }
  }

  return tasks;
}

export async function fetchHealQueueTasks(params: {
  settings: MsgfGuardSettings;
  tenantKey: string;
  fetchImpl?: typeof fetch;
}): Promise<{
  ok: boolean;
  tenantUuid: string;
  tasks: HealConsoleTask[];
  brainSummary: string | null;
  error?: string;
}> {
  const fetchFn = params.fetchImpl ?? fetch;
  const tenantUuid = resolveHealQueueTenantUuid(params.tenantKey);
  const baseUrl = params.settings.apiUrl.replace(/\/$/, "");
  const url = `${baseUrl}/api/msgf/heal-queue?tenant_id=${encodeURIComponent(tenantUuid)}`;

  const headers = buildApiAuthHeaders({
    settings: params.settings,
    tenantId: params.tenantKey,
  });

  if (!headers.Authorization) {
    return {
      ok: false,
      tenantUuid,
      tasks: [],
      brainSummary: null,
      error: "msgf.authToken required for heal queue.",
    };
  }

  try {
    const res = await fetchFn(url, { method: "GET", headers, cache: "no-store" });
    const raw = (await res.json().catch(() => ({}))) as HealQueueGetResponse;

    if (!res.ok || raw.ok !== true) {
      return {
        ok: false,
        tenantUuid,
        tasks: [],
        brainSummary: null,
        error: raw.message ?? raw.error ?? `Heal queue GET failed (${res.status}).`,
      };
    }

    const parsed = (raw.remediation_tasks ?? [])
      .map(parseTask)
      .filter((t): t is HealQueueRemediationTask => t != null);

    const brain = raw.brain_readiness;
    const brainSummary = brain
      ? `Brain ${brain.readiness_score}% · missing ${brain.missing_pillars.join(", ") || "none"}`
      : null;

    return {
      ok: true,
      tenantUuid,
      tasks: toHealConsoleTasks(parsed),
      brainSummary,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Heal queue network error";
    return { ok: false, tenantUuid, tasks: [], brainSummary: null, error: message };
  }
}

export type HealQueuePostResult = {
  ok: boolean;
  action_type?: string;
  error?: string;
  message?: string;
  user_resume_message?: string;
  token_estimate?: {
    tokens_saved_vs_individual?: number;
  };
};

export async function postHealQueueAction(params: {
  settings: MsgfGuardSettings;
  tenantUuid: string;
  action_type: "BULK" | "INDIVIDUAL" | "SCHEDULED";
  file_paths?: string[];
  preset_interval?: HealQueuePresetInterval;
  fetchImpl?: typeof fetch;
}): Promise<HealQueuePostResult> {
  const fetchFn = params.fetchImpl ?? fetch;
  const baseUrl = params.settings.apiUrl.replace(/\/$/, "");
  const url = `${baseUrl}/api/msgf/heal-queue`;

  const headers = {
    ...buildApiAuthHeaders({
      settings: params.settings,
      tenantId: params.settings.tenantKey || params.tenantUuid,
    }),
    "Content-Type": "application/json",
  };

  const body: Record<string, unknown> = {
    tenant_id: params.tenantUuid,
    action_type: params.action_type,
  };
  if (params.file_paths?.length) body.file_paths = params.file_paths;
  if (params.preset_interval) body.preset_interval = params.preset_interval;

  try {
    const res = await fetchFn(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;

    if (!res.ok || raw.ok !== true) {
      return {
        ok: false,
        error:
          typeof raw.message === "string"
            ? raw.message
            : typeof raw.error === "string"
              ? raw.error
              : `Heal queue POST failed (${res.status}).`,
      };
    }

    return {
      ok: true,
      action_type: typeof raw.action_type === "string" ? raw.action_type : params.action_type,
      user_resume_message:
        typeof raw.user_resume_message === "string" ? raw.user_resume_message : undefined,
      token_estimate:
        raw.token_estimate && typeof raw.token_estimate === "object"
          ? (raw.token_estimate as HealQueuePostResult["token_estimate"])
          : undefined,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Heal queue POST network error",
    };
  }
}
