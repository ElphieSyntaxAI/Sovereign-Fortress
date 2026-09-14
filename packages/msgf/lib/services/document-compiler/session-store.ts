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
 * Distribution Build ID: MSGF-c122f849-20260911T161212Z-internal
 */
/**
 * Session persistence for MSGF document compiler HTTP API.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  CompilerBeatArtifact,
  CompilerWikiArtifact,
  DocumentCompilerDomainProfile,
  DocumentIngestCompilerState,
} from "./types";

export type DocumentCompilerSessionRow = {
  id: string;
  tenant_id: string;
  domain_profile: DocumentCompilerDomainProfile;
  project_origin: string | null;
  manuscript_id: string | null;
  subject_domain: string | null;
  original_filename: string;
  source_text: string | null;
  compiler_state: DocumentIngestCompilerState | null;
  proposed_wiki: CompilerWikiArtifact[];
  outline_beats: CompilerBeatArtifact[];
  status: "scanning" | "review" | "committed" | "cancelled";
  created_at: string;
  updated_at: string;
};

export async function createDocumentCompilerSession(
  supabase: SupabaseClient,
  params: {
    tenantId: string;
    domainProfile: DocumentCompilerDomainProfile;
    projectOrigin?: string;
    manuscriptId?: string;
    subjectDomain?: string;
    filename?: string;
    sourceText?: string;
  }
): Promise<{ id: string } | { error: string }> {
  const { data, error } = await supabase
    .from("msgf_document_compiler_sessions")
    .insert({
      tenant_id: params.tenantId,
      domain_profile: params.domainProfile,
      project_origin: params.projectOrigin ?? null,
      manuscript_id: params.manuscriptId ?? null,
      subject_domain: params.subjectDomain ?? null,
      original_filename: params.filename ?? "upload",
      source_text: params.sourceText ?? null,
      status: "scanning",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { id: data.id as string };
}

export async function updateDocumentCompilerSession(
  supabase: SupabaseClient,
  sessionId: string,
  patch: Partial<{
    compiler_state: DocumentIngestCompilerState;
    proposed_wiki: CompilerWikiArtifact[];
    outline_beats: CompilerBeatArtifact[];
    status: DocumentCompilerSessionRow["status"];
    source_text: string;
  }>
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from("msgf_document_compiler_sessions")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", sessionId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function loadDocumentCompilerSession(
  supabase: SupabaseClient,
  sessionId: string
): Promise<DocumentCompilerSessionRow | null> {
  const { data, error } = await supabase
    .from("msgf_document_compiler_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();

  if (error || !data) return null;
  return data as DocumentCompilerSessionRow;
}
