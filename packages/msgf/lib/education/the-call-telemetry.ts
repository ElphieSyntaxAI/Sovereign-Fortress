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
 * Distribution Build ID: MSGF-c1a5d75-20260723T221428Z-internal
 */
/**
 * Syntax Education — "The Call" real-time input telemetry (P4 State Ledger ingress).
 * Repurposes IDE/code keystroke hooks for student composition rhythm ($D_{down}$, $I_{flight}$).
 */
import { z } from "zod";

import type { KeystrokeEvent } from "@/lib/P4";

export const EDUCATION_TENANT_SLUGS = new Set([
  "syntax_education",
  "tenant_education",
]);

export function isEducationTenantId(tenantId: string | undefined | null): boolean {
  const t = String(tenantId ?? "").trim().toLowerCase();
  return EDUCATION_TENANT_SLUGS.has(t) || t.includes("education");
}

/**
 * `ecosystem_source` — tags the host environment where telemetry originated.
 * See pillars §2.4.1 (PILLAR 4 EXTENSION: EXTERNAL TELEMETRY ROUTING).
 */
export const EcosystemSourceSchema = z.enum([
  "SANDBOX_NATIVE",
  "GOOGLE_EDIT",
  "MS_OFFICE_EDIT",
]);
export type EcosystemSource = z.infer<typeof EcosystemSourceSchema>;

/**
 * `telemetry_mode` — Human Effort Score surrogate selector per host capability.
 * - `KEYSTROKE`: true key-up / key-down microsecond rhythm
 * - `CELL_MUTATION`: per-cell mutation count / Δt (Sheets / Excel)
 * - `FOCUS_DURATION`: visibility / focus dwell only (Slides / PowerPoint)
 */
export const TelemetryModeSchema = z.enum([
  "KEYSTROKE",
  "CELL_MUTATION",
  "FOCUS_DURATION",
]);
export type TelemetryMode = z.infer<typeof TelemetryModeSchema>;

export const WritingSurfaceSchema = z.enum([
  "sandbox",
  "google-docs",
  "google-sheets",
  "google-slides",
  "word-online",
  "excel-online",
  "powerpoint-online",
  "unknown",
]);
export type WritingSurface = z.infer<typeof WritingSurfaceSchema>;

/** Single event from the browser "The Call" hook (Author extension or education sandbox). */
export const TheCallEventSchema = z.object({
  key: z.string().min(1),
  /** ISO-8601 or epoch ms */
  timestamp: z.union([z.string(), z.number()]),
  /** Inter-key flight interval $I_{flight}$ (ms) */
  flightTime: z.number().finite().optional(),
  flightMs: z.number().finite().optional(),
  /** Key-down dwell $D_{down}$ (ms) */
  dwellTime: z.number().finite().optional(),
  dwellMs: z.number().finite().optional(),
  isBackspace: z.boolean().optional(),
  isSystemEvent: z.boolean().optional(),
  wordsPasted: z.number().int().min(0).optional(),
  surface: WritingSurfaceSchema.optional(),
});

export type TheCallEvent = z.infer<typeof TheCallEventSchema>;

/**
 * Focus-state beat (active session focus monitor — pillars §3.2).
 * Emitted by the add-on when `document.hidden` or window blur stalls / resumes the active-time tracker.
 */
export const FocusEventSchema = z.object({
  ts: z.union([z.string(), z.number()]),
  /** `focus_pause` stalls the active-time tracker; `focus_resume` restarts it. */
  type: z.enum(["focus_pause", "focus_resume"]),
  surface: WritingSurfaceSchema.optional(),
  /** Optional reason hint (`tab_hidden`, `window_blur`, `app_switch`). */
  reason: z.string().max(64).optional(),
});
export type FocusEvent = z.infer<typeof FocusEventSchema>;

/**
 * Cell-mutation surrogate (Sheets / Excel) — Human Effort Score input when keystroke timing is unavailable.
 */
export const CellMutationEventSchema = z.object({
  ts: z.union([z.string(), z.number()]),
  /** Cell or range reference, e.g. `Sheet1!B3` or `Sheet1!A1:A5`. */
  cellRef: z.string().min(1).max(128),
  /** Character delta length for the mutation (positive insert, negative delete). */
  deltaChars: z.number().int(),
  /** Mutation classified as paste (origin clipboard / fill / external) vs. typed. */
  isPaste: z.boolean().optional(),
  /** Optional source `ecosystem_source` if mixed-batch (else taken from envelope). */
  ecosystemSource: EcosystemSourceSchema.optional(),
});
export type CellMutationEvent = z.infer<typeof CellMutationEventSchema>;

