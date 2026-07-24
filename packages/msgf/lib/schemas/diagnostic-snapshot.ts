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
import { z } from "zod";

export const KeystrokeSnapshotEventSchema = z
  .object({
    key: z.string(),
    timestamp: z.string().optional(),
    flightTime: z.number().optional(),
    dwellTime: z.number().optional(),
    isBackspace: z.boolean().optional(),
    isSystemEvent: z.boolean().optional(),
    wordsPasted: z.number().optional(),
  })
  .passthrough();

export const EditorStateSnapshotSchema = z
  .object({
    manuscript_id: z.string().nullable().optional(),
    tenant_id: z.string().nullable().optional(),
    manuscript_title: z.string().nullable().optional(),
    revision_status: z.string().nullable().optional(),
    editor_text_excerpt: z.string().max(12000).optional(),
    wiki_notes_excerpt: z.string().max(4000).optional(),
    plot_beats_count: z.number().int().min(0).optional(),
    interview_turns_count: z.number().int().min(0).optional(),
    location_href: z.string().max(4000).optional(),
  })
  .passthrough();

export const LocalStorageBundleSchema = z
  .object({
    vault_narrative_log_id: z.string().nullable(),
    entries: z.record(z.string(), z.string()),
    key_count: z.number().int().min(0),
  })
  .passthrough();

export const BiometricTelemetrySchema = z
  .object({
    keystrokes_last_10: z.array(z.record(z.string(), z.unknown())).max(10),
    sample_count: z.number().int().min(0),
    avg_flight_time_ms: z.number().nullable(),
    avg_dwell_time_ms: z.number().nullable(),
    backspace_count: z.number().int().min(0),
    paste_event_count: z.number().int().min(0),
    biometric_drift_suspected: z.boolean(),
  })
  .passthrough();

export const DiagnosticSnapshotSchema = z.object({
  captured_at: z.string(),
  source: z.string().max(128).default("msgf_client"),
  entity_id: z.string().uuid().optional(),
  /** @deprecated Use `entity_id`. */
  author_id: z.string().uuid().optional(),
  tenant_id: z.string().max(512).optional(),
  operator_note: z.string().max(8000).optional(),
  editor: EditorStateSnapshotSchema,
  keystrokes_last_10: z.array(KeystrokeSnapshotEventSchema).max(10),
  pillar_health: z.record(z.string(), z.unknown()).optional(),
  local_storage: LocalStorageBundleSchema.optional(),
  biometric_telemetry: BiometricTelemetrySchema.optional(),
});

export type DiagnosticSnapshot = z.infer<typeof DiagnosticSnapshotSchema>;

export const SelfHealReportBodySchema = DiagnosticSnapshotSchema.extend({
  operator_note: z.string().trim().min(1, "operator_note required").max(8000),
});

export type SelfHealReportBody = z.infer<typeof SelfHealReportBodySchema>;
