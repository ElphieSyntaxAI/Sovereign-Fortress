import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { APIRequestContext, APIResponse } from "@playwright/test";

export const RUN_ID = `msgf-stress-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;

const ROOT = process.cwd();
export const STRESS_LOG_PATH = path.join(ROOT, "tests", "reports", "msgf-stress.log");
export const HALL_PATH = path.join(ROOT, ".msgf", "hallucinations.json");

export type StressProfile = "standard" | "paid" | "unentitled" | "invalid";
export type StressEndpoint = "pulse" | "ingest";

export type StressResult = {
  id: string;
  profile: StressProfile;
  endpoint: StressEndpoint;
  status: number;
  ok: boolean;
  expected: boolean;
  ms: number;
  errorCode: string | null;
  bodyExcerpt: string;
};

export type HallFailure = {
  run_id: string;
  ts: string;
  endpoint: StressEndpoint;
  status: number;
  error_code: string | null;
  body_excerpt: string;
  profile: StressProfile;
};

type HallFile = {
  updated_at: string;
  failures: HallFailure[];
};

const results: StressResult[] = [];

export function envInt(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export function stressConcurrency(): number {
  const cap = isProductionHost() ? 2 : 25;
  const fallback = isProductionHost() ? 2 : 10;
  return Math.max(1, Math.min(cap, envInt("MSGF_STRESS_CONCURRENCY", fallback)));
}

export function stressRequestCount(): number {
  const cap = isProductionHost() ? 8 : 200;
  const fallback = isProductionHost() ? 8 : 40;
  return Math.max(4, Math.min(cap, envInt("MSGF_STRESS_REQUESTS", fallback)));
}

export function msgfBaseUrl(): string {
  return (
    process.env.MSGF_APP_URL ||
    process.env.NEXT_PUBLIC_MSGF_APP_URL ||
    "http://127.0.0.1:3001"
  ).replace(/\/+$/, "");
}

export function msgfTenantId(): string {
  return (
    process.env.MSGF_SOLO_TENANT_ID?.trim() ||
    process.env.MSGF_TENANT_ID?.trim() ||
    process.env.MSGF_SOLO_TENANT_KEY?.trim() ||
    process.env.MSGF_TENANT_KEY?.trim() ||
    "integration_sandbox"
  );
}

export function licenseTenantCandidates(): string[] {
  const ids = [
    process.env.MSGF_AUTHOR_TENANT_ID?.trim(),
    process.env.NEXT_PUBLIC_MSGF_AUTHOR_TENANT_ID?.trim(),
    process.env.MSGF_SOLO_TENANT_ID?.trim(),
    process.env.MSGF_TENANT_ID?.trim(),
    process.env.MSGF_SOLO_TENANT_KEY?.trim(),
    "author_ecosystem",
    "integration_sandbox",
    msgfTenantId(),
  ].filter((v): v is string => Boolean(v));
  return [...new Set(ids)];
}

export function standardLicense(): string {
  return (
    process.env.MSGF_CONTRACT_LICENSE_KEY?.trim() ||
    process.env.MSGF_AUTHOR_PULSE_LICENSE_KEY?.trim() ||
    ""
  );
}

export function paidLicense(): string {
  return process.env.MSGF_PAID_LICENSE_KEY?.trim() || "";
}

export function opsCronSecret(): string {
  return process.env.MSGF_OPS_CRON_SECRET?.trim() || "";
}

export function authorTenantId(): string {
  return (
    process.env.MSGF_AUTHOR_TENANT_ID?.trim() ||
    process.env.NEXT_PUBLIC_MSGF_AUTHOR_TENANT_ID?.trim() ||
    "author_ecosystem"
  );
}

export function educationTenantId(): string {
  return (
    process.env.MSGF_EDUCATION_TENANT_ID?.trim() ||
    process.env.NEXT_PUBLIC_MSGF_EDUCATION_TENANT_ID?.trim() ||
    process.env.MSGF_EDUCATION_MANIFEST_TENANT?.trim() ||
    "tenant_education"
  );
}

export function foreignTenantId(): string {
  return `foreign_rc_${randomUUID().slice(0, 8)}`;
}

export function gatewayUpstreamKey(): string {
  return (
    process.env.OPENAI_API_KEY?.trim() ||
    process.env.MSGF_OPENAI_API_KEY?.trim() ||
    process.env.MSGF_GATEWAY_UPSTREAM_KEY?.trim() ||
    ""
  );
}

export function creditReservationEnabled(): boolean {
  const v = process.env.MSGF_CREDIT_RESERVATION_ENABLED?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function opsCronHeaders(): Record<string, string> {
  const secret = opsCronSecret();
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${secret}`,
    "X-MSGF-Ops-Cron-Secret": secret,
  };
}

