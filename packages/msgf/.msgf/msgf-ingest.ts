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
 * Distribution Build ID: MSGF-81e8259-20260519T153428Z-internal
 */
import fs from 'fs';
import { join, basename, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from "@google/generative-ai"; // Updated SDK
import * as dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const monorepoRoot = join(__dirname, '..', '..', '..');
dotenv.config({ path: join(monorepoRoot, '.env') });
dotenv.config({ path: join(monorepoRoot, '.env.local'), override: true });
dotenv.config({ path: join(__dirname, '..', '.env') });
dotenv.config({ path: join(__dirname, '..', '.env.local'), override: true });

// --- Logging System ---
const log = (msg: string) => {
  const line = `[${new Date().toLocaleTimeString()}] ${msg}`;
  console.log(line);
  try {
    fs.appendFileSync(join(__dirname, '..', 'ingest-log.txt'), line + '\n');
  } catch (e) {
    // If file is locked, just print to console
  }
};

// --- Initialization ---
// Using GoogleGenerativeAI (the 2026 standard)
const genAI = new GoogleGenerativeAI(process.env.GCP_API_KEY || ""); 
// Note: If you prefer using your gcp-key.json, stick with the Vertex SDK, 
// but for most, the API Key from Google AI Studio is easier.

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function ingestFile(filePath: string) {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    if (!content.trim()) return;

    // Correct 2026 Method for Embeddings
    const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
    const result = await model.embedContent(content);
    const embedding = result.embedding.values;

    if (!embedding) throw new Error("No embedding values returned.");

    const { error } = await supabase.from("pillar_vectors").insert({
      content,
      embedding,
      metadata: { file: basename(filePath), path: filePath },
    });

    if (error) throw new Error(`Supabase: ${error.message}`);
    log(`✅ Success: ${basename(filePath)}`);

  } catch (err: any) {
    log(`❌ Fail: ${basename(filePath)} -> ${err.message || err}`);
  }
}

async function ingestFolder(folderPath: string) {
  const entries = fs.readdirSync(folderPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(folderPath, entry.name);
    if (entry.name === "node_modules" || entry.name === ".git" || entry.name.startsWith(".")) continue;

    if (entry.isDirectory()) {
      await ingestFolder(fullPath);
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      await ingestFile(fullPath);
    }
  }
}

log("🚀 Starting MSGF 2026 Ingest...");
ingestFolder(join(__dirname, "..")).then(() => log("🏁 Finished."));