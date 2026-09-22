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
 * Distribution Build ID: MSGF-b4dfaf97-20260922T171835Z-internal
 */
/**
 * Pillar 7 (P7) — Source Audit & Resource Reputation schemas (pure, no I/O).
 */

import { createHash } from "node:crypto";
import { z } from "zod";

export const ATTRIBUTION_CLASSES = [
  "internal_spec",
  "permissive_oss",
  "copyleft_risk",
  "untrusted_external",
  "unknown",
] as const;

export type AttributionClass = (typeof ATTRIBUTION_CLASSES)[number];

export const AttributionClassSchema = z.enum(ATTRIBUTION_CLASSES);

export const SourceHitKindSchema = z.enum([
  "vault",
  "hall",
  "file",
  "pack",
  "tool",
  "search",
  "mcp",
  "agent",
  "citation",
  "prompt",
]);

export const LineRangeSchema = z
  .object({
    start: z.number().int().nonnegative(),
    end: z.number().int().nonnegative(),
  })
  .refine((r) => r.end >= r.start, { message: "end must be >= start" });

export const SourceHitSchema = z.object({
  kind: SourceHitKindSchema,
  resource_key: z.string().min(1),
  resource_id: z.string().uuid().optional().nullable(),
  score: z.number().min(0).max(1).default(0),
  content_hash: z
    .string()
    .regex(/^[0-9a-f]{64}$/i)
    .optional()
    .nullable(),
  content_hash_missing: z.boolean().optional(),
  bug_index: z.string().optional().nullable(),
  file_path: z.string().optional().nullable(),
  line_range: LineRangeSchema.optional().nullable(),
  commit_sha: z.string().optional().nullable(),
  label: z.string().optional().nullable(),
  attribution_class: AttributionClassSchema.default("unknown"),
  pruned: z.boolean().optional(),
  ledger: z
    .enum(["vault", "hall", "file", "tool", "search", "mcp", "agent", "citation", "pack", "prompt"])
    .optional()
    .nullable(),
  reputation_score: z.number().min(-1).max(1).optional(),
});

export type SourceHit = z.infer<typeof SourceHitSchema>;

export const SourceAuditDecisionKindSchema = z.enum([
  "defend",
  "cross_ref",
  "converge",
  "local_gateway",
  "arbitrate",
]);

export const SourceAuditOutcomeSchema = z.enum([
  "pass",
  "block",
  "escalate",
  "persist_vault",
  "persist_hall",
  "unknown",
]);

export const SourceAuditRecordSchema = z.object({
  tenant_id: z.string().min(1),
  entity_id: z.string().optional().nullable(),
  trace_id: z.string().min(1),
  pulse_beat_id: z.string().uuid().optional().nullable(),
  decision_kind: SourceAuditDecisionKindSchema.default("defend"),
  routing: z.string().optional().nullable(),
  logic_drift_score: z.number().optional().nullable(),
  defend_tier: z.string().optional().nullable(),
  defend_reason: z.string().optional().nullable(),
  sources: z.array(SourceHitSchema).default([]),
  outcome: SourceAuditOutcomeSchema.default("unknown"),
  project_origin: z.string().optional().nullable(),
});

export type SourceAuditRecord = z.infer<typeof SourceAuditRecordSchema>;

export const ResourceReputationSchema = z.object({
  tenant_id: z.string(),
  resource_key: z.string(),
  ledger: z.enum([
    "vault",
    "hall",
    "file",
    "tool",
    "search",
    "mcp",
    "agent",
    "citation",
    "pack",
    "prompt",
  ]),
  resource_id: z.string().uuid().optional().nullable(),
  file_path: z.string().optional().nullable(),
  good_count: z.number().int().nonnegative(),
  bad_count: z.number().int().nonnegative(),
  high_drift_count: z.number().int().nonnegative(),
  last_drift_score: z.number().optional().nullable(),
  reputation_score: z.number().min(-1).max(1),
  last_content_hash: z.string().optional().nullable(),
});

export type ResourceReputation = z.infer<typeof ResourceReputationSchema>;

