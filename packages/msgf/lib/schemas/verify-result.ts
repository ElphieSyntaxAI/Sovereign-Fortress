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
import { z } from "zod";

import { MsgfHealQueueTenantIdSchema } from "@/lib/schemas/heal-queue";

export const VerifyResultBodySchema = z
  .object({
    tenant_id: MsgfHealQueueTenantIdSchema,
    passed: z.boolean(),
    command: z.string().max(512).optional(),
    exit_code: z.number().int().optional(),
    stdout_snippet: z.string().max(4000).optional(),
    stderr_snippet: z.string().max(4000).optional(),
    file_paths: z.array(z.string().min(1).max(512)).max(64).optional(),
    dev_heal_choice: z.enum(["self_guided", "self_local", "cloud"]).optional(),
    incident_id: z.string().uuid().nullable().optional(),
    product_surface: z
      .enum(["gatedai", "author", "education", "integrator", "ide"])
      .optional(),
    actor_id: z.string().max(256).optional(),
    pack_id: z.string().uuid().optional(),
  })
  .strict();

export type VerifyResultBody = z.infer<typeof VerifyResultBodySchema>;
