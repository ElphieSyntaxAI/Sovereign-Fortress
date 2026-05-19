/**
 * Syntax Education — shared add-on telemetry client.
 *
 * Single POST surface for all external hosts:
 *   - Google Workspace add-on  → `ecosystem_source = GOOGLE_EDIT`
 *   - Microsoft 365 add-in     → `ecosystem_source = MS_OFFICE_EDIT`
 *   - MV3 browser extension    → `ecosystem_source` derived from host URL
 *   - Native sandbox composer  → `ecosystem_source = SANDBOX_NATIVE`
 *
 * Pillars §2.4.1 (external telemetry routing) + §3.1 (cross-platform add-on matrix).
 *
 * This file is host-agnostic: no DOM, no Office.js, no Apps Script. Hosts adapt their
 * native event surfaces into the {@link TheCallEvent} / {@link FocusEvent} /
 * {@link CellMutationEvent} shapes and call {@link postTheCall}.
 */

export type EcosystemSource = "SANDBOX_NATIVE" | "GOOGLE_EDIT" | "MS_OFFICE_EDIT";

export type TelemetryMode = "KEYSTROKE" | "CELL_MUTATION" | "FOCUS_DURATION";

export type WritingSurface =
  | "sandbox"
  | "google-docs"
  | "google-sheets"
  | "google-slides"
  | "word-online"
  | "excel-online"
  | "powerpoint-online"
  | "unknown";

export type TheCallEvent = {
  key: string;
  timestamp: number | string;
  flightMs?: number;
  dwellMs?: number;
  isBackspace?: boolean;
  isSystemEvent?: boolean;
  wordsPasted?: number;
  surface?: WritingSurface;
};

export type FocusEvent = {
  ts: number | string;
  type: "focus_pause" | "focus_resume";
  surface?: WritingSurface;
  reason?: string;
};

export type CellMutationEvent = {
  ts: number | string;
  cellRef: string;
  deltaChars: number;
  isPaste?: boolean;
  ecosystemSource?: EcosystemSource;
};

export type TheCallBody = {
  schemaVersion?: 1 | 2;
  assignmentId?: string;
  sessionId?: string;
  subjectDomain?: "ela" | "history" | "math" | "science" | "general";
  writingSurface?: WritingSurface;
  ecosystemSource?: EcosystemSource;
  telemetryMode?: TelemetryMode;
  theCall?: TheCallEvent[];
  focusEvents?: FocusEvent[];
  cellMutations?: CellMutationEvent[];
};

export type ResearchSnippet = {
  snippetId: string;
  sourceUrl: string;
  text: string;
  readingTimeMs?: number;
  capturedAt: number;
  hasCitationAnchor: boolean;
};

export type CitationCheckBody = {
  assignmentId?: string;
  sessionId?: string;
  writingSurface?: WritingSurface;
  ecosystemSource?: EcosystemSource;
  pastedText: string;
  recentSnippets: ResearchSnippet[];
};

export type TheCallClientOptions = {
  /** Absolute base URL of the MSGF deployment (e.g. `https://msgf.elphiesyntax.com`). */
  msgfBaseUrl: string;
  /** De-identified entity token issued by the P3 privacy gate (LTI launch session). */
  entityId: string;
  /** Tenant slug — defaults to `syntax_education`. */
  tenantId?: string;
  /**
   * Service-role token if calling the `PUT` variant from a trusted BFF.
   * The browser-side add-on path leaves this undefined and uses cookie auth via `POST`.
   */
  serviceRoleToken?: string;
  /** Override fetch (Apps Script `UrlFetchApp` shim, Node fetch, etc.). */
  fetchImpl?: typeof fetch;
};

/** HTTP headers used by MSGF for entity / tenant routing. */
export const MSGF_HEADERS = {
  entityId: "x-msgf-entity-id",
  tenantId: "x-msgf-tenant-id",
  tenantKey: "x-msgf-tenant-key",
} as const;

const STATE_LEDGER_PATH = "/api/msgf/p4/state-ledger";
const CITATION_CHECK_PATH = "/api/msgf/education/research/citation-check";

function joinUrl(base: string, path: string): string {
  return base.replace(/\/+$/, "") + path;
}

async function postJson<T = unknown>(
  url: string,
  body: unknown,
  options: TheCallClientOptions,
  method: "POST" | "PUT" = "PUT"
): Promise<T> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const headers: Record<string, string> = {
    "content-type": "application/json",
    [MSGF_HEADERS.entityId]: options.entityId,
    [MSGF_HEADERS.tenantId]: options.tenantId ?? "syntax_education",
  };
  if (options.serviceRoleToken) {
    headers.authorization = `Bearer ${options.serviceRoleToken}`;
  }

  const res = await fetchImpl(url, {
    method,
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `MSGF ${method} ${url} failed: ${res.status} ${res.statusText} — ${text.slice(0, 512)}`
    );
  }
  return (await res.json()) as T;
}

