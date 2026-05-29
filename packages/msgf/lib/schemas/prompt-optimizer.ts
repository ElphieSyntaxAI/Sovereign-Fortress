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
 * Distribution Build ID: MSGF-3ea5d0e-20260529T033030Z-internal
 */
import { z } from "zod";

export const PromptOptimizerGoalTypeSchema = z.enum(["fix", "feature", "refactor"]);

export const PromptOptimizerBodySchema = z
  .object({
    tenantKey: z.string().min(1).max(256),
    userIntent: z.string().min(3).max(4_000),
    activeFilePaths: z.array(z.string().min(1).max(512)).max(32).default([]),
    goalType: PromptOptimizerGoalTypeSchema.optional(),
  })
  .strict();

export type PromptOptimizerBody = z.infer<typeof PromptOptimizerBodySchema>;

export const ConfirmPackBodySchema = z
  .object({
    packId: z.string().uuid(),
    tenantKey: z.string().min(1).max(256),
  })
  .strict();

export type ConfirmPackBody = z.infer<typeof ConfirmPackBodySchema>;
