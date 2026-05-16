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
import { createClient } from '@supabase/supabase-js';
import { CognitoJwtVerifier } from "aws-jwt-verify"; // AWS Tier 1 Auth
import { getVertexGenerativeModel } from "@/lib/msgf-vertex";
import { fromPillarVectors } from '@/lib/msgf-pillar-table';
import {
  applyPillarVectorsTenantFilter,
  filterPillarRowsByTenant,
  resolveTenantIdForQuery,
} from '@/lib/services/tenant-query-scope';
import { runWithLlmTimeoutSimple } from '@/lib/services/cost-runaway-guard';

const model = getVertexGenerativeModel();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export class MSGFShield {
  /**
   * TIER 1: Instant Security & Compliance (ADC Version)
   */
  async triage(
    token: string,
    proposedCode: string,
    filePath: string,
    tenantId: string
  ) {
    // 1. AWS P3 Validation: Ensure the entity has authority 
    try {
      const verifier = CognitoJwtVerifier.create({
        userPoolId: process.env.AWS_USER_POOL_ID!,
        tokenUse: "access",
        clientId: process.env.AWS_CLIENT_ID!,
      });
      await verifier.verify(token);
      console.log("✅ P3 Identity Confirmed");
    } catch (e) {
      return { blocked: true, reason: "AUTH_FAILURE_P3" };
    }

    // 2. Fetch Compliance Guardrails (P1 & P6) for this tenant silo only
    const tid = resolveTenantIdForQuery(tenantId);
    type FilterEq = { eq: (column: string, value: string) => FilterEq };
    let pillarQuery: FilterEq = fromPillarVectors(supabase, tid)
      .select('content, metadata')
      .in('metadata->>pillar', ['P1', 'P6']) as unknown as FilterEq;
    pillarQuery = applyPillarVectorsTenantFilter(pillarQuery, tid);
    const { data: pillars } = await (pillarQuery as unknown as Promise<{
      data: { content: string; metadata: Record<string, unknown> | null }[] | null;
    }>);

    const complianceContext = filterPillarRowsByTenant(pillars ?? [], tid)
      .map((p) => p.content)
      .join("\n");

    // 3. Shadow Defense Audit [cite: 8, 9]
    const prompt = {
      contents: [{ role: 'user', parts: [{ text: `
        MSGF V2.6 AUDIT: Check against P1 (Security) and P6 (Errors).
        GUARDRAILS: ${complianceContext}
        PROPOSED CODE: ${proposedCode}
        Result: 'FRACTURE' if it violates rules or 'CLEAR' if safe.
      `}]}],
    };

    const result = await runWithLlmTimeoutSimple('msgf_shield.triage', () =>
      model.generateContent(prompt)
    );
    // 1. Get the first candidate safely
const candidate = result.response.candidates?.[0];

// 2. Check if the content and text actually exist before using them
if (!candidate || !candidate.content?.parts?.[0]?.text) {
  console.error("❌ MSGF Shield: Empty response from Gemini");
  return { blocked: false, reason: "Inconclusive AI Response" };
}

const response = candidate.content.parts[0].text;
    if (response?.includes("FRACTURE")) {
      return { blocked: true, reason: response }; // [cite: 9]
    }

    return { blocked: false };
  }
}

export const shield = new MSGFShield();
