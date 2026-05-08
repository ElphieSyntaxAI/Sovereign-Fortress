/**
 * Slow-time batching for comprehensive consistency audits via the Lore Librarian.
 *
 * Schedule `processNightlyBatch(supabase)` from a nightly cron (e.g. GitHub Actions, Vercel Cron,
 * or `node-cron` beside the author-ecosystem server). Service-role Supabase is required.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { LibrarianChat, type LibrarianAskResult } from "./narrative/LibrarianChat.js";

export type AuditQueueStatus = "PENDING" | "PROCESSING" | "COMPLETE" | "FAILED";

export type P4AuditQueueRow = {
  id: string;
  tenant_id: string;
  manuscript_id: string;
  priority: number;
  status: AuditQueueStatus;
  comprehensive_report: ComprehensiveConsistencyReport | null;
  last_error: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
};

export type ComprehensiveConsistencyReport = {
  schema: "comprehensive_consistency_report.v1";
  generatedAt: string;
  manuscriptId: string;
  tenantId: string;
  manuscriptTitle: string | null;
  librarian: Pick<LibrarianAskResult, "answer" | "detectedLanguage"> & {
    retrievedChunks: Array<{
      id: string;
      source_document: string;
      chunk_type: string;
      cosine_similarity: number;
    }>;
  };
};

const DEFAULT_NIGHTLY_MAX = 8;
const MANUSCRIPT_EXCERPT_WORDS = 900;

function truncateWords(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return words.join(" ");
  return `${words.slice(0, maxWords).join(" ")} …`;
}

function buildComprehensiveConsistencyQuestion(
  title: string | null,
  body: string
): string {
  const excerpt = truncateWords(body, MANUSCRIPT_EXCERPT_WORDS);
  return [
    "You are producing a **Comprehensive Consistency Report** for an author manuscript.",
    "Use ONLY the retrieved Canon context for Canon-labeled bullets; use Scientific Inference bullets for real-world logic checks.",
    "Cover: timeline continuity, character fact consistency, world-rule alignment, unresolved callbacks, and likely reader confusion.",
    "End with a short **Risk Register** table (markdown): columns Finding | Severity (Low/Med/High) | Suggested verification step.",
    "",
    `Manuscript title: ${title?.trim() || "(untitled)"}`,
    "",
    "--- Manuscript excerpt (for orientation; canon facts must still come from retrieved context) ---",
    excerpt,
    "--- End excerpt ---",
  ].join("\n");
}

function toStoredReport(
  tenantId: string,
  manuscriptId: string,
  title: string | null,
  res: LibrarianAskResult
): ComprehensiveConsistencyReport {
  return {
    schema: "comprehensive_consistency_report.v1",
    generatedAt: new Date().toISOString(),
    manuscriptId,
    tenantId,
    manuscriptTitle: title,
    librarian: {
      answer: res.answer,
      detectedLanguage: res.detectedLanguage,
      retrievedChunks: res.retrievedChunks.map((c) => ({
        id: c.id,
        source_document: c.source_document,
        chunk_type: c.chunk_type,
        cosine_similarity: c.cosine_similarity,
      })),
    },
  };
}

async function insertDrawerProgressSignal(
  supabase: SupabaseClient,
  tenantId: string,
  manuscriptId: string,
  title: string | null
): Promise<void> {
  const t = title?.trim() || "Your manuscript";
  const { error } = await supabase.from("p4_author_signal").insert({
    tenant_id: tenantId,
    manuscript_id: manuscriptId,
    kind: "DRAWER_PROGRESS",
    title: "Drawer update",
    body: `${t}: your nightly consistency audit finished. Your Drawer is one step closer to opening — review the new report when you are ready.`,
    payload: {
      milestone: "AUDIT_QUEUE_COMPLETE",
      manuscript_id: manuscriptId,
    },
  });
  if (error) throw new Error(`p4_author_signal insert: ${error.message}`);
}

/**
 * Enqueue a manuscript for the next slow-time batch (idempotent for duplicate pending rows is not enforced — callers may de-dupe).
 */
export async function enqueueAuditQueueEntry(
  supabase: SupabaseClient,
  input: { tenantId: string; manuscriptId: string; priority?: number }
): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from("p4_audit_queue")
    .insert({
      tenant_id: input.tenantId,
      manuscript_id: input.manuscriptId,
      priority: input.priority ?? 0,
      status: "PENDING",
    })
    .select("id")
    .single();
  if (error) throw new Error(`enqueueAuditQueueEntry: ${error.message}`);
  return { id: (data as { id: string }).id };
}

