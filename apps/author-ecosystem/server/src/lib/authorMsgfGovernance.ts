/**
 * Author BFF ↔ MSGF governance glue:
 * Shadow Proxy / Active Governance, CONVERGE tiers, verify-result,
 * deploy-gate, period-report links, and HITL / quarantine signals.
 */

import {
  AUTHOR_MSGF_PROJECT_ORIGIN,
  resolveAuthorMsgfAppUrl,
  resolveAuthorMsgfTenantId,
  resolveAuthorPulseLicenseKey,
  authorMsgfBridgeConfigured,
} from "./authorMsgfEnv.js";
import { buildAuthorGovernanceDashboardLinks } from "./authorMsgfDashboardLinks.js";

export type AuthorGatewayMode = "off" | "shadow" | "active";

/** Author surfaces mapped onto MSGF Part B CONVERGE tiers. */
export type AuthorConvergeSurface =
  | "hal_pulse"
  | "planning_sync"
  | "onboarding_ingest"
  | "librarian"
  | "bicameral_audit"
  | "revision_unlock"
  | "publisher_gate"
  | "structure_dual_disagree";

export type ConvergeTierHeader = "TIER_1" | "TIER_2" | "TIER_3";

function trim(name: string): string {
  return process.env[name]?.trim() || "";
}

export { resolveAuthorPulseLicenseKey };

export function authorGatewayConfigured(): boolean {
  return authorMsgfBridgeConfigured();
}

/**
 * Gateway mode for OpenAI / Anthropic traffic.
 * Default: `shadow` when MSGF Pulse license + app URL are set (projected savings, zero latency).
 * Set `MSGF_AUTHOR_GATEWAY_MODE=active` for live state-gating; `off` to bypass.
 * T2/T3 surfaces never honor `off` when MSGF is configured (human-proof Phase 3/9).
 */
export function resolveAuthorGatewayMode(
  surface?: AuthorConvergeSurface
): AuthorGatewayMode {
  const raw = trim("MSGF_AUTHOR_GATEWAY_MODE").toLowerCase();
  const configured = authorGatewayConfigured();
  let mode: AuthorGatewayMode = "off";
  if (raw === "off" || raw === "0" || raw === "false" || raw === "disabled") {
    mode = "off";
  } else if (raw === "active") {
    mode = "active";
  } else if (raw === "shadow") {
    mode = "shadow";
  } else {
    mode = configured ? "shadow" : "off";
  }

  if (surface && mode === "off" && configured) {
    const tier = convergeTierForSurface(surface);
    if (tier === "TIER_2" || tier === "TIER_3") {
      console.warn(
        `[authorMsgfGovernance] refusing gateway off for ${surface} (${tier}) — forcing shadow`
      );
      return "shadow";
    }
  }
  return mode;
}

export function convergeTierForSurface(surface: AuthorConvergeSurface): ConvergeTierHeader {
  switch (surface) {
    case "hal_pulse":
    case "planning_sync":
    case "librarian":
      return "TIER_1";
    case "onboarding_ingest":
    case "bicameral_audit":
    case "revision_unlock":
      return "TIER_2";
    case "publisher_gate":
    case "structure_dual_disagree":
      return "TIER_3";
    default:
      return "TIER_2";
  }
}

/** OpenAI SDK / fetch: baseURL for `/api/v1/chat/completions`. */
export function resolveOpenAiGatewayBaseUrl(
  surface?: AuthorConvergeSurface
): string | null {
  if (resolveAuthorGatewayMode(surface) === "off") return null;
  const base = resolveAuthorMsgfAppUrl();
  if (!base || !resolveAuthorPulseLicenseKey()) return null;
  return `${base}/api/v1`;
}

/**
 * Anthropic SDK baseURL — SDK appends `/v1/messages`, so use `/api` (not `/api/v1`).
 * @see docs/MSGF_SHADOW_PROXY.md
 */
