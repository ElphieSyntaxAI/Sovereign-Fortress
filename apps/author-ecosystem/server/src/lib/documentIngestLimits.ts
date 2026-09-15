/** Upper bounds for document ingest (large planning docs / 30+ scene grids). */
export const MAX_OUTLINE_BEATS = 120;
export const MAX_WIKI_PROPOSED = 120;
export const MAX_SCENE_WIKI_FROM_BEATS = 64;
export const MAX_TABLE_BEATS = 120;
export const MAX_LLM_DOCUMENT_CHARS = 56_000;
/** Planning / world-bible style uploads (structured sheets). */
export const MAX_SOURCE_CHARS = 400_000;
/**
 * Current-draft manuscripts (~80k+ words) — keep full text for narrative library chunking.
 * Wiki/outline CONVERGE still windows; this ceiling is for source retention, not LLM one-shot.
 */
export const MAX_DRAFT_SOURCE_CHARS = 1_200_000;
/**
 * Max excerpt per RAG wiki row.
 * Lore domains (planets / religion / tech) are distilled to fact cards — keep this tight
 * so section dumps never land as "the whole chapter under PLANETS".
 */
export const MAX_RAG_WIKI_EXCERPT = 520;
/** Soft target for a single fact-card excerpt (entity-scoped bullets). */
export const MAX_FACT_CARD_EXCERPT = 420;
/** Large planning docs: 30+ chapter tabs plus macro/synopsis tabs. */
export const MAX_GOOGLE_DOC_TABS = 96;
