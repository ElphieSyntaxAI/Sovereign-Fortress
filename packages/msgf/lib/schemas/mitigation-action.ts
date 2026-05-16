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
 * Distribution Build ID: MSGF-2d8d295-20260516T002421Z-internal
 */
import { z } from "zod";

import { GenealogicalBugIndexSchema } from "@/lib/schemas/vault-hall-metadata";

/** Operator mitigation scope from the Decision Portal. */
export const MitigationKindSchema = z.enum(["Session Only", "Global Fix"]);

export type MitigationKind = z.infer<typeof MitigationKindSchema>;

export const MitigationActionSchema = z
  .object({
    kind: MitigationKindSchema,
    pillar: z.string().max(64).optional(),
    label: z.string().max(512).optional(),
    fix_template: z.string().max(8000).optional(),
    apply_to_future_sessions: z.boolean().optional(),
    bug_index: GenealogicalBugIndexSchema.optional(),
  })
  .strict();

export type MitigationAction = z.infer<typeof MitigationActionSchema>;

export function isGlobalFixMitigation(action: MitigationAction | undefined): boolean {
  if (!action) return false;
  return action.kind === "Global Fix" || action.apply_to_future_sessions === true;
}
