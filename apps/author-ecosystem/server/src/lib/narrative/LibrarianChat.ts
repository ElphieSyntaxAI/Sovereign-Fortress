import type { SupabaseClient } from "@supabase/supabase-js";

import { retrieveP4NarrativeChunks } from "../p4RagRetrieval.js";
import { createOpenAIEmbedder, type EmbedBatchFn } from "./IngestionService.js";

/** Supported answer / question languages for the Librarian. */
export type LibrarianLanguage = "en" | "es" | "ja";

export const LIBRARIAN_LANGUAGE_LABEL: Record<LibrarianLanguage, string> = {
  en: "English",
  es: "Spanish",
  ja: "Japanese",
};

/** Tenant mode: school enables “Teaching” rules in the system prompt. */
export type LibrarianTenantScope = "author" | "school";

export type LibrarianLanguageDetectionMode = "heuristic" | "gemini";

function countCharClass(sample: string, re: RegExp): number {
  const m = sample.match(re);
  return m?.length ?? 0;
}

/**
 * Lightweight script / marker–based detection (no network).
 * Order: Japanese scripts → Spanish cues → default English.
 */
export function detectLibrarianLanguageHeuristic(text: string): LibrarianLanguage {
  const sample = text.slice(0, 2500);
  const noSpaceLen = sample.replace(/[\s\p{N}\p{P}\p{S}]/gu, "").length || 1;

  const hiragana = countCharClass(sample, /[\u3040-\u309F]/g);
  const katakana = countCharClass(sample, /[\u30A0-\u30FF]/g);
  const cjk = countCharClass(sample, /[\u4E00-\u9FFF\u3400-\u4DBF]/g);

  if (hiragana + katakana >= 2) return "ja";
  if (cjk >= 4 && (hiragana + katakana >= 1 || cjk / noSpaceLen > 0.2)) return "ja";
  if (cjk / noSpaceLen > 0.45) return "ja";

  const spanishStrong =
    /[¿¡]/.test(sample) ||
    /[ñÑ]/.test(sample) ||
    /\b(qué|cómo|dónde|cuándo|por\s+qué|muy|también|señor|señora|años?|días?|niños?)\b/i.test(
      sample
    ) ||
    /\b(el|la|los|las|un|una)\s+[áéíóúñ]/i.test(sample);

  if (spanishStrong) return "es";

  return "en";
}

const GEMINI_DETECT_MODEL_DEFAULT = "gemini-2.0-flash";

/**
 * Optional Gemini classification (single short completion). Falls back to heuristic if the call fails.
 */
export async function detectLibrarianLanguageWithGemini(
  question: string,
  apiKey: string,
  model: string = process.env.GEMINI_MODEL?.trim() || GEMINI_DETECT_MODEL_DEFAULT
): Promise<LibrarianLanguage> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Classify the language of the user message for an API.
Reply with exactly one lowercase token, no punctuation or explanation: en, es, or ja.
- en = English
- es = Spanish
- ja = Japanese (Hiragana, Katakana, or Kanji)

