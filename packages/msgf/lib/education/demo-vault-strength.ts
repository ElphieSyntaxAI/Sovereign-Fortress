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
 * Distribution Build ID: MSGF-1826a636-20260922T234439Z-internal
 */
/**
 * Seed a documented Vault strength for demo / QA so Socratic can bridge strength→friction.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { generateEmbedding } from "@/lib/ai-utils";
import { buildStudentStrengthMetadata } from "@/lib/education/curriculum-metadata";
import { EDU_DEMO, EDU_DEMO_VAULT_STRENGTH } from "@/lib/education/demo-fixtures";
import { fromPillarVectors } from "@/lib/msgf-pillar-table";

export async function seedDemoVaultStrength(params: {
  admin: SupabaseClient;
  tenantId?: string;
  entityToken?: string;
}): Promise<{ seeded: boolean; reason?: string }> {
  const tenantId = params.tenantId ?? EDU_DEMO.tenantId;
  const entityToken = params.entityToken ?? EDU_DEMO.entityToken;

  const metadata = {
    ...buildStudentStrengthMetadata({
      strengthLabel: EDU_DEMO_VAULT_STRENGTH.strengthLabel,
      summary: EDU_DEMO_VAULT_STRENGTH.summary,
      subjectDomain: EDU_DEMO_VAULT_STRENGTH.subjectDomain,
      halScore: EDU_DEMO_VAULT_STRENGTH.halScore,
      scope: { tenantId },
    }),
    // Non-UUID classroom tokens: lexical retrieval matches entity_id / author_id.
    entity_id: entityToken,
    author_id: entityToken,
    entity_token: entityToken,
    demo_fixture: true,
  };

  let embedding: number[] | null = null;
  try {
    embedding = await generateEmbedding(EDU_DEMO_VAULT_STRENGTH.content);
  } catch {
    embedding = null;
  }

  const { error } = await fromPillarVectors(params.admin, tenantId).insert({
    content: EDU_DEMO_VAULT_STRENGTH.content,
    metadata,
    ...(embedding ? { embedding } : {}),
  });

  if (error) {
    return { seeded: false, reason: error.message };
  }
  return { seeded: true };
}