export function gatewayHeaders(mode: "shadow" | "active"): Record<string, string> {
  const license = standardLicense();
  const upstream = gatewayUpstreamKey() || "sk-rc-placeholder-no-live-spend";
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    "x-msgf-key": license,
    "x-msgf-mode": mode,
    "x-msgf-tenant-id": "spoofed-rc-tenant",
    "X-MSGF-Tenant-Key": "spoofed-rc-tenant",
    Authorization: `Bearer ${upstream}`,
  };
}

export function swarmAbortHeaders(): Record<string, string> {
  const id = randomUUID().slice(0, 8);
  return {
    "x-msgf-agent-id": `rc-child-${id}`,
    "x-msgf-parent-agent-id": `rc-parent-${id}`,
    "x-msgf-agent-role": "secondary",
  };
}

export function bodyHasKeyLists(body: string): boolean {
  return (
    /"(blocked_keys|promoted_keys|p7_blocked|p7_promoted)"\s*:\s*\[/.test(body) ||
    /msgf_live_[A-Za-z0-9_-]{8,}/.test(body) ||
    /sk-[A-Za-z0-9]{12,}/.test(body)
  );
}

export function pulseCookie(): string {
  return process.env.MSGF_PULSE_COOKIE?.trim() || "";
}

export function isProductionHost(url = msgfBaseUrl()): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host === "elphiesgatedai.elphiesyntax.com") return true;
    // Production Cloud Run service URL — not msgf-api-staging-*.
    if (
      host.endsWith(".run.app") &&
      host.startsWith("msgf-api-") &&
      !host.startsWith("msgf-api-staging-")
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function stripeE2eEnabled(): boolean {
  if (isProductionHost()) return false;
  const v = process.env.MSGF_STRIPE_E2E?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function redact(text: string): string {
  return text
    .replace(/msgf_live_[A-Za-z0-9_-]+/g, "msgf_live_[REDACTED]")
    .replace(/msgf_ide_[A-Za-z0-9_-]+/g, "msgf_ide_[REDACTED]")
    .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]")
    .replace(/sb-[a-z0-9-]+-auth-token=[^;\s]+/gi, "sb-[REDACTED]-auth-token=[REDACTED]");
}

export function assertStressAuth(): void {
  if (pulseCookie() || standardLicense()) return;
  throw new Error(
    "MSGF stress auth missing. Run `npm run bootstrap:solo -w msgf` and set MSGF_CONTRACT_LICENSE_KEY (or MSGF_PULSE_COOKIE) in .env.local."
  );
}

export function authHeaders(kind: "standard" | "paid" | "none"): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (kind === "none") return headers;

  const cookie = pulseCookie();
  const license = kind === "paid" ? paidLicense() || standardLicense() : standardLicense();
  const tenant = msgfTenantId();
  const entity =
    process.env.MSGF_SOLO_ENTITY_ID?.trim() ||
    process.env.MSGF_ENTITY_ID?.trim() ||
    `qa-stress-${kind}`;

  if (cookie && kind === "standard") {
    headers.Cookie = cookie;
    return headers;
  }
  if (!license) return headers;

  headers.Authorization = `Bearer ${license}`;
  headers["x-msgf-license-key"] = license;
  headers["x-msgf-ide-pulse"] = "1";
  headers["x-msgf-entity-id"] = entity;
  headers["x-msgf-tenant-id"] = tenant;
  headers["X-MSGF-Tenant-Key"] = tenant;
  return headers;
}

export function sampleKeystrokes(label = "stress"): Array<Record<string, unknown>> {
  let ts = Date.now();
  const keys = ["h", "e", "l", "l", "o", " ", "m", "s", "g", "f"];
  return keys.map((key, i) => {
    ts += 40 + i * 3;
    return {
      ts,
      key,
      type: "keydown",
      flightMs: 40 + (i % 5) * 8,
      dwellMs: 70 + (i % 4) * 5,
      target: label,
    };
  });
}

export function validIngestBody(): Record<string, unknown> {
  return {
    tenant_id: msgfTenantId(),
    project_origin: "qa/msgf-stress",
    files: [
      {
        path: "packages/msgf/qa/rc-stress.md",
        content:
          "# MSGF RC stress shard\nStable content so repeat ingest hash-skips after the first SWEEP.\n",
      },
    ],
  };
}

