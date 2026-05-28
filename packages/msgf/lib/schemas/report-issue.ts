import { z } from "zod";

export const ReportIssueBodySchema = z
  .object({
    message: z.string().trim().min(1, "message required").max(8000),
    location: z.string().max(4000).optional(),
    tenant_id: z.string().max(512).optional(),
    source: z.enum(["extension", "web", "api", "sentinel"]).optional(),
    operator_note: z.string().max(8000).optional(),
    entity_id: z.string().max(256).optional(),
    /** Full Sentinel / IDE diagnostic bundle — triggers self-heal after incident upsert. */
    diagnostic_snapshot: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export type ReportIssueBody = z.infer<typeof ReportIssueBodySchema>;

export const AgentContextQuerySchema = z
  .object({
    tenant_id: z.string().trim().min(1).max(128),
    mode: z.enum(["guided", "auto"]).default("guided"),
    file_paths: z.string().optional(),
    trigger_label: z.string().max(500).optional(),
  })
  .strict();
