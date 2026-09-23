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
import { v1beta1 } from "@google-cloud/aiplatform";

import {
  getVertexGenerativeModelForId,
  isGooglePublisherModelPath,
  publisherModelIdFromPath,
  vertexApiEndpointForModelPath,
  vertexPredictionClientOptions,
} from "@/lib/msgf-vertex";
import {
  isAnthropicPublisherModelPath,
  resolveAnthropicApiKey,
  runAnthropicDirectPublisherModel,
} from "@/lib/services/anthropic-direct-fallback";
import { runWithLlmTimeoutSimple } from "@/lib/services/cost-runaway-guard";

function formatPublisherError(err: unknown): Error {
  if (err instanceof Error && err.message && !err.message.includes("undefined undefined")) {
    return err;
  }
  const rec = err && typeof err === "object" ? (err as Record<string, unknown>) : {};
  const parts = [rec.message, rec.code, rec.details, rec.status]
    .map((v) => (v == null ? "" : String(v).trim()))
    .filter((v) => v && v !== "undefined");
  return new Error(
    parts.length ? `Vertex publisher call failed: ${parts.join(" — ")}` : "Vertex publisher call failed"
  );
}

export async function generatePublisherText(params: {
  modelPath: string;
  prompt: string;
  maxTokens: number;
  temperature: number;
  timeoutLabel: string;
}): Promise<string> {
  const { modelPath, prompt, maxTokens, temperature, timeoutLabel } = params;

  if (isGooglePublisherModelPath(modelPath)) {
    const model = getVertexGenerativeModelForId(publisherModelIdFromPath(modelPath));
    const result = await runWithLlmTimeoutSimple(timeoutLabel, () =>
      model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature, maxOutputTokens: maxTokens },
      })
    );
    return result.response?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  }

  if (isAnthropicPublisherModelPath(modelPath) && resolveAnthropicApiKey()) {
    return runAnthropicDirectPublisherModel({
      modelPath,
      prompt,
      maxTokens,
      temperature,
    });
  }

  try {
    const client = new v1beta1.PredictionServiceClient(
      vertexPredictionClientOptions(vertexApiEndpointForModelPath(modelPath))
    );
    const [resp] = await runWithLlmTimeoutSimple(timeoutLabel, () =>
      client.generateContent({
        model: modelPath,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature, maxOutputTokens: maxTokens },
      })
    );
    return resp?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  } catch (err) {
    throw formatPublisherError(err);
  }
}