export function resolveAnthropicGatewayBaseUrl(
  surface?: AuthorConvergeSurface
): string | null {
  if (resolveAuthorGatewayMode(surface) === "off") return null;
  const base = resolveAuthorMsgfAppUrl();
  if (!base || !resolveAuthorPulseLicenseKey()) return null;
  return `${base}/api`;
}

export function authorGatewayDefaultHeaders(
  surface?: AuthorConvergeSurface
): Record<string, string> {
  const mode = resolveAuthorGatewayMode(surface);
  const key = resolveAuthorPulseLicenseKey();
  const headers: Record<string, string> = {
    "x-msgf-key": key,
    "x-msgf-mode": mode === "active" ? "active" : "shadow",
    "x-msgf-project-origin": AUTHOR_MSGF_PROJECT_ORIGIN,
  };
  if (surface) {
    headers["x-msgf-converge-tier"] = convergeTierForSurface(surface);
  }
  const aggressiveness = trim("MSGF_AUTHOR_ACTIVE_AGGRESSIVENESS");
  if (mode === "active" && aggressiveness) {
    headers["x-msgf-active-aggressiveness"] = aggressiveness;
  }
  return headers;
}

export type AuthorVerifyResultInput = {
  passed: boolean;
  command: string;
  actorId?: string | null;
  manuscriptId?: string | null;
  surface?: AuthorConvergeSurface;
  stdoutSnippet?: string | null;
  stderrSnippet?: string | null;
  exitCode?: number;
};

export type AuthorMsgfHttpResult = {
  ok: boolean;
  configured: boolean;
  status: number | null;
  body: unknown;
  error?: string;
};

function msgfAuthHeaders(extra?: Record<string, string>): Record<string, string> {
  const license = resolveAuthorPulseLicenseKey();
  const tenant = resolveAuthorMsgfTenantId();
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `Bearer ${license}`,
    "x-msgf-license-key": license,
    "x-msgf-key": license,
    "x-msgf-tenant-id": tenant,
    "X-MSGF-Tenant-Key": tenant,
    "x-msgf-project-origin": AUTHOR_MSGF_PROJECT_ORIGIN,
    ...(extra ?? {}),
  };
}

/**
 * Non-blocking resource-usage emit into MSGF governance ledger (hashed queries only).
 * Failures are swallowed so Author request paths never wait on MSGF.
 */
export function emitAuthorResourceUsage(params: {
  kind?: "citation" | "search" | "file" | "tool" | "agent";
  resource_key: string;
  project_origin?: string | null;
  trace_id?: string | null;
  query_text?: string | null;
}): void {
  void (async () => {
    try {
      if (!authorMsgfBridgeConfigured()) return;
      const baseRaw = resolveAuthorMsgfAppUrl();
      if (!baseRaw) return;
      const base = baseRaw.replace(/\/$/, "");
      const res = await fetch(`${base}/api/msgf/governance/resource-usage`, {
        method: "POST",
        headers: msgfAuthHeaders(),
        body: JSON.stringify({
          product: "author",
          kind: params.kind ?? "citation",
          resource_key: params.resource_key,
          project_origin: params.project_origin ?? AUTHOR_MSGF_PROJECT_ORIGIN,
          trace_id: params.trace_id ?? null,
          query_text: params.query_text ?? null,
        }),
        signal: AbortSignal.timeout(4_000),
      });
      if (!res.ok) {
        console.warn("[authorMsgfGovernance] resource-usage emit HTTP", res.status);
      }
    } catch (e) {
      console.warn(
        "[authorMsgfGovernance] resource-usage emit failed:",
        e instanceof Error ? e.message : e
      );
    }
  })();
}