export function invalidIngestBody(): Record<string, unknown> {
  return {
    tenant_id: msgfTenantId(),
    files: [{ path: "../etc/passwd", content: "should-reject" }],
  };
}

function ensureLogHeader() {
  fs.mkdirSync(path.dirname(STRESS_LOG_PATH), { recursive: true });
  if (!fs.existsSync(STRESS_LOG_PATH)) {
    fs.writeFileSync(STRESS_LOG_PATH, "", "utf8");
  }
}

export function logLine(line: string) {
  ensureLogHeader();
  fs.appendFileSync(STRESS_LOG_PATH, `${redact(line)}\n`, "utf8");
}

export function beginStressLog() {
  fs.mkdirSync(path.dirname(STRESS_LOG_PATH), { recursive: true });
  fs.mkdirSync(path.dirname(HALL_PATH), { recursive: true });
  logLine("");
  logLine(`===== MSGF STRESS ${RUN_ID} =====`);
  logLine(`baseURL=${msgfBaseUrl()}`);
  logLine(`tenant=${msgfTenantId()}`);
  logLine(`concurrency=${stressConcurrency()} requests=${stressRequestCount()}`);
}

function excerpt(text: string, max = 800): string {
  const trimmed = redact(text).replace(/\s+/g, " ").trim();
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}

function errorCodeFromBody(body: string): string | null {
  try {
    const json = JSON.parse(body) as { error?: unknown; code?: unknown };
    if (typeof json.code === "string") return json.code;
    if (typeof json.error === "string") return json.error;
  } catch {
    /* text body */
  }
  return null;
}

export function isExpectedStatus(
  endpoint: StressEndpoint,
  status: number,
  profile: StressProfile
): boolean {
  if (profile === "unentitled") return [401, 402, 403, 429].includes(status);
  if (profile === "invalid") return [400, 422].includes(status);
  if (endpoint === "pulse") return status === 200 || status === 202;
  if (status === 200) return true;
  if (status === 403) return true;
  return false;
}

export function shouldHallLog(result: StressResult): boolean {
  if (!result.expected) return true;
  if (result.profile === "invalid") return true;
  if (result.status === 403 || result.status === 409) return true;
  if (result.errorCode === "INGEST_VALIDATION_ERROR") return true;
  return result.status >= 500 || result.status === 0;
}

export function recordHallFailure(result: StressResult) {
  const entry: HallFailure = {
    run_id: RUN_ID,
    ts: new Date().toISOString(),
    endpoint: result.endpoint,
    status: result.status,
    error_code: result.errorCode,
    body_excerpt: result.bodyExcerpt,
    profile: result.profile,
  };
  let file: HallFile = { updated_at: entry.ts, failures: [] };
  try {
    if (fs.existsSync(HALL_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(HALL_PATH, "utf8")) as HallFile;
      if (Array.isArray(parsed.failures)) file = parsed;
    }
  } catch {
    file = { updated_at: entry.ts, failures: [] };
  }
  file.updated_at = entry.ts;
  file.failures.push(entry);
  if (file.failures.length > 500) file.failures = file.failures.slice(-500);
  fs.mkdirSync(path.dirname(HALL_PATH), { recursive: true });
  fs.writeFileSync(HALL_PATH, `${JSON.stringify(file, null, 2)}\n`, "utf8");
}

export async function recordResponse(
  profile: StressProfile,
  endpoint: StressEndpoint,
  res: APIResponse | null,
  ms: number,
  error?: unknown
): Promise<StressResult> {
  let status = 0;
  let body = "";
  if (res) {
    status = res.status();
    try {
      body = await res.text();
    } catch {
      body = "";
    }
  } else if (error) {
    body = error instanceof Error ? error.message : String(error);
  }
  const result: StressResult = {
    id: randomUUID(),
    profile,
    endpoint,
    status,
    ok: status >= 200 && status < 300,
    expected: isExpectedStatus(endpoint, status, profile),
    ms,
    errorCode: errorCodeFromBody(body),
    bodyExcerpt: excerpt(body),
  };
  results.push(result);
  logLine(
    `[${result.expected ? "OK" : "FAIL"}] ${profile} ${endpoint} status=${status} ms=${ms} code=${result.errorCode ?? "-"} body=${result.bodyExcerpt}`
  );
  if (shouldHallLog(result)) recordHallFailure(result);
  return result;
}

