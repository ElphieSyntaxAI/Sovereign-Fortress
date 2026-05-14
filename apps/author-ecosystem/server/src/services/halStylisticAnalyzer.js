/**
 * HAL Stylistic Analyzer — chapter submission vs HUD (Canon / Real-world) bullets.
 * Produces lexical + syntactic metrics and an authorship_delta_score for wiki_snapshot metadata (Git-style versioning).
 */

const STYLISTIC_ANALYSIS_VERSION = 2;
const ANALYZER_SEMVER = "2.0.0";

/** @type {ReadonlySet<string>} */
const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "that",
  "this",
  "with",
  "from",
  "have",
  "has",
  "was",
  "were",
  "are",
  "but",
  "not",
  "you",
  "all",
  "can",
  "her",
  "his",
  "they",
  "them",
  "into",
  "about",
  "than",
  "then",
  "too",
  "very",
  "when",
  "what",
  "who",
  "will",
  "your",
  "one",
  "our",
]);

function clamp01(x) {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function round4(n) {
  return Math.round(n * 10000) / 10000;
}

/**
 * Lowercase tokens; strips HUD bracket tags and bullet markers for overlap against prose.
 * @param {string} text
 * @returns {string[]}
 */
function tokenizeForLexical(text) {
  const stripped = String(text || "")
    .replace(/\[(?:CANON|REAL-WORLD|WARNING)\]\s*/gi, " ")
    .replace(/^[-*•]\s+/gm, " ")
    .toLowerCase();
  return stripped
    .split(/[^a-z0-9']+/g)
    .map((t) => t.replace(/^'+|'+$/g, ""))
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/**
 * @param {string} text
 */
function splitSentences(text) {
  const raw = String(text || "").trim();
  if (!raw) return [];
  return raw
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * @param {string} text
 */
function syntacticMetrics(text) {
  const sentences = splitSentences(text);
  const words = String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const commas = (String(text || "").match(/,/g) || []).length;
  const avgSentenceLength =
    sentences.length > 0 ? words.length / Math.max(1, sentences.length) : words.length > 0 ? words.length : 0;
  const commaDensity = words.length > 0 ? commas / words.length : 0;
  const longWordRatio =
    words.length > 0 ? words.filter((w) => w.replace(/[^a-zA-Z]/g, "").length >= 8).length / words.length : 0;

  return {
    sentence_count: sentences.length,
    word_count: words.length,
    avg_sentence_length: round4(avgSentenceLength),
    comma_density: round4(commaDensity),
    long_word_ratio: round4(longWordRatio),
  };
}

/**
 * Type-token ratio (simple lexical diversity).
 * @param {string[]} tokens
 */
function typeTokenRatio(tokens) {
  if (!tokens.length) return 0;
  return new Set(tokens).size / tokens.length;
}

/**
 * @param {Set<string>} a
 * @param {Set<string>} b
 */
function jaccardSets(a, b) {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const x of a) {
    if (b.has(x)) inter += 1;
  }
  const union = a.size + b.size - inter;
  return union > 0 ? inter / union : 0;
}

/**
 * @param {string} chapterLower
 * @param {string[]} phrases
 */
function countPetPhraseHits(chapterLower, phrases) {
  if (!phrases || !phrases.length) return 0;
  let hits = 0;
  for (const p of phrases) {
    const s = String(p || "").trim().toLowerCase();
    if (s.length < 2) continue;
    if (chapterLower.includes(s)) hits += 1;
  }
  return hits;
}

/**
 * Compare chapter submission to HUD bullet text + HAL stylistic hints.
 * High authorship_delta_score ⇒ chapter voice diverges from dense HUD facts and aligns with human stylistic signals.
 *
 * @param {{
 *   chapterText: string,
 *   hudAnswerBullets?: string | null,
 *   stylisticMetadata?: { pet_phrases?: string[], sentence_complexity?: Record<string, unknown> } | null
 * }} input
 * @returns {{
 *   authorship_delta_score: number,
 *   stylistic_analysis_version: number,
 *   stylistic_analysis: Record<string, unknown>
 * }}
 */
function analyzeChapterSubmission({ chapterText, hudAnswerBullets = null, stylisticMetadata = null }) {
  const chapter = String(chapterText || "");
  const chapterLower = chapter.toLowerCase();
  const chapterTokens = tokenizeForLexical(chapter);
  const bulletTokens = tokenizeForLexical(String(hudAnswerBullets || ""));

  const chapterTypes = new Set(chapterTokens);
  const bulletTypes = new Set(bulletTokens);
  const jaccard = jaccardSets(chapterTypes, bulletTypes);
  const ttrChapter = typeTokenRatio(chapterTokens);

  const synChapter = syntacticMetrics(chapter);
  const synBullets = syntacticMetrics(String(hudAnswerBullets || ""));
  const syntacticSpread = clamp01(Math.abs(synChapter.avg_sentence_length - synBullets.avg_sentence_length) / 28);

  const petPhrases = Array.isArray(stylisticMetadata?.pet_phrases) ? stylisticMetadata.pet_phrases : [];
  const petHits = countPetPhraseHits(chapterLower, petPhrases);

  /** Lexical Jaccard arm: low token overlap with HUD bullets ⇒ prose is not only parroting HUD topic words. */
  const lexicalJaccardArm = bulletTypes.size === 0 ? 0.55 : clamp01(1 - jaccard);
  const diversityTerm = clamp01(ttrChapter / 0.52);
  const petTerm = clamp01(Math.min(petHits * 0.22, 1));

  /** Optional: compare HAL-reported avg sentence length to chapter if present */
  let halSpreadTerm = 0;
  const sc = stylisticMetadata?.sentence_complexity;
  const halAsl =
    sc && typeof sc === "object" && Number.isFinite(Number(sc.average_sentence_length))
      ? Number(sc.average_sentence_length)
      : null;
  if (halAsl != null && synChapter.avg_sentence_length > 0) {
    halSpreadTerm = clamp01(Math.abs(synChapter.avg_sentence_length - halAsl) / 22);
  }

  /** 70% syntactic spread vs 30% lexical (1 − Jaccard) — rhythm / structure over shared HUD vocabulary. */
  const syntacticVoice = clamp01(0.78 * syntacticSpread + 0.22 * halSpreadTerm);
  const soulVsTopicCore = clamp01(0.7 * syntacticVoice + 0.3 * lexicalJaccardArm);

  const authorship_delta_score = round4(0.86 * soulVsTopicCore + 0.08 * diversityTerm + 0.06 * petTerm);

  const stylistic_analysis = {
    analyzer_semver: ANALYZER_SEMVER,
    analyzed_at: new Date().toISOString(),
    authorship_delta_score,
    interpretation:
      "Higher score: chapter syntactic profile (sentence rhythm vs HUD bullets) outweighs shared vocabulary with HUD; HAL pet-phrase / diversity terms add a small boost. Emphasizes how you write over repeating what the HUD said.",
    lexical: {
      type_token_ratio: round4(ttrChapter),
      token_count: chapterTokens.length,
      unique_token_count: chapterTypes.size,
      jaccard_vs_hud_bullets: bulletTypes.size === 0 ? null : round4(jaccard),
      lexical_jaccard_arm: round4(lexicalJaccardArm),
    },
    syntactic: {
      chapter: synChapter,
      hud_bullets: synBullets,
      spread_index: round4(syntacticSpread),
    },
    hal_alignment: {
      pet_phrase_hits: petHits,
      sentence_complexity_delta: halAsl != null ? round4(Math.abs(synChapter.avg_sentence_length - halAsl)) : null,
    },
  };

  return {
    authorship_delta_score,
    stylistic_analysis_version: STYLISTIC_ANALYSIS_VERSION,
    stylistic_analysis,
  };
}

module.exports = {
  analyzeChapterSubmission,
  STYLISTIC_ANALYSIS_VERSION,
  ANALYZER_SEMVER,
};
