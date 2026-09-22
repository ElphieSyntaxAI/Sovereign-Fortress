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
 * Distribution Build ID: MSGF-570add3d-20260922T212921Z-internal
 */
/**
 * Prompt template registry — versioned bodies + prompt_hash for fitness lineage.
 */

import { createHash } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

export function hashPromptTemplateBody(body: string): string {
  return createHash("sha256").update(body.trim(), "utf8").digest("hex");
}

export type PromptTemplateRow = {
  id: string;
  tenant_id: string;
  name: string;
  version: number;
  prompt_hash: string;
  template_body: string;
  created_at: string;
};

export async function listPromptTemplates(
  admin: SupabaseClient,
  tenantId: string,
  name?: string | null
): Promise<PromptTemplateRow[]> {
  let q = admin
    .from("msgf_prompt_templates")
    .select("id, tenant_id, name, version, prompt_hash, template_body, created_at")
    .eq("tenant_id", tenantId.trim())
    .order("name", { ascending: true })
    .order("version", { ascending: false })
    .limit(100);
  if (name?.trim()) q = q.eq("name", name.trim());
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as PromptTemplateRow[];
}

export async function createPromptTemplateVersion(
  admin: SupabaseClient,
  opts: { tenant_id: string; name: string; template_body: string }
): Promise<PromptTemplateRow> {
  const tid = opts.tenant_id.trim();
  const name = opts.name.trim();
  const body = opts.template_body;
  if (!tid || !name) throw new Error("tenant_id and name required");

  const { data: latest } = await admin
    .from("msgf_prompt_templates")
    .select("version")
    .eq("tenant_id", tid)
    .eq("name", name)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const version = Number(latest?.version ?? 0) + 1;
  const prompt_hash = hashPromptTemplateBody(body);

  const { data, error } = await admin
    .from("msgf_prompt_templates")
    .insert({
      tenant_id: tid,
      name,
      version,
      prompt_hash,
      template_body: body,
    })
    .select("id, tenant_id, name, version, prompt_hash, template_body, created_at")
    .maybeSingle();

  if (error || !data) throw new Error(error?.message ?? "insert failed");
  return data as PromptTemplateRow;
}

export function diffTemplateBodies(a: string, b: string): {
  added: number;
  removed: number;
  preview: string;
} {
  const aLines = a.split(/\r?\n/);
  const bLines = b.split(/\r?\n/);
  const aSet = new Set(aLines);
  const bSet = new Set(bLines);
  let added = 0;
  let removed = 0;
  for (const line of bLines) if (!aSet.has(line)) added += 1;
  for (const line of aLines) if (!bSet.has(line)) removed += 1;
  const preview = [
    `--- v-prev (${aLines.length} lines)`,
    `+++ v-next (${bLines.length} lines)`,
    `@@ -${removed} +${added} @@`,
    ...bLines.slice(0, 40).map((l, i) => (aLines[i] === l ? ` ${l}` : `+${l}`)),
  ].join("\n");
  return { added, removed, preview };
}