export type NightlyBatchResult = {
  processed: number;
  succeeded: number;
  failed: number;
  items: Array<{ queueId: string; manuscriptId: string; ok: boolean; error?: string }>;
};

/**
 * Nightly slow-time processor: claims pending rows, runs Librarian comprehensive reports,
 * marks manuscripts `AUDITING_COMPLETE`, and emits Drawer progress signals.
 */
export async function processNightlyBatch(
  supabase: SupabaseClient,
  options?: {
    maxItems?: number;
    librarian?: LibrarianChat;
  }
): Promise<NightlyBatchResult> {
  const maxItems = Math.min(Math.max(options?.maxItems ?? DEFAULT_NIGHTLY_MAX, 1), 50);
  const librarian = options?.librarian ?? new LibrarianChat(supabase);

  const { data: pending, error: qErr } = await supabase
    .from("p4_audit_queue")
    .select("id, tenant_id, manuscript_id")
    .eq("status", "PENDING")
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(maxItems);

  if (qErr) throw new Error(`processNightlyBatch list: ${qErr.message}`);

  const items: NightlyBatchResult["items"] = [];
  let succeeded = 0;
  let failed = 0;

  for (const row of pending ?? []) {
    const queueId = String((row as { id: string }).id);
    const tenantId = String((row as { tenant_id: string }).tenant_id);
    const manuscriptId = String((row as { manuscript_id: string }).manuscript_id);

    const now = new Date().toISOString();
    const { data: claimed, error: claimErr } = await supabase
      .from("p4_audit_queue")
      .update({ status: "PROCESSING", started_at: now })
      .eq("id", queueId)
      .eq("status", "PENDING")
      .select("id")
      .maybeSingle();

    if (claimErr || !claimed) {
      continue;
    }

    try {
      const { data: ms, error: msErr } = await supabase
        .from("p4_manuscripts")
        .select("id, tenant_id, title, body_text, revision_status")
        .eq("id", manuscriptId)
        .maybeSingle();

      if (msErr) throw new Error(msErr.message);
      if (!ms) throw new Error("Manuscript missing");
      const body = String((ms as { body_text?: string | null }).body_text ?? "").trim();
      if (!body) throw new Error("Manuscript body_text empty");

      const title = (ms as { title?: string | null }).title ?? null;
      const question = buildComprehensiveConsistencyQuestion(title, body);

      const askResult = await librarian.ask({
        tenantId,
        question,
        audience: "author",
        enforceMode: "strip",
        topK: 12,
      });

      const report = toStoredReport(tenantId, manuscriptId, title, askResult);

      const { error: upQueueErr } = await supabase
        .from("p4_audit_queue")
        .update({
          status: "COMPLETE",
          comprehensive_report: report as unknown as Record<string, unknown>,
          completed_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("id", queueId);
      if (upQueueErr) throw new Error(upQueueErr.message);

      const { error: upMsErr } = await supabase
        .from("p4_manuscripts")
        .update({
          revision_status: "AUDITING_COMPLETE",
          updated_at: new Date().toISOString(),
        })
        .eq("id", manuscriptId);
      if (upMsErr) throw new Error(upMsErr.message);

      await insertDrawerProgressSignal(supabase, tenantId, manuscriptId, title);

      succeeded += 1;
      items.push({ queueId, manuscriptId, ok: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      failed += 1;
      items.push({ queueId, manuscriptId, ok: false, error: msg });
      await supabase
        .from("p4_audit_queue")
        .update({
          status: "FAILED",
          last_error: msg.slice(0, 4000),
          completed_at: new Date().toISOString(),
        })
        .eq("id", queueId);
    }
  }

  return {
    processed: items.length,
    succeeded,
    failed,
    items,
  };
}

export class AuditQueueProcessor {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly librarian?: LibrarianChat
  ) {}

  enqueue(input: { tenantId: string; manuscriptId: string; priority?: number }) {
    return enqueueAuditQueueEntry(this.supabase, input);
  }

  processNightlyBatch(options?: { maxItems?: number }) {
    return processNightlyBatch(this.supabase, {
      maxItems: options?.maxItems,
      librarian: this.librarian,
    });
  }
}
