/** Types shared by Librarian HTTP clients and `LibrarianTerminal`. */

export type LibrarianLanguageCode = "en" | "es" | "ja";

export type LibrarianRetrievedChunk = {
  id: string;
  content: string;
  source_document: string;
  chunk_type: string;
  chunk_index?: number;
  metadata?: Record<string, unknown>;
  cosine_similarity?: number;
};

export type LibrarianAskBody = {
  tenantId: string;
  question: string;
  topK?: number;
  audience?: "fan" | "author";
  chunkTypes?: Array<"lore" | "plot" | "character">;
  enforceMode?: "strict" | "strip";
  /** When set, aligns answer language with UI locale (see `LibrarianChat.ask`). */
  language?: LibrarianLanguageCode;
  languageDetection?: "heuristic" | "gemini";
  tenantScope?: "author" | "school";
};

export type LibrarianAskSuccess = {
  ok: true;
  answer: string;
  detectedLanguage: LibrarianLanguageCode;
  tenantScope: string;
  retrievedChunks: LibrarianRetrievedChunk[];
};

export type HalSessionBody = {
  tenantId: string;
  manuscriptId: string;
  keystrokeLatencies: number[];
  contentDelta?: string;
  authorUserId?: string;
  identityRoot?: boolean;
  locale?: LibrarianLanguageCode;
  isImeSession?: boolean;
  compositionEvents?: string[];
  committedBlockLatenciesMs?: number[];
  compositionBlocks?: number[][];
};

export type HalSessionSuccess = {
  ok: true;
  id: string;
  sessionId: string;
  createdAt: string;
  locale: LibrarianLanguageCode;
  is_ime_session: boolean;
  typingScore?: number;
  halScore?: number;
  is_training_phase?: boolean;
};
