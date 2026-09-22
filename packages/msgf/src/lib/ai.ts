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
 * Distribution Build ID: MSGF-b4dfaf97-20260922T171835Z-internal
 */
import Anthropic from "@anthropic-ai/sdk";
import { msgfLogger } from "./logger";
import { runWithLlmTimeout } from "@/lib/services/cost-runaway-guard";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function askNarrativeAI(tenantId: string, actorId: string, prompt: string) {
  // 1. Log that the AI is starting to work
  await msgfLogger.info(tenantId, "AI_REQUEST_STARTED", actorId, { prompt_preview: prompt.slice(0, 50) });

  try {
    const message = await runWithLlmTimeout("narrative_ai.anthropic", async (signal) =>
      anthropic.messages.create(
        {
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 1024,
          messages: [{ role: "user", content: prompt }],
        },
        { signal }
      )
    );

    const responseText = message.content[0].type === "text" ? message.content[0].text : "";

    // 2. Log the successful response
    await msgfLogger.info(tenantId, "AI_RESPONSE_RECEIVED", actorId, { response_length: responseText.length });

    return responseText;
  } catch (error: any) {
    // 3. Log the failure as a Warning or Violation
    await msgfLogger.warning(tenantId, "AI_REQUEST_FAILED", actorId, { error: error.message });
    throw error;
  }
}
