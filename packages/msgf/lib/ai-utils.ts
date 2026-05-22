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
 * Distribution Build ID: MSGF-0265450-20260522T171829Z-internal
 */
import { GoogleGenerativeAI } from "@google/generative-ai";

function fallbackEmbedding(input: string, size = 1536): number[] {
  // Deterministic fallback so ingestion can proceed in degraded mode.
  const vec = new Array<number>(size).fill(0);
  for (let i = 0; i < input.length; i++) {
    const idx = i % size;
    vec[idx] += input.charCodeAt(i) / 255;
  }
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

export async function generateEmbedding(content: string): Promise<number[]> {
  const apiKey = process.env.GCP_API_KEY;
  if (!apiKey) {
    return fallbackEmbedding(content);
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
    const result = await model.embedContent(content);
    const values = result.embedding.values;
    if (!values?.length) return fallbackEmbedding(content);
    return values;
  } catch {
    return fallbackEmbedding(content);
  }
}

