import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  AuthorshipQuestion,
  DocumentIngestSlot,
  IngestOutlineBeat,
  ProposedWikiEntry,
  ScanThought,
} from "./documentIngestGate.js";
import {
  authorshipQuestionCount,
  buildAuthorshipQuestionsFromSource,
} from "./documentIngestGate.js";
import type { DocumentIngestMsgfMeta } from "./documentIngestMsgfPipeline.js";
import { runMsgfDocumentConverge } from "./documentIngestMsgfPipeline.js";
import type { IngestPairingDiagnostic } from "./documentIngestRagParser.js";
import type {
  ClarifyingQuestion,
  ContentSignal,
  IngestConflict,
  StoryFingerprint,
} from "./documentIngestStructure.js";

export type { DocumentIngestMsgfMeta };

export async function analyzeDocumentIngest(params: {
  supabase: SupabaseClient;
  tenantId?: string;
  text: string;
  slot: DocumentIngestSlot;
  manuscriptId: string;
  questionCount: number;
}): Promise<{
  thoughts: ScanThought[];
  proposed: ProposedWikiEntry[];
  outline_beats: IngestOutlineBeat[];
  questions: AuthorshipQuestion[];
  content_signals: ContentSignal[];
  story_fingerprint: StoryFingerprint;
  ingest_conflicts: IngestConflict[];
  clarifying_questions: ClarifyingQuestion[];
  pairing_diagnostics: IngestPairingDiagnostic[];
  usedLlm: boolean;
  msgf_meta: DocumentIngestMsgfMeta;
}> {
  const tenantId = params.tenantId?.trim() || params.manuscriptId;
  return runMsgfDocumentConverge({
    supabase: params.supabase,
    tenantId,
    text: params.text,
    slot: params.slot,
    manuscriptId: params.manuscriptId,
    questionCount: params.questionCount,
  });
}

/** @deprecated use analyzeDocumentIngest */
export async function enrichDocumentIngestWithLlm(params: {
  text: string;
  slot: DocumentIngestSlot;
  manuscriptId: string;
  questionCount: number;
  supabase?: SupabaseClient;
  tenantId?: string;
}): Promise<{
  thoughts: ScanThought[];
  proposed: ProposedWikiEntry[];
  outline_beats: IngestOutlineBeat[];
  questions: AuthorshipQuestion[];
  usedLlm: boolean;
  content_signals?: ContentSignal[];
  story_fingerprint?: StoryFingerprint;
  ingest_conflicts?: IngestConflict[];
  clarifying_questions?: ClarifyingQuestion[];
  msgf_meta?: DocumentIngestMsgfMeta;
}> {
  if (!params.supabase) {
    const { extractOutlineBeatsFromText } = await import("./documentIngestOutline.js");
    const { buildHeuristicScanThoughts, heuristicProposedWiki } = await import("./documentIngestGate.js");
    const textBeats = extractOutlineBeatsFromText(params.text);
    return {
      thoughts: buildHeuristicScanThoughts(params.text, params.slot),
      proposed: heuristicProposedWiki(params.text, params.slot, params.manuscriptId),
      outline_beats: textBeats,
      questions: [],
      usedLlm: false,
    };
  }
  return analyzeDocumentIngest({
    supabase: params.supabase,
    tenantId: params.tenantId,
    text: params.text,
    slot: params.slot,
    manuscriptId: params.manuscriptId,
    questionCount: params.questionCount,
  });
}

export function fallbackAuthorshipQuestions(count: number, sourceText?: string): AuthorshipQuestion[] {
  const fromDoc = sourceText?.trim()
    ? buildAuthorshipQuestionsFromSource(sourceText, count)
    : [];
  if (fromDoc.length >= 3) return fromDoc;

  const pool = [
    {
      id: "q1",
      question: "Quote a specific place name or location phrase that appears in your document.",
      hint: "city, town, room",
    },
    {
      id: "q2",
      question: "Name a character or proper noun exactly as written in the text.",
      hint: "capitalized name",
    },
    {
      id: "q3",
      question: "Paste a distinctive object or detail mentioned in the document (a few words).",
      hint: "object",
    },
    {
      id: "q4",
      question: "What distinctive phrase or sentence opening appears in your upload?",
      hint: "first line",
    },
    {
      id: "q5",
      question: "Mention a verb or action word used in a pivotal moment in the text.",
      hint: "action",
    },
  ];
  return pool.slice(0, Math.max(3, Math.min(count, pool.length)));
}

export function resolveQuestionCount(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return authorshipQuestionCount(words);
}
