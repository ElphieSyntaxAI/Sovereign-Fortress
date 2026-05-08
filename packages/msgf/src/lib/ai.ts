import Anthropic from "@anthropic-ai/sdk";
import { msgfLogger } from "./logger";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function askNarrativeAI(tenantId: string, actorId: string, prompt: string) {
  // 1. Log that the AI is starting to work
  await msgfLogger.info(tenantId, "AI_REQUEST_STARTED", actorId, { prompt_preview: prompt.slice(0, 50) });

  try {
    const message = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const responseText = message.content[0].type === "text" ? message.content[0].text : "";

    // 2. Log the successful response
    await msgfLogger.info(tenantId, "AI_RESPONSE_RECEIVED", actorId, { response_length: responseText.length });

    return responseText;
  } catch (error: any) {
    // 3. Log the failure as a Warning or Violation
    await msgfLogger.log("Warning", tenantId, "AI_REQUEST_FAILED", actorId, { error: error.message });
    throw error;
  }
}
