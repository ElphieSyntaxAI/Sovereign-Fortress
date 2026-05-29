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
