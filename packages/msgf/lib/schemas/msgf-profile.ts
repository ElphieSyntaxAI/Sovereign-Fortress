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
 * Distribution Build ID: MSGF-51d39b5-20260516T031044Z-internal
 */
import { z } from "zod";

/**
 * Generic MSGF entitlement profile (`p4_profiles` row shape).
 * Replaces Author-specific naming — one profile per entity (human actor).
 */
export const MsgfProfileSchema = z.object({
  user_id: z.string().uuid(),
  legacy_user_id: z.number().int().nullable().optional(),
  username: z.string().min(1).max(128),
  tier_id: z.number().int().positive(),
  user_role: z.string().max(64).optional(),
  preferred_theme: z.string().max(64).optional(),
  billing_license_type: z.enum(["free", "monthly", "lifetime"]).optional(),
  stripe_subscription_status: z.string().nullable().optional(),
  current_credits: z.number().int().min(0).optional(),
  updated_at: z.string().optional(),
});

export type MsgfProfile = z.infer<typeof MsgfProfileSchema>;

export const EnsureMsgfProfileInputSchema = z.object({
  entityId: z.string().uuid(),
  tierId: z.number().int().positive(),
  username: z.string().min(1),
  preferredTheme: z.string().optional(),
});

export type EnsureMsgfProfileInput = z.infer<typeof EnsureMsgfProfileInputSchema>;