User message:
"""
${question.slice(0, 4000)}
"""`,
            },
          ],
        },
      ],
      generationConfig: { temperature: 0.1, maxOutputTokens: 16 },
    }),
  });

  if (!res.ok) {
    return detectLibrarianLanguageHeuristic(question);
  }

  const body = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const raw = body.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toLowerCase() ?? "";
  const token = raw.split(/\s+/)[0] ?? "";
  if (token.startsWith("ja")) return "ja";
  if (token.startsWith("es")) return "es";
  if (token.startsWith("en")) return "en";
  return detectLibrarianLanguageHeuristic(question);
}

export async function detectLibrarianLanguage(
  question: string,
  mode: LibrarianLanguageDetectionMode = "heuristic"
): Promise<LibrarianLanguage> {
  if (mode !== "gemini") {
    return detectLibrarianLanguageHeuristic(question);
  }
  const key = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();
  if (!key) {
    return detectLibrarianLanguageHeuristic(question);
  }
  return detectLibrarianLanguageWithGemini(question, key);
}

/** Strip list markers and leading markdown asterisks before prefix checks. */
export function remainderForLabel(line: string): string {
  let s = line.trim();
  s = s.replace(/^[-*•‧・]+\s*/, "");
  while (/^\*+/.test(s)) {
    s = s.replace(/^\*+\s*/, "");
  }
  s = s.replace(/^[\s\u3000]+/, "");
  return s.trim();
}

/** Leading optional markdown bold before Kanji/Latin label (e.g. `**カノン`). */
const LEAD_MD_BOLD = String.raw`(?:\*{0,2})?`;

/**
 * Canon bullet prefix (Unicode-aware: Kanji, fullwidth colon, optional bold).
 * EN/ES: `Canon:` (ASCII). ES also `Canónico:` / `Canónica:`.
 * JA: **カノン (Canon):** or カノン（Canon）： — half/full parens and colons.
 */
const RE_CANON_PREFIX: Record<LibrarianLanguage, RegExp> = {
  en: new RegExp(
    `^${LEAD_MD_BOLD}Canon\\s*:\\s*`,
    "iu"
  ),
  es: new RegExp(
    `^${LEAD_MD_BOLD}(?:Canon|Canónico|Canónica)\\s*:\\s*`,
    "iu"
  ),
  ja: new RegExp(
    `^${LEAD_MD_BOLD}カノン\\s*(?:\\(\\s*Canon\\s*\\)|（\\s*Canon\\s*）)?\\s*[:：]\\s*`,
    "u"
  ),
};

/**
 * Inference bullet prefix.
 * EN: Scientific Inference:
 * ES: Inferencia Científica: (accented Científica)
 * JA: 科学的推論 (Inference): — also legacy 科学推論 (Scientific Inference):
 */
const RE_INFERENCE_PREFIX: Record<LibrarianLanguage, RegExp> = {
  en: new RegExp(
    `^${LEAD_MD_BOLD}Scientific\\s+Inference\\s*:\\s*`,
    "iu"
  ),
  es: new RegExp(
    `^${LEAD_MD_BOLD}Inferencia\\s+Científica\\s*:\\s*`,
    "iu"
  ),
  ja: new RegExp(
    `^${LEAD_MD_BOLD}(?:科学的推論\\s*(?:\\(\\s*Inference\\s*\\)|（\\s*Inference\\s*）)?|科学推論\\s*(?:\\(\\s*Scientific\\s+Inference\\s*\\)|（\\s*Scientific\\s+Inference\\s*）)?)\\s*[:：]\\s*`,
    "u"
  ),
};

export function matchesCanonPrefix(s: string, lang: LibrarianLanguage): boolean {
  if (RE_CANON_PREFIX[lang].test(s)) return true;
  if (lang !== "en" && RE_CANON_PREFIX.en.test(s)) return true;
  return false;
}

export function matchesInferencePrefix(s: string, lang: LibrarianLanguage): boolean {
  if (RE_INFERENCE_PREFIX[lang].test(s)) return true;
  // Universal English inference token allowed in any answer language
  if (lang !== "en" && RE_INFERENCE_PREFIX.en.test(s)) return true;
  return false;
}

export function hasValidCanonOrInferencePrefix(s: string, lang: LibrarianLanguage): boolean {
  return matchesCanonPrefix(s, lang) || matchesInferencePrefix(s, lang);
}

export type LibrarianAudienceMode = "fan" | "author";

export type EnforceBulletsMode = "strict" | "strip";

function looksBulletish(line: string, lang: LibrarianLanguage): boolean {
  const t = line.trim();
  if (/^[-*•‧・]/.test(t)) return true;
  return hasValidCanonOrInferencePrefix(remainderForLabel(t), lang);
}

function localizedPrefixError(lang: LibrarianLanguage): string {
  if (lang === "es") {
    return "Each bullet must start with Canon: (or Canónico:/Canónica:) or Inferencia Científica: (or Scientific Inference:)";
  }
  if (lang === "ja") {
    return "Each bullet must start with カノン (Canon): or 科学的推論 (Inference): (or legacy Scientific Inference labels)";
  }
  return "Each bullet must start with 'Canon:' or 'Scientific Inference:'";
}

const TEACHING_MODE_RULE_EN =
  "Teaching mode (school): Explain WHY a piece of information is Scientific Inference (e.g., based on physics or logic) to help the student understand the difference between text evidence and reasoning. Apply this on each inference bullet, briefly.";

const TEACHING_MODE_RULE_ES =
  "Modo enseñanza (escuela): en cada viñeta de inferencia, explica brevemente POR QUÉ es inferencia científica o lógica (p. ej., qué principio físico o matemático) para que el alumno distinga evidencia textual del razonamiento.";

const TEACHING_MODE_RULE_JA =
  "授業モード（学校）: 「科学的推論」の各箇条書きで、なぜそれが科学的・論理的推論に当たるか（例：どの物理法則や論理に基づくか）を短く示し、本文の証拠と推論の違いが分かるようにしてください。";

function teachingModeBlock(lang: LibrarianLanguage): string {
  if (lang === "es") return TEACHING_MODE_RULE_ES;
  if (lang === "ja") return TEACHING_MODE_RULE_JA;
  return TEACHING_MODE_RULE_EN;
}

export type BuildLibrarianSystemPromptOptions = {
  tenantScope?: LibrarianTenantScope;
};

/**
 * Fully localized Lore Librarian system prompt (Canon vs inference labels per language).
 */
export function buildLibrarianSystemPrompt(
  lang: LibrarianLanguage,
  options: BuildLibrarianSystemPromptOptions = {}
): string {
  const L = LIBRARIAN_LANGUAGE_LABEL[lang];
  const isSchool = options.tenantScope === "school";

  if (lang === "ja") {
    const parts = [
      `あなたはロア・ライブラリアンです。ユーザーは${L}で質問しています。提供されたカノン（本文）コンテキストに基づき、**回答全体を${L}で**書いてください。`,
      "カノン・コンテキストの言語が質問と異なってもよいです。カノン箇条書きではそのテキストで裏付けられる内容のみを述べ、創作の事実は作らないでください。",
      "出力は箇条書きのみにしてください。",
      "各箇条書きは、次のいずれかで始めてください（太字 `**` 可、全角コロン `：` 可）:",
      "- **カノン (Canon):** — 提供されたカノン・コンテキストのみに根ざす事実。",
      "- **科学的推論 (Inference):** — 科学・数学・現実世界の知識に基づく推論のみ。物語の新事実（固有名・出来事・場所など）は作らない。前提が必要ならその箇条書き内で明示する。",
      "カノンのルール:",
      "- カノン箇条書きは提供されたカノン・コンテキストのみで裏付けられること。",
      "- コンテキストにない場合は、カノン箇条書きでその旨を述べる（事実を捏造しない）。",
      "科学的推論のルール:",
      "- 科学・数学・現実世界の論理に限る。",
      "- カノンの新事実を捏造しない。",
      "- 不明なカノン値に依存する場合は、その箇条書きで前提を明示する。",
    ];
    if (isSchool) parts.push(teachingModeBlock("ja"));
    return parts.join("\n");
  }

  if (lang === "es") {
    const parts = [
      `Eres el Bibliotecario del Lore. El usuario pregunta en ${L}. Debes responder en ${L} usando el contexto canónico proporcionado.`,
      "El contexto canónico puede estar en otro idioma; aún así responde en "
        + `${L} y no inventes hechos narrativos que no estén respaldados por ese texto en las viñetas de canon.`,
      "La salida DEBE ser solo viñetas.",
      "Cada viñeta DEBE empezar exactamente con una de estas etiquetas:",
      "- **Canon:** — hechos tomados solo del contexto canónico.",
      "- **Inferencia Científica:** — razonamiento científico, matemático o del mundo real. También se acepta la etiqueta universal `Scientific Inference:` si lo prefieres.",
      "Reglas de Canon:",
      "- Las viñetas de canon deben estar respaldadas solo por el contexto canónico.",
      "- Si falta canon, dilo en viñetas de canon (no inventes hechos).",
      "Reglas de Inferencia Científica:",
      "- Solo conocimiento científico/matemático/del mundo real.",
      "- Nunca inventes hechos de canon nuevos, nombres, eventos, lugares o detalles de personajes.",
      "- Si una inferencia depende de valores canónicos desconocidos, indica los supuestos explícitamente.",
    ];
    if (isSchool) parts.push(teachingModeBlock("es"));
    return parts.join("\n");
  }

  const parts = [
    `You are the Lore Librarian. The user is asking in ${L}. You must respond in ${L} using the provided Canon context.`,
    "The Canon Context may be written in a different language than the question; still answer in "
      + `${L} using only what is supported by that text for Canon bullets — do not invent story facts.`,
    "Output MUST be bullet points only.",
    "Every bullet MUST begin with exactly one of these labels:",
    "- **Canon:** — facts grounded only in the Canon Context.",
    "- **Scientific Inference:** — real-world, mathematical, or scientific reasoning beyond the text.",
    "Canon rules:",
    "- Canon bullets must be supported by the provided Canon Context only.",
    "- If canon is missing, say so in Canon bullets (do not invent story facts).",
    "Scientific Inference rules:",
    "- Only use scientific/mathematical/real-world knowledge to make logical inferences.",
    "- Never invent new canon facts, names, events, locations, or character details.",
    "- If an inference depends on unknown canon values, state assumptions explicitly in the inference bullet.",
  ];
  if (isSchool) parts.push(teachingModeBlock("en"));
  return parts.join("\n");
}

/**
 * True if the line is a valid Librarian bullet for the given answer language.
 */
export function isValidLibrarianBulletLine(line: string, lang: LibrarianLanguage = "en"): boolean {
  if (!looksBulletish(line, lang)) return false;
  return hasValidCanonOrInferencePrefix(remainderForLabel(line), lang);
}

/**
 * Strict: any bullet-looking line must have a valid localized (or universal) prefix.
 */
export function enforceBulletOnlyCanonInference(
  text: string,
  lang: LibrarianLanguage = "en"
): string {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const bulletish = lines.filter((l) => looksBulletish(l, lang));
  if (bulletish.length === 0) {
    throw new Error("Model output was not bullet points");
  }

  for (const l of bulletish) {
    if (!hasValidCanonOrInferencePrefix(remainderForLabel(l), lang)) {
      throw new Error(localizedPrefixError(lang));
    }
  }

  return bulletish
    .map((l) => remainderForLabel(l))
    .map((l) => `- ${l}`)
    .join("\n");
}

/**
 * Drop non-compliant lines; throw if nothing valid remains.
 */
export function stripAndEnforceBulletOnlyCanonInference(
  text: string,
  lang: LibrarianLanguage = "en"
): string {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const valid = lines.filter((l) => isValidLibrarianBulletLine(l, lang));
  if (valid.length === 0) {
    throw new Error(
      "Model output had no valid Canon / Scientific Inference bullets after stripping"
    );
  }

  return valid
    .map((l) => remainderForLabel(l))
    .map((l) => `- ${l}`)
    .join("\n");
}

export type NarrativeChunkHit = {
  id: string;
  content: string;
  source_document: string;
  chunk_type: string;
  chunk_index: number;
  metadata: Record<string, unknown>;
  cosine_similarity: number;
};

export type LibrarianAskInput = {
  tenantId: string;
  question: string;
  /** Default 8, max 20 */
  topK?: number;
  /** Echoed into the user prompt like legacy `/api/rag/chat`. Default `author` (writing session). */
  audience?: LibrarianAudienceMode;
  /** Optional filter, e.g. `['lore','plot']`. Omit for all chunk types. */
  chunkTypes?: Array<"lore" | "plot" | "character">;
  /**
   * `strict` — same as legacy: any bullet-shaped line must be valid or throw.
   * `strip` — discard invalid lines; throw only if none left.
   */
  enforceMode?: EnforceBulletsMode;
  /** When set, skips auto-detection and fixes answer language + prefix rules. */
  language?: LibrarianLanguage;
  /** Default `heuristic`. `gemini` uses GEMINI_API_KEY / GOOGLE_API_KEY when set, else falls back. */
  languageDetection?: LibrarianLanguageDetectionMode;
  /** `school` enables Teaching mode in the system prompt. Default `author`. */
  tenantScope?: LibrarianTenantScope;
  /** When set, applies series scope and locked-wiki rules for multi-book series. */
  manuscriptId?: string | null;
  /** When false, hides draft wiki snapshots unless locked/canon (legacy HUD). Default false. */
  includeWikiDrafts?: boolean;
};

export type LibrarianAskResult = {
  answer: string;
  retrievedChunks: NarrativeChunkHit[];
  detectedLanguage: LibrarianLanguage;
};

type LibrarianChatOptions = {
  embedBatch?: EmbedBatchFn;
  chatModel?: string;
  /** Default language detection when not overridden per `ask`. */
  languageDetection?: LibrarianLanguageDetectionMode;
};

function clampTopK(n: number | undefined): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return 8;
  return Math.max(1, Math.min(Math.floor(v), 20));
}

function buildCanonContext(rows: NarrativeChunkHit[]): string {
  return rows
    .map((r) => {
      const label = `${r.chunk_type}: ${r.source_document}`;
      return `- [${label}] id=${r.id} sim=${Number(r.cosine_similarity || 0).toFixed(3)}\n${r.content}`;
    })
    .join("\n\n");
}

function buildUserPrompt(
  audience: LibrarianAudienceMode,
  question: string,
  canonContext: string,
  lang: LibrarianLanguage
): string {
  const L = LIBRARIAN_LANGUAGE_LABEL[lang];
  return [
    `Audience Mode: ${audience}`,
    `Answer language: ${L}. The Canon Context below may be in any language; use it for meaning without inventing facts.`,
    "",
    "Question:",
    String(question),
    "",
    "Canon Context:",
    canonContext || "(none found)",
    "",
    "Answer now in " + L + ", using the required bullet labels for " + L + ".",
  ].join("\n");
}

async function openaiChatCompletion(system: string, user: string, model: string): Promise<string> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    throw new Error("OPENAI_API_KEY is required for Lore Librarian chat");
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.35,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`OpenAI chat failed (${res.status}): ${errBody.slice(0, 600)}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = json.choices?.[0]?.message?.content;
  if (content == null || String(content).trim() === "") {
    throw new Error("OpenAI returned empty Librarian reply");
  }
  return String(content);
}

