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
  surface: z.enum(["sandbox", "google-docs", "word-online", "unknown"]).optional(),
});

export type TheCallEvent = z.infer<typeof TheCallEventSchema>;

export const TheCallIngestBodySchema = z
  .object({
    schemaVersion: z.literal(1).optional(),
    assignmentId: z.string().uuid().optional(),
    sessionId: z.string().uuid().optional(),
    subjectDomain: z
      .enum(["ela", "history", "math", "science", "general"])
      .optional()
      .default("general"),
    writingSurface: z
      .enum(["sandbox", "google-docs", "word-online", "unknown"])
      .optional(),
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
  })
  .strict()
  .refine((b) => (b.theCall?.length ?? 0) > 0 || (b.keystrokes?.length ?? 0) > 0, {
    message: "Provide theCall[] or keystrokes[]",
  });

export type TheCallIngestBody = z.infer<typeof TheCallIngestBodySchema>;

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
