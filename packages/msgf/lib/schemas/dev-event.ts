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
 * Distribution Build ID: MSGF-a7aa881-20260620T084430Z-internal
 */
/**
 * Structured IDE dev events (build failures) — no keystroke / biometric payload.
 */

import { z } from "zod";

export const DevEventKindSchema = z.literal("build_failed");

export const DevEventBodySchema = z
  .object({
    kind: DevEventKindSchema,
    activeFile: z.string().min(1).max(512),
    excerpt: z.string().min(1).max(12_000),
    exitCode: z.number().int(),
    tenantId: z.string().min(1).max(512),
  })
  .strict();

export type DevEventBody = z.infer<typeof DevEventBodySchema>;

export class DevEventValidationError extends Error {
  readonly status: number;
  readonly code = "DEV_EVENT_VALIDATION_ERROR";
  readonly issues: { path: string; message: string }[];

  constructor(
    message: string,
    issues: { path: string; message: string }[],
    status = 400
  ) {
    super(message);
    this.name = "DevEventValidationError";
    this.status = status;
    this.issues = issues;
  }
}

function zodIssues(error: z.ZodError): { path: string; message: string }[] {
  return error.issues.map((i) => ({
    path: i.path.join("."),
    message: i.message,
  }));
}

export function parseDevEventBody(raw: unknown): DevEventBody {
  const parsed = DevEventBodySchema.safeParse(raw);
  if (!parsed.success) {
    throw new DevEventValidationError("Invalid dev-event body.", zodIssues(parsed.error));
  }
  return parsed.data;
}
