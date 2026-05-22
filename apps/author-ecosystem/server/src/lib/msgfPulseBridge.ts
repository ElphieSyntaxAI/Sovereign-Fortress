import type { UniversalP1PulseBody } from "msgf/universal/p1-hal-standard";
import { toUniversalP1PulseBody } from "msgf/universal/p1-hal-standard";
import {
  authorHalEventsToUniversalKeystrokes,
  type AuthorHalDnaEvent,
} from "msgf/hal-author-bridge";
import {
  MSGF_AUTHOR_HAL_HEADER,
  serializeAuthorHalTelemetry,
  type AuthorHalTelemetrySnapshot,
} from "msgf/hal-author-bridge";

export type { AuthorHalDnaEvent, AuthorHalTelemetrySnapshot };

export type AuthorMsgfPulseResult = {
  ok: boolean;
  configured: boolean;
  status: number | null;
  url: string | null;
  response: unknown;
  error?: string;
};

type ForwardAuthorPulseInput = {
  userId: string;
  tenantId?: string | null;
  body: unknown;
  idempotencyKey?: string | null;
  authorHal?: AuthorHalTelemetrySnapshot | null;
};

function trimEnv(name: string): string {
  return process.env[name]?.trim() || "";
}

export function resolveAuthorMsgfTenantId(raw?: string | null): string {
  return raw?.trim() || trimEnv("MSGF_AUTHOR_TENANT_ID") || "author_ecosystem";
}

function resolveMsgfBaseUrl(): string {
  return (
    trimEnv("MSGF_APP_URL") ||
    trimEnv("NEXT_PUBLIC_MSGF_APP_URL") ||
    trimEnv("MSGF_BASE_URL")
  ).replace(/\/+$/, "");
}

function resolveMsgfPulseLicenseKey(): string {
  return (
    trimEnv("MSGF_AUTHOR_PULSE_LICENSE_KEY") ||
    trimEnv("MSGF_CONTRACT_LICENSE_KEY")
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeKeystrokeEvent(value: unknown): import("msgf/universal/p1-hal-standard").UniversalP1KeystrokeEvent | null {
  if (!isRecord(value)) return null;
  const ts = typeof value.ts === "number" ? value.ts : Number(value.ts);
  if (!Number.isFinite(ts)) return null;
  const key = typeof value.key === "string" && value.key.trim() ? value.key.trim() : "AuthorPulse";
  const typeRaw = typeof value.type === "string" ? value.type.trim() : "";
  const type =
    typeRaw === "keydown" || typeRaw === "keyup" || typeRaw === "input"
      ? typeRaw
      : "input";
  const target =
    typeof value.target === "string" && value.target.trim()
      ? value.target.trim().slice(0, 120)
      : undefined;
  return {
    ts,
    key,
    type,
    ...(target ? { target } : {}),
    ...(typeof value.dwellMs === "number" ? { dwellMs: value.dwellMs } : {}),
    ...(typeof value.flightMs === "number" ? { flightMs: value.flightMs } : {}),
    ...(value.isBackspace === true ? { isBackspace: true } : {}),
    ...(value.isSystemEvent === true ? { isSystemEvent: true } : {}),
    ...(typeof value.wordsPasted === "number" ? { wordsPasted: value.wordsPasted } : {}),
  };
}

export function normalizeUniversalPulseBody(input: unknown): UniversalP1PulseBody {
  if (!isRecord(input) || !Array.isArray(input.keystrokes)) {
    throw new Error("keystrokes must be an array of universal P1 events.");
  }
  const keystrokes = input.keystrokes
    .map(normalizeKeystrokeEvent)
    .filter((event): event is NonNullable<typeof event> => event !== null);
  if (keystrokes.length === 0) {
    throw new Error("keystrokes must include at least one valid event.");
  }
  return toUniversalP1PulseBody({
    keystrokes,
    humanTieBreakerResolved: input.humanTieBreakerResolved === true,
  });
}

/** @deprecated Prefer {@link authorHalEventsToUniversalKeystrokes} from msgf/hal-author-bridge */
export function latenciesToUniversalKeystrokes(
  latencies: readonly number[],
  opts?: { startTs?: number; target?: string }
): import("msgf/universal/p1-hal-standard").UniversalP1KeystrokeEvent[] {
  const events: AuthorHalDnaEvent[] = latencies.map((n) => ({
    key: "AuthorHAL",
    flightTime: n,
  }));
  return authorHalEventsToUniversalKeystrokes(events, opts);
}

export async function forwardAuthorPulseToMsgf(
  input: ForwardAuthorPulseInput
): Promise<AuthorMsgfPulseResult> {
  const baseUrl = resolveMsgfBaseUrl();
  const licenseKey = resolveMsgfPulseLicenseKey();
  if (!baseUrl || !licenseKey) {
    return {
      ok: false,
      configured: false,
      status: null,
      url: baseUrl ? `${baseUrl}/api/msgf/pulse` : null,
      response: null,
      error:
        "MSGF_APP_URL and MSGF_AUTHOR_PULSE_LICENSE_KEY (or MSGF_CONTRACT_LICENSE_KEY) are required on the Author BFF.",
    };
  }

  const tenantId = resolveAuthorMsgfTenantId(input.tenantId);
  const body = normalizeUniversalPulseBody(input.body);
  const url = `${baseUrl}/api/msgf/pulse`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${licenseKey}`,
    "x-msgf-license-key": licenseKey,
    "x-msgf-ide-pulse": "1",
    "x-msgf-entity-id": input.userId,
    "x-msgf-operator-user-id": input.userId,
    "x-msgf-tenant-id": tenantId,
    "X-MSGF-Tenant-Key": tenantId,
  };
  if (input.idempotencyKey?.trim()) {
    headers["Idempotency-Key"] = input.idempotencyKey.trim();
  }
  if (input.authorHal) {
    headers[MSGF_AUTHOR_HAL_HEADER] = serializeAuthorHalTelemetry(input.authorHal);
  }

  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    const json: unknown = await upstream.json().catch(() => ({}));
    return {
      ok: upstream.ok,
      configured: true,
      status: upstream.status,
      url,
      response: json,
    };
  } catch (e) {
    return {
      ok: false,
      configured: true,
      status: null,
      url,
      response: null,
      error: e instanceof Error ? e.message : "MSGF Pulse proxy failed.",
    };
  }
}
