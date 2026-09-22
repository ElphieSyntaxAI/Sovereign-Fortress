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
 * Distribution Build ID: MSGF-191e80fa-20260921T055901Z-internal
 */
import { GoogleGenerativeAI } from "@google/generative-ai";

function resolveGeminiApiKey(): string {
  return (
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_API_KEY?.trim() ||
    process.env.GCP_API_KEY?.trim() ||
    ""
  );
}

function resolveGeminiChatModel(override?: string): string {
  if (override) return override;
  return (
    process.env.GCP_MODEL_ID?.trim() ||
    process.env.GEMINI_CHAT_MODEL?.trim() ||
    process.env.GEMINI_MODEL?.trim() ||
    "gemini-2.0-flash"
  );
}

export function hasGeminiCredentials(): boolean {
  return Boolean(resolveGeminiApiKey());
}

let genAi: GoogleGenerativeAI | null = null;

function getGenAi(): GoogleGenerativeAI {
  if (!genAi) {
    const apiKey = resolveGeminiApiKey();
    if (!apiKey) {
      throw new Error("Missing Gemini API key — set GCP_API_KEY, GEMINI_API_KEY, or GOOGLE_API_KEY");
    }
    genAi = new GoogleGenerativeAI(apiKey);
  }
  return genAi;
}

export async function generateCompilerBullets(opts: {
  system: string;
  user: string;
  model?: string;
}): Promise<string> {
  const model = getGenAi().getGenerativeModel({
    model: resolveGeminiChatModel(opts.model),
    systemInstruction: opts.system,
  });
  const result = await model.generateContent(opts.user);
  const text = result.response.text();
  if (!text) throw new Error("Gemini generateContent returned empty text");
  return text;
}