/** POST the assembled "The Call" telemetry envelope to MSGF's P4 ingest. */
export function postTheCall<T = unknown>(
  body: TheCallBody,
  options: TheCallClientOptions
): Promise<T> {
  const url = joinUrl(options.msgfBaseUrl, STATE_LEDGER_PATH);
  const payload: TheCallBody = {
    schemaVersion: body.schemaVersion ?? 2,
    ...body,
  };
  return postJson<T>(url, payload, options, "PUT");
}

/** POST a Citation Hall Engine check (pillars §2.6.1). */
export function postCitationCheck<T = unknown>(
  body: CitationCheckBody,
  options: TheCallClientOptions
): Promise<T> {
  const url = joinUrl(options.msgfBaseUrl, CITATION_CHECK_PATH);
  return postJson<T>(url, body, options, "PUT");
}

// -------- focus monitor helpers (host-agnostic) ----------

export type FocusMonitorState = {
  surface: WritingSurface;
  /** Active accumulated focus time in ms (excludes paused intervals). */
  activeMs: number;
  /** Currently considered focused vs. paused. */
  focused: boolean;
  /** Last focus state change timestamp (epoch ms). */
  lastChangeAt: number;
  /** Pending beats not yet flushed to MSGF. */
  pendingBeats: FocusEvent[];
};

export function createFocusMonitor(surface: WritingSurface): FocusMonitorState {
  return {
    surface,
    activeMs: 0,
    focused: true,
    lastChangeAt: Date.now(),
    pendingBeats: [],
  };
}

/**
 * Called by the host when `document.hidden` flips or the window loses focus.
 * Returns the focus event the host should optionally batch + flush via {@link postTheCall}.
 */
export function recordFocusChange(
  state: FocusMonitorState,
  focused: boolean,
  reason?: string
): FocusEvent {
  const now = Date.now();
  if (state.focused && !focused) {
    state.activeMs += now - state.lastChangeAt;
  }
  state.focused = focused;
  state.lastChangeAt = now;
  const event: FocusEvent = {
    ts: now,
    type: focused ? "focus_resume" : "focus_pause",
    surface: state.surface,
    reason,
  };
  state.pendingBeats.push(event);
  return event;
}

/** Flush queued focus beats to MSGF (no-op if empty). */
export async function flushFocusBeats(
  state: FocusMonitorState,
  baseBody: Pick<TheCallBody, "assignmentId" | "sessionId" | "subjectDomain"> &
    Pick<Required<TheCallBody>, "ecosystemSource">,
  options: TheCallClientOptions
): Promise<void> {
  if (state.pendingBeats.length === 0) return;
  const beats = state.pendingBeats.splice(0, state.pendingBeats.length);
  await postTheCall(
    {
      ...baseBody,
      writingSurface: state.surface,
      telemetryMode: "FOCUS_DURATION",
      focusEvents: beats,
    },
    options
  );
}

// -------- cell-mutation batcher (Sheets / Excel) ----------

export type CellMutationBatcher = {
  buffer: CellMutationEvent[];
  flushAtCount: number;
  flushAtMs: number;
  lastFlushAt: number;
};

export function createCellMutationBatcher(
  flushAtCount = 25,
  flushAtMs = 2000
): CellMutationBatcher {
  return {
    buffer: [],
    flushAtCount,
    flushAtMs,
    lastFlushAt: Date.now(),
  };
}

export function pushCellMutation(
  batcher: CellMutationBatcher,
  event: CellMutationEvent
): boolean {
  batcher.buffer.push(event);
  const now = Date.now();
  return (
    batcher.buffer.length >= batcher.flushAtCount ||
    now - batcher.lastFlushAt >= batcher.flushAtMs
  );
}

export async function flushCellMutations(
  batcher: CellMutationBatcher,
  baseBody: Pick<TheCallBody, "assignmentId" | "sessionId" | "subjectDomain"> & {
    ecosystemSource: EcosystemSource;
    writingSurface: WritingSurface;
  },
  options: TheCallClientOptions
): Promise<void> {
  if (batcher.buffer.length === 0) return;
  const events = batcher.buffer.splice(0, batcher.buffer.length);
  batcher.lastFlushAt = Date.now();
  await postTheCall(
    {
      ...baseBody,
      telemetryMode: "CELL_MUTATION",
      cellMutations: events,
    },
    options
  );
}