export async function postJson(
  request: APIRequestContext,
  url: string,
  headers: Record<string, string>,
  data: unknown,
  timeout = 60_000
): Promise<APIResponse> {
  return request.post(url, { headers, data, timeout });
}

export async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      out[index] = await fn(items[index], index);
    }
  }
  const workers = Math.min(Math.max(1, limit), items.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return out;
}

export async function firePulse(
  request: APIRequestContext,
  profile: StressProfile,
  headers: Record<string, string>,
  extraHeaders?: Record<string, string>
): Promise<StressResult> {
  const started = Date.now();
  try {
    const res = await postJson(
      request,
      "/api/msgf/pulse",
      { ...headers, ...extraHeaders },
      {
        keystrokes: sampleKeystrokes(`stress-${profile}`),
      }
    );
    return recordResponse(profile, "pulse", res, Date.now() - started);
  } catch (error) {
    return recordResponse(profile, "pulse", null, Date.now() - started, error);
  }
}

export async function fireIngest(
  request: APIRequestContext,
  profile: StressProfile,
  headers: Record<string, string>,
  body: Record<string, unknown>
): Promise<StressResult> {
  const started = Date.now();
  try {
    const res = await postJson(request, "/api/msgf/ingest", headers, body, 120_000);
    return recordResponse(profile, "ingest", res, Date.now() - started);
  } catch (error) {
    return recordResponse(profile, "ingest", null, Date.now() - started, error);
  }
}

export async function runConcurrentWave(
  request: APIRequestContext,
  profile: Exclude<StressProfile, "unentitled" | "invalid">
): Promise<StressResult[]> {
  const headers = authHeaders(profile);
  const warmup = await fireIngest(request, profile, headers, validIngestBody());
  const total = Math.max(0, stressRequestCount() - 1);
  const jobs: Array<"pulse" | "ingest"> = [];
  for (let i = 0; i < total; i += 1) {
    jobs.push(i % 2 === 0 ? "pulse" : "ingest");
  }
  const rest = await mapPool(jobs, stressConcurrency(), (kind) =>
    kind === "pulse"
      ? firePulse(request, profile, headers)
      : fireIngest(request, profile, headers, validIngestBody())
  );
  return [warmup, ...rest];
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

export function hallFailureCountForRun(): number {
  try {
    if (!fs.existsSync(HALL_PATH)) return 0;
    const parsed = JSON.parse(fs.readFileSync(HALL_PATH, "utf8")) as HallFile;
    return (parsed.failures || []).filter((f) => f.run_id === RUN_ID).length;
  } catch {
    return 0;
  }
}

export function printExecutionReport(): {
  unexpected: number;
  byProfile: Record<string, { total: number; unexpected: number }>;
} {
  const latencies = results.map((r) => r.ms).sort((a, b) => a - b);
  const histogram = new Map<number, number>();
  const byProfile: Record<string, { total: number; unexpected: number }> = {};
  for (const r of results) {
    histogram.set(r.status, (histogram.get(r.status) || 0) + 1);
    const bucket = byProfile[r.profile] || { total: 0, unexpected: 0 };
    bucket.total += 1;
    if (!r.expected) bucket.unexpected += 1;
    byProfile[r.profile] = bucket;
  }
  const unexpected = results.filter((r) => !r.expected).length;
  const hallCount = hallFailureCountForRun();
  const hist = [...histogram.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([status, n]) => `${status}:${n}`)
    .join(" ");

  const lines = [
    "",
    "===== MSGF STRESS EXECUTION REPORT =====",
    `run_id: ${RUN_ID}`,
    `baseURL: ${msgfBaseUrl()}`,
    `total: ${results.length}`,
    `unexpected_failures: ${unexpected}`,
    `hall_failures_this_run: ${hallCount}`,
    `p50_ms: ${percentile(latencies, 50)}`,
    `p95_ms: ${percentile(latencies, 95)}`,
    `status_histogram: ${hist || "(none)"}`,
    ...Object.entries(byProfile).map(
      ([profile, stats]) =>
        `profile ${profile}: total=${stats.total} unexpected=${stats.unexpected} ${stats.unexpected ? "FAIL" : "PASS"}`
    ),
    `log: ${STRESS_LOG_PATH}`,
    `hall: ${HALL_PATH}`,
    "========================================",
    "",
  ];
  for (const line of lines) {
    console.log(line);
  }
  return { unexpected, byProfile };
}

export function collectedResults(): StressResult[] {
  return results;
}
