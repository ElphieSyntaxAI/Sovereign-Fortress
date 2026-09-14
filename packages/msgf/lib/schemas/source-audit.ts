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
 * Distribution Build ID: MSGF-c122f849-20260911T161212Z-internal
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
    .enum(["vault", "hall", "file", "tool", "search", "mcp", "agent", "citation", "pack"])
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
  return `${ledger}:${id.trim()}`;
}

export function resourceKeyForFile(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/").replace(/\r\n/g, "\n").trim();
  const digest = createHash("sha256").update(normalized, "utf8").digest("hex");
  return `file:${digest}`;
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