/** Normalize line endings + trim so CRLF/LF and trailing space do not diverge hashes. */
export function hashSourceChunk(content: string): string {
  const normalized = content.replace(/\r\n/g, "\n").trim();
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

export function resourceKeyForVaultHall(
  id: string,
  ledger: "vault" | "hall"
): string {
  const token =
    typeof id === "string" ? id.trim() : String(id ?? "").trim();
  return `${ledger}:${token}`;
}

export function resourceKeyForFile(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/").replace(/\r\n/g, "\n").trim();
  const digest = createHash("sha256").update(normalized, "utf8").digest("hex");
  return `file:${digest}`;
}

export function resourceKeyForPack(packId: string): string {
  const digest = createHash("sha256").update(packId.trim(), "utf8").digest("hex");
  return `pack:${digest}`;
}

/** Hash-only prompt identity. Never pass raw prompt text here. */
export function resourceKeyForPromptHash(sha256: string): string {
  const hex = sha256.trim().toLowerCase();
  const digest = /^[0-9a-f]{64}$/.test(hex)
    ? hex
    : createHash("sha256").update(sha256.trim(), "utf8").digest("hex");
  return `prompt:${digest}`;
}

export function resourceKeyForMandateHash(sha256: string): string {
  const hex = sha256.trim().toLowerCase();
  const digest = /^[0-9a-f]{64}$/.test(hex)
    ? hex
    : createHash("sha256").update(sha256.trim(), "utf8").digest("hex");
  return `mandate:${digest.slice(0, 16)}`;
}

export const DEFAULT_P7_HALFLIFE_DAYS = 30;

export function p7ReputationHalfLifeDays(): number {
  const raw = process.env.MSGF_P7_REPUTATION_HALFLIFE_DAYS?.trim();
  if (raw === "0") return 0;
  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) return n;
  return DEFAULT_P7_HALFLIFE_DAYS;
}

export function decayReputationCounts(input: {
  good: number;
  bad: number;
  highDrift: number;
  lastSeenAt: string | Date | null | undefined;
  now?: Date;
  halfLifeDays?: number;
}): { good: number; bad: number; highDrift: number; factor: number } {
  const halfLife = input.halfLifeDays ?? p7ReputationHalfLifeDays();
  const g = Math.max(0, Number(input.good) || 0);
  const b = Math.max(0, Number(input.bad) || 0);
  const h = Math.max(0, Number(input.highDrift) || 0);
  if (!(halfLife > 0) || !input.lastSeenAt) {
    return { good: g, bad: b, highDrift: h, factor: 1 };
  }
  const last = new Date(input.lastSeenAt).getTime();
  if (!Number.isFinite(last)) {
    return { good: g, bad: b, highDrift: h, factor: 1 };
  }
  const now = (input.now ?? new Date()).getTime();
  const ageDays = Math.max(0, (now - last) / 86_400_000);
  const factor = Math.pow(0.5, ageDays / halfLife);
  return {
    good: g * factor,
    bad: b * factor,
    highDrift: h * factor,
    factor,
  };
}

export function computeReputationScore(
  good: number,
  bad: number,
  highDrift: number
): number {
  const g = Math.max(0, Math.floor(good));
  const b = Math.max(0, Math.floor(bad));
  const h = Math.max(0, Math.floor(highDrift));
  const total = Math.max(1, g + b + h);
  const raw = (g - b - 0.5 * h) / total;
  return Math.max(-1, Math.min(1, raw));
}

export function blocksAutoGreen(hit: Pick<SourceHit, "attribution_class" | "pruned">): boolean {
  if (hit.pruned) return false;
  const cls = hit.attribution_class ?? "unknown";
  return cls === "copyleft_risk" || cls === "untrusted_external";
}

export const REPUTATION_BOOST_THRESHOLD = 0.3;
export const REPUTATION_PRUNE_THRESHOLD = -0.3;

export function parseAttributionClass(raw: unknown): AttributionClass {
  if (typeof raw !== "string") return "unknown";
  const v = raw.trim().toLowerCase();
  if ((ATTRIBUTION_CLASSES as readonly string[]).includes(v)) {
    return v as AttributionClass;
  }
  return "unknown";
}
