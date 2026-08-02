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
export const SENTRY_DEFAULT_BASE_URL = "https://sentry.io";

export type SentryAdminConfig = {
  configured: boolean;
  authToken: string | null;
  orgSlug: string | null;
  projectSlug: string | null;
  baseUrl: string;
};

export type SentryIssueSummary = {
  id: string;
  shortId: string;
  title: string;
  culprit: string | null;
  status: string;
  level: string | null;
  count: string | null;
  userCount: number | null;
  firstSeen: string | null;
  lastSeen: string | null;
  permalink: string | null;
  projectSlug: string | null;
};

export function readSentryAdminConfig(
  env: NodeJS.ProcessEnv = process.env
): SentryAdminConfig {
  const authToken = env.SENTRY_AUTH_TOKEN?.trim() || null;
  const orgSlug = env.SENTRY_ORG_SLUG?.trim() || null;
  const projectSlug = env.SENTRY_PROJECT_SLUG?.trim() || null;
  const baseUrl = (env.SENTRY_BASE_URL?.trim() || SENTRY_DEFAULT_BASE_URL).replace(
    /\/+$/,
    ""
  );
  return {
    configured: Boolean(authToken && orgSlug),
    authToken,
    orgSlug,
    projectSlug,
    baseUrl,
  };
}

export function sentryModeLabel(config: SentryAdminConfig = readSentryAdminConfig()): string {
  if (!config.configured) return "unconfigured";
  return config.projectSlug ? "org+project" : "org";
}

/** Build a Sentry issue permalink when API omits `permalink`. */
export function buildSentryIssuePermalink(params: {
  baseUrl?: string;
  orgSlug: string;
  issueId: string;
  projectSlug?: string | null;
}): string {
  const base = (params.baseUrl || SENTRY_DEFAULT_BASE_URL).replace(/\/+$/, "");
  const org = encodeURIComponent(params.orgSlug);
  const id = encodeURIComponent(params.issueId);
  if (params.projectSlug?.trim()) {
    return `${base}/organizations/${org}/issues/${id}/?project=${encodeURIComponent(params.projectSlug.trim())}`;
  }
  return `${base}/organizations/${org}/issues/${id}/`;
}

export function normalizeSentryIssue(
  raw: Record<string, unknown>,
  config: Pick<SentryAdminConfig, "baseUrl" | "orgSlug" | "projectSlug">
): SentryIssueSummary | null {
  const id = raw.id != null ? String(raw.id) : "";
  if (!id || !config.orgSlug) return null;

  const project =
    raw.project && typeof raw.project === "object"
      ? (raw.project as { slug?: string })
      : null;
  const projectSlug =
    (typeof project?.slug === "string" ? project.slug : null) ||
    config.projectSlug ||
    null;

  const permalink =
    (typeof raw.permalink === "string" && raw.permalink.trim()) ||
    buildSentryIssuePermalink({
      baseUrl: config.baseUrl,
      orgSlug: config.orgSlug,
      issueId: id,
      projectSlug,
    });

  return {
    id,
    shortId: typeof raw.shortId === "string" ? raw.shortId : id,
    title: typeof raw.title === "string" ? raw.title : "(untitled)",
    culprit: typeof raw.culprit === "string" ? raw.culprit : null,
    status: typeof raw.status === "string" ? raw.status : "unknown",
    level: typeof raw.level === "string" ? raw.level : null,
    count: raw.count != null ? String(raw.count) : null,
    userCount: typeof raw.userCount === "number" ? raw.userCount : null,
    firstSeen: typeof raw.firstSeen === "string" ? raw.firstSeen : null,
    lastSeen: typeof raw.lastSeen === "string" ? raw.lastSeen : null,
    permalink,
    projectSlug,
  };
}

async function sentryFetch(
  config: SentryAdminConfig,
  path: string,
  init?: RequestInit
): Promise<Response> {
  if (!config.authToken) {
    throw new Error(
      "SENTRY_AUTH_TOKEN is required. Create an org auth token and set it on the MSGF host."
    );
  }
  const url = `${config.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  return fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${config.authToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

export type ListSentryIssuesParams = {
  query?: string;
  limit?: number;
  statsPeriod?: string;
  projectSlug?: string | null;
};

export async function listSentryIssues(
  params: ListSentryIssuesParams = {},
  config: SentryAdminConfig = readSentryAdminConfig()
): Promise<SentryIssueSummary[]> {
  if (!config.configured || !config.orgSlug) {
    throw new Error(
      "Sentry is not configured. Set SENTRY_AUTH_TOKEN and SENTRY_ORG_SLUG (see docs/MSGF_SENTRY.md)."
    );
  }

  const limit = Math.min(Math.max(params.limit ?? 25, 1), 100);
  const search = new URLSearchParams();
  search.set("limit", String(limit));
  search.set("query", params.query?.trim() || "is:unresolved");
  search.set("statsPeriod", params.statsPeriod?.trim() || "14d");
  search.set("sort", "date");

  const projectFilter = params.projectSlug?.trim() || config.projectSlug;
  // When only a slug is known, filter via query string (Sentry supports project:slug in query).
  if (projectFilter && !search.get("query")?.includes("project:")) {
    search.set("query", `${search.get("query")} project:${projectFilter}`);
  }

  const path = `/api/0/organizations/${encodeURIComponent(config.orgSlug)}/issues/?${search.toString()}`;
  const res = await sentryFetch(config, path);
  if (res.status === 401 || res.status === 403) {
    throw new Error("Sentry rejected the auth token (401/403). Check SENTRY_AUTH_TOKEN scopes.");
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Sentry issues list failed (${res.status}): ${body.slice(0, 240)}`);
  }

  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) return [];

  const out: SentryIssueSummary[] = [];
  for (const row of data) {
    if (!row || typeof row !== "object") continue;
    const normalized = normalizeSentryIssue(row as Record<string, unknown>, config);
    if (normalized) out.push(normalized);
  }
  return out;
}

export async function resolveSentryIssue(
  issueId: string,
  config: SentryAdminConfig = readSentryAdminConfig()
): Promise<{ id: string; status: string }> {
  const id = issueId.trim();
  if (!id) throw new Error("issueId is required.");
  if (!config.configured) {
    throw new Error("Sentry is not configured.");
  }

  const res = await sentryFetch(config, `/api/0/issues/${encodeURIComponent(id)}/`, {
    method: "PUT",
    body: JSON.stringify({ status: "resolved" }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Sentry resolve failed (${res.status}): ${body.slice(0, 240)}`);
  }
  const json = (await res.json()) as { id?: string; status?: string };
  return { id: String(json.id ?? id), status: String(json.status ?? "resolved") };
}

/** Public status payload (never includes the token). */
export function sentryAdminStatusPayload(
  config: SentryAdminConfig = readSentryAdminConfig()
): {
  configured: boolean;
  mode: string;
  org_slug: string | null;
  project_slug: string | null;
  base_url: string;
} {
  return {
    configured: config.configured,
    mode: sentryModeLabel(config),
    org_slug: config.orgSlug,
    project_slug: config.projectSlug,
    base_url: config.baseUrl,
  };
}
