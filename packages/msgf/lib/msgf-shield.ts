import { createClient } from '@supabase/supabase-js';
import { CognitoJwtVerifier } from "aws-jwt-verify"; // AWS Tier 1 Auth
import { getVertexGenerativeModel } from './msgf-vertex';

const model = getVertexGenerativeModel();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export class MSGFShield {
  /**
   * TIER 1: Instant Security & Compliance (ADC Version)
   */
  async triage(token: string, proposedCode: string, filePath: string) {
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

    // 2. Fetch Compliance Guardrails (P1 & P6) 
    const { data: pillars } = await supabase
      .from('pillar_vectors')
      .select('content')
      .in('metadata->>pillar', ['P1', 'P6']);

    const complianceContext = pillars?.map(p => p.content).join("\n");

    // 3. Shadow Defense Audit [cite: 8, 9]
    const prompt = {
      contents: [{ role: 'user', parts: [{ text: `
        MSGF V2.6 AUDIT: Check against P1 (Security) and P6 (Errors).
        GUARDRAILS: ${complianceContext}
        PROPOSED CODE: ${proposedCode}
        Result: 'FRACTURE' if it violates rules or 'CLEAR' if safe.
      `}]}],
    };

    const result = await model.generateContent(prompt);
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