/** POST /api/msgf/verify-result — Vault/Hall learning after Author verify gates. */
export async function postAuthorVerifyResult(
  input: AuthorVerifyResultInput
): Promise<AuthorMsgfHttpResult> {
  const base = resolveAuthorMsgfAppUrl();
  const license = resolveAuthorPulseLicenseKey();
  if (!base || !license) {
    return { ok: false, configured: false, status: null, body: null, error: "MSGF not configured" };
  }

  const tenant = resolveAuthorMsgfTenantId();
  const filePaths = input.manuscriptId
    ? [`apps/author-ecosystem/manuscripts/${input.manuscriptId}`]
    : ["apps/author-ecosystem/onboarding"];

  try {
    const res = await fetch(`${base}/api/msgf/verify-result`, {
      method: "POST",
      headers: msgfAuthHeaders(
        input.actorId ? { "x-msgf-entity-id": String(input.actorId) } : undefined
      ),
      body: JSON.stringify({
        tenant_id: tenant,
        passed: input.passed,
        command: input.command.slice(0, 512),
        exit_code: input.exitCode ?? (input.passed ? 0 : 1),
        stdout_snippet: (input.stdoutSnippet ?? "").slice(0, 4000) || undefined,
        stderr_snippet: (input.stderrSnippet ?? "").slice(0, 4000) || undefined,
        file_paths: filePaths,
        product_surface: "author",
        actor_id: input.actorId ?? undefined,
      }),
    });
    const body = await res.json().catch(() => ({}));
    return {
      ok: res.ok,
      configured: true,
      status: res.status,
      body,
      error: res.ok ? undefined : JSON.stringify(body).slice(0, 400),
    };
  } catch (e) {
    return {
      ok: false,
      configured: true,
      status: null,
      body: null,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export type AuthorDeployGateResult = {
  ok: boolean;
  configured: boolean;
  skipped: boolean;
  status: string | null;
  body: unknown;
  error?: string;
};

/**
 * GET /api/msgf/deploy-gate for Author project_origin.
 * Uses MSGF_OPS_CRON_SECRET when set; otherwise skips (soft pass) so editor UX is not bricked.
 */
export async function fetchAuthorDeployGate(opts?: {
  maxAgeHours?: number;
}): Promise<AuthorDeployGateResult> {
  const base = resolveAuthorMsgfAppUrl();
  if (!base) {
    return {
      ok: false,
      configured: false,
      skipped: true,
      status: null,
      body: null,
      error: "MSGF_APP_URL unset",
    };
  }

  const cron = trim("MSGF_OPS_CRON_SECRET");
  if (!cron) {
    return {
      ok: true,
      configured: true,
      skipped: true,
      status: "skipped_no_ops_secret",
      body: { ok: true, skipped: true },
    };
  }

  const q = new URLSearchParams({
    project_origin: AUTHOR_MSGF_PROJECT_ORIGIN,
  });
  if (opts?.maxAgeHours != null) q.set("max_age_hours", String(opts.maxAgeHours));

  try {
    const res = await fetch(`${base}/api/msgf/deploy-gate?${q}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${cron}`,
      },
    });
    const body = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      status?: string;
      error?: string;
    };
    return {
      ok: res.ok && body.ok !== false,
      configured: true,
      skipped: false,
      status: typeof body.status === "string" ? body.status : null,
      body,
      error: res.ok ? undefined : body.error || `deploy-gate ${res.status}`,
    };
  } catch (e) {
    return {
      ok: false,
      configured: true,
      skipped: false,
      status: null,
      body: null,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * Soft publisher / editor gate: when deploy-gate is enforced
 * (`MSGF_AUTHOR_REQUIRE_DEPLOY_GATE=1`), require green; otherwise informational only.
 */
export async function evaluateAuthorPublisherDeployGate(): Promise<{
  allowed: boolean;
  deploy: AuthorDeployGateResult;
  reason: string;
}> {
  const enforce =
    trim("MSGF_AUTHOR_REQUIRE_DEPLOY_GATE").toLowerCase() === "1" ||
    trim("MSGF_AUTHOR_REQUIRE_DEPLOY_GATE").toLowerCase() === "true";
  const deploy = await fetchAuthorDeployGate({ maxAgeHours: 168 });
  if (deploy.skipped) {
    return {
      allowed: true,
      deploy,
      reason: "Deploy-gate check skipped (no MSGF_OPS_CRON_SECRET) — quality gate only.",
    };
  }
  if (deploy.ok) {
    return { allowed: true, deploy, reason: "MSGF deploy-gate green for Author project_origin." };
  }
  if (!enforce) {
    return {
      allowed: true,
      deploy,
      reason: `Deploy-gate not green (${deploy.status ?? deploy.error ?? "unknown"}) — advisory only until MSGF_AUTHOR_REQUIRE_DEPLOY_GATE=1.`,
    };
  }
  return {
    allowed: false,
    deploy,
    reason: `MSGF deploy-gate blocked publisher/editor unlock: ${deploy.status ?? deploy.error ?? "not green"}. Run verify-result / Safe Build for elphiesyntax/author-ecosystem.`,
  };
}

/** OpenAI chat via MSGF gateway when mode ≠ off; else direct api.openai.com. */
export async function authorOpenAiChatCompletion(params: {
  system: string;
  user: string;
  model: string;
  temperature?: number;
  surface?: AuthorConvergeSurface;
}): Promise<string> {
  const key = trim("OPENAI_API_KEY");
  if (!key) throw new Error("OPENAI_API_KEY is required");

  const gatewayBase = resolveOpenAiGatewayBaseUrl(params.surface ?? "librarian");
  const url = gatewayBase
    ? `${gatewayBase}/chat/completions`
    : "https://api.openai.com/v1/chat/completions";

  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
  if (gatewayBase) {
    Object.assign(headers, authorGatewayDefaultHeaders(params.surface ?? "librarian"));
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: params.model,
      temperature: params.temperature ?? 0.35,
      messages: [
        { role: "system", content: params.system },
        { role: "user", content: params.user },
      ],
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`OpenAI chat failed (${res.status}): ${errBody.slice(0, 600)}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = json.choices?.[0]?.message?.content;
  if (content == null || String(content).trim() === "") {
    throw new Error("OpenAI returned empty chat reply");
  }
  return String(content);
}

export type AuthorAnthropicClientOptions = {
  apiKey: string;
  surface?: AuthorConvergeSurface;
};

/** Build Anthropic SDK constructor options with optional MSGF gateway baseURL. */
export function authorAnthropicClientInit(
  opts: AuthorAnthropicClientOptions
): { apiKey: string; baseURL?: string; defaultHeaders?: Record<string, string> } {
  const gatewayBase = resolveAnthropicGatewayBaseUrl(opts.surface ?? "bicameral_audit");
  if (!gatewayBase) {
    return { apiKey: opts.apiKey };
  }
  return {
    apiKey: opts.apiKey,
    baseURL: gatewayBase,
    defaultHeaders: authorGatewayDefaultHeaders(opts.surface ?? "bicameral_audit"),
  };
}

export { buildAuthorGovernanceDashboardLinks } from "./authorMsgfDashboardLinks.js";

export function getAuthorGovernanceStatus() {
  const mode = resolveAuthorGatewayMode();
  const tenant = resolveAuthorMsgfTenantId();
  const halOn = trim("MSGF_AUTHOR_HAL_PULSE_ENABLED").toLowerCase() !== "0";
  return {
    gateway_mode: mode,
    gateway_ready: authorGatewayConfigured() && mode !== "off",
    openai_gateway_base: resolveOpenAiGatewayBaseUrl(),
    anthropic_gateway_base: resolveAnthropicGatewayBaseUrl(),
    require_deploy_gate:
      trim("MSGF_AUTHOR_REQUIRE_DEPLOY_GATE").toLowerCase() === "1" ||
      trim("MSGF_AUTHOR_REQUIRE_DEPLOY_GATE").toLowerCase() === "true",
    sync_brain_default:
      trim("MSGF_DOCUMENT_INGEST_SYNC_BRAIN").toLowerCase() === "1" ||
      trim("MSGF_DOCUMENT_INGEST_SYNC_BRAIN").toLowerCase() === "true" ||
      (authorGatewayConfigured() && halOn),
    governance_links: buildAuthorGovernanceDashboardLinks(tenant),
    tenant_id: tenant,
    project_origin: AUTHOR_MSGF_PROJECT_ORIGIN,
  };
}