/**
 * Lore Librarian: multilingual Q&A over `p4_narrative_library_chunks`.
 *
 * **Cross-lingual retrieval:** Vector search is pure cosine similarity on embeddings — no language
 * filter. Use a multilingual embedding model (e.g. `text-embedding-3-small`) so a Spanish question
 * can match English (or mixed) lore chunks.
 */
export class LibrarianChat {
  private readonly embedBatch: EmbedBatchFn;
  private readonly chatModel: string;
  private readonly defaultLanguageDetection: LibrarianLanguageDetectionMode;

  constructor(
    private readonly supabase: SupabaseClient,
    options: LibrarianChatOptions = {}
  ) {
    this.embedBatch = options.embedBatch ?? createOpenAIEmbedder();
    this.chatModel =
      options.chatModel?.trim() ||
      process.env.OPENAI_LIBRARIAN_MODEL?.trim() ||
      "gpt-4o-mini";
    this.defaultLanguageDetection = options.languageDetection ?? "heuristic";
  }

  async ask(input: LibrarianAskInput): Promise<LibrarianAskResult> {
    const {
      tenantId,
      question,
      topK,
      audience = "author",
      chunkTypes,
      enforceMode = "strict",
      language: languageOverride,
      languageDetection: detectionOverride,
      tenantScope = "author",
      manuscriptId,
      includeWikiDrafts = false,
    } = input;

    const q = String(question ?? "").trim();
    if (!q) {
      throw new Error("question is required");
    }

    const detectionMode = detectionOverride ?? this.defaultLanguageDetection;
    const detectedLanguage =
      languageOverride ?? (await detectLibrarianLanguage(q, detectionMode));

    const k = clampTopK(topK);
    const { chunks: retrievedChunks } = await retrieveP4NarrativeChunks(this.supabase, {
      tenantId,
      question: q,
      topK: k,
      manuscriptId,
      includeWikiDrafts,
      audience,
      chunkTypes,
      embedBatch: this.embedBatch,
    });

    const system = buildLibrarianSystemPrompt(detectedLanguage, { tenantScope });
    const canonContext = buildCanonContext(retrievedChunks);
    const user = buildUserPrompt(audience, q, canonContext, detectedLanguage);
    const raw = await openaiChatCompletion(system, user, this.chatModel);

    const answer =
      enforceMode === "strip"
        ? stripAndEnforceBulletOnlyCanonInference(raw, detectedLanguage)
        : enforceBulletOnlyCanonInference(raw, detectedLanguage);

    return { answer, retrievedChunks, detectedLanguage };
  }
}

/** @deprecated Use `buildLibrarianSystemPrompt('en')`. */
export const LORE_LIBRARIAN_SYSTEM_PROMPT = buildLibrarianSystemPrompt("en");
