import { bffAuthHeaders, bffCredentials, bffUrl } from "./bffFetch";

export type ScanThought = { line: string; phase: string };

export type ProposedWiki = {
  title: string;
  excerpt: string;
  chunk_type: string;
  tags: string[];
  wiki_metadata?: Record<string, unknown>;
};

export type ContentSignal = {
  kind: string;
  confidence: string;
  evidence: string;
};

export type IngestConflict = {
  code: string;
  severity: "blocking" | "warning";
  message: string;
};

export type ClarifyingQuestion = {
  id: string;
  code: string;
  question: string;
  hint?: string;
  required: boolean;
  options?: string[];
};

export type OnboardingStatus = {
  hal_startup_completed: boolean;
  hal_startup_prompt: string;
  hal_startup_target_seconds: number;
  hal_startup_min_words: number;
  document_review: {
    session_id: string;
    slot: string;
    slot_label: string;
    proposed_wiki: ProposedWiki[];
    outline_beats?: Array<{ synopsis: string; order: number }>;
    scan_thoughts: ScanThought[];
    content_signals?: ContentSignal[];
    ingest_conflicts?: IngestConflict[];
    clarifying_questions?: ClarifyingQuestion[];
  } | null;
};

export async function fetchOnboardingStatus(
  getToken: () => string | null | Promise<string | null>
): Promise<OnboardingStatus> {
  const token = await getToken();
  const res = await fetch(bffUrl("/api/onboarding/status"), {
    ...bffCredentials,
    headers: bffAuthHeaders(token),
  });
  const json = (await res.json().catch(() => ({}))) as OnboardingStatus & { error?: string };
  if (!res.ok) throw new Error(json.error || res.statusText);
  return json;
}