export const TheCallIngestBodySchema = z
  .object({
    /**
     * Bumped to 2 with the §2.4.1 extension. Routes still accept `1`
     * (legacy add-on builds) — body validates either way.
     */
    schemaVersion: z.union([z.literal(1), z.literal(2)]).optional(),
    assignmentId: z.string().uuid().optional(),
    sessionId: z.string().uuid().optional(),
    subjectDomain: z
      .enum(["ela", "history", "math", "science", "general"])
      .optional()
      .default("general"),
    writingSurface: WritingSurfaceSchema.optional(),
    /**
     * Host ecosystem (pillars §2.4.1). Defaults to `SANDBOX_NATIVE` when omitted.
     * Add-on clients (Google Apps Script, Office.js, MV3 extension) MUST set this explicitly.
     */
    ecosystemSource: EcosystemSourceSchema.optional(),
    /**
     * Telemetry surrogate mode (pillars §2.4.1). Defaults to `KEYSTROKE`.
     * Sheets / Excel add-ons set `CELL_MUTATION`; Slides / PowerPoint set `FOCUS_DURATION`.
     */
    telemetryMode: TelemetryModeSchema.optional(),
    /** Education-native stream from "The Call". */
    theCall: z.array(TheCallEventSchema).optional(),
    /** Legacy MSGF pulse keystrokes (still accepted). */
    keystrokes: z
      .array(
        z.object({
          ts: z.number().finite(),
          key: z.string().min(1),
          type: z.enum(["keydown", "keyup", "input"]).optional(),
          target: z.string().optional(),
          dwellMs: z.number().finite().optional(),
          flightMs: z.number().finite().optional(),
          isBackspace: z.boolean().optional(),
          isSystemEvent: z.boolean().optional(),
          wordsPasted: z.number().int().min(0).optional(),
        })
      )
      .optional(),
    /** Focus-state beats (active session focus monitor — pillars §3.2). */
    focusEvents: z.array(FocusEventSchema).optional(),
    /** Cell-mutation surrogate beats (Sheets / Excel). */
    cellMutations: z.array(CellMutationEventSchema).optional(),
  })
  .strict()
  .refine(
    (b) =>
      (b.theCall?.length ?? 0) > 0 ||
      (b.keystrokes?.length ?? 0) > 0 ||
      (b.focusEvents?.length ?? 0) > 0 ||
      (b.cellMutations?.length ?? 0) > 0,
    {
      message: "Provide theCall[], keystrokes[], focusEvents[], or cellMutations[]",
    }
  );

export type TheCallIngestBody = z.infer<typeof TheCallIngestBodySchema>;

/**
 * Resolve the effective `ecosystem_source` for an ingest body — defaults to `SANDBOX_NATIVE`
 * if unspecified, and infers from `writingSurface` when the add-on omits the tag.
 */
export function resolveEcosystemSource(body: TheCallIngestBody): EcosystemSource {
  if (body.ecosystemSource) return body.ecosystemSource;
  switch (body.writingSurface) {
    case "google-docs":
    case "google-sheets":
    case "google-slides":
      return "GOOGLE_EDIT";
    case "word-online":
    case "excel-online":
    case "powerpoint-online":
      return "MS_OFFICE_EDIT";
    default:
      return "SANDBOX_NATIVE";
  }
}

/**
 * Resolve the effective `telemetry_mode` — defaults to `KEYSTROKE`, falls back to
 * `CELL_MUTATION` when only cell mutations are provided, and `FOCUS_DURATION` when only
 * focus beats are provided.
 */
export function resolveTelemetryMode(body: TheCallIngestBody): TelemetryMode {
  if (body.telemetryMode) return body.telemetryMode;
  const hasKeys = (body.theCall?.length ?? 0) > 0 || (body.keystrokes?.length ?? 0) > 0;
  if (hasKeys) return "KEYSTROKE";
  if ((body.cellMutations?.length ?? 0) > 0) return "CELL_MUTATION";
  if ((body.focusEvents?.length ?? 0) > 0) return "FOCUS_DURATION";
  return "KEYSTROKE";
}

function toEpochMs(timestamp: string | number): number {
  if (typeof timestamp === "number" && Number.isFinite(timestamp)) {
    return timestamp < 1e12 ? timestamp : timestamp;
  }
  const parsed = Date.parse(String(timestamp));
  if (Number.isFinite(parsed)) return parsed;
  return Date.now();
}

function buildTargetTag(meta: {
  subjectDomain: string;
  assignmentId?: string;
  sessionId?: string;
  surface?: string;
}): string {
  const parts = [`edu:${meta.subjectDomain}`];
  if (meta.assignmentId) parts.push(`assignment=${meta.assignmentId}`);
  if (meta.sessionId) parts.push(`session=${meta.sessionId}`);
  if (meta.surface) parts.push(`surface=${meta.surface}`);
  return parts.join(" ");
}

/**
 * Normalizes "The Call" student telemetry into P4 {@link KeystrokeEvent} rows.
 * Rhythm fields are preserved on the event for trace formatting and HAL scoring downstream.
 */
export function normalizeTheCallToKeystrokes(
  body: TheCallIngestBody,
  targetMeta?: { assignmentId?: string; sessionId?: string }
): KeystrokeEvent[] {
  const subjectDomain = body.subjectDomain ?? "general";
  const surface = body.writingSurface ?? "unknown";
  const target = buildTargetTag({
    subjectDomain,
    assignmentId: targetMeta?.assignmentId ?? body.assignmentId,
    sessionId: targetMeta?.sessionId ?? body.sessionId,
    surface,
  });

  if (body.keystrokes?.length) {
    return body.keystrokes.map((k) => ({
      ts: k.ts,
      key: k.key,
      type: k.type,
      target: k.target ?? target,
      dwellMs: k.dwellMs,
      flightMs: k.flightMs,
      isBackspace: k.isBackspace,
      isSystemEvent: k.isSystemEvent,
      wordsPasted: k.wordsPasted,
    }));
  }

  const events = body.theCall ?? [];
  return events.map((e) => {
    const flightMs = e.flightMs ?? e.flightTime;
    const dwellMs = e.dwellMs ?? e.dwellTime;
    return {
      ts: toEpochMs(e.timestamp),
      key: e.key,
      type: e.isSystemEvent ? ("input" as const) : undefined,
      target,
      dwellMs: typeof dwellMs === "number" ? Math.round(dwellMs) : undefined,
      flightMs: typeof flightMs === "number" ? Math.round(flightMs) : undefined,
      isBackspace: e.isBackspace === true,
      isSystemEvent: e.isSystemEvent === true || e.key === "PASTE_EVENT",
      wordsPasted: e.wordsPasted,
    };
  });
}
