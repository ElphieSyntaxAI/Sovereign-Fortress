// lib/msgf-ingest.ts
import { supabase } from "./supabase";
import { generateEmbedding } from "./ai-utils"; // Your existing embedding logic

type IngestFile = { path: string; content: string };

export function determineCategory(filePath: string): string {
  const p = filePath.toLowerCase();
  if (p.includes("auth")) return "Auth";
  if (p.includes("api")) return "API";
  if (p.includes("ui") || p.includes("component") || p.includes("app/")) return "UI";
  if (p.includes("db") || p.includes("sql") || p.includes("migration")) return "Data";
  return "Core";
}

export function determineBranch(filePath: string): string {
  const parts = filePath.replace(/\\/g, "/").split("/").filter(Boolean);
  if (parts.length >= 2) return `${parts[parts.length - 2]}_${parts[parts.length - 1]}`;
  return parts[0] || "root";
}

export async function sweepAndIngest(files: IngestFile[]) {
  const auditLogs: string[] = ["# MSGF V3.2 ULTRA - Pre-Ingestion Audit\n"];

  for (const file of files) {
    // 1. Shard into 1.1.1 Genealogical Index
    const category = determineCategory(file.path); // Logic to map path to 1.0
    const branch = determineBranch(file.path); // Logic to map path to 1.1

    // 2. Generate Cold Layer Entry (Vector + Metadata)
    const embedding = await generateEmbedding(file.content);

    const { error } = await supabase.from("pillar_vectors").insert({
      pillar: "P6",
      ledger: "vault",
      index_type: "genealogical_bug_index",
      category,
      branch,
      instance: "1.1.1",
      content: file.content,
      embedding: embedding,
      metadata: {
        ingested_at: new Date().toISOString(),
        original_path: file.path,
        is_baseline: true,
      },
    });

    if (!error) {
      auditLogs.push(
        `- [MATCH] Ingested ${file.path} into ${category}.${branch}.1.1.1`
      );
    } else {
      auditLogs.push(`- [ERROR] Failed to ingest ${file.path}: ${error.message}`);
    }
  }

  return auditLogs.join("\n");
}

