/**
 * Loads RAG / HUD policy rows from `public.msgf_rules` (namespace `rag`).
 * Replaces hardcoded MSGF allowlists in legacy `ragRoutes.js`.
 *
 * @param {(text: string, params?: unknown[]) => Promise<{ rows: { rule_key: string; payload: unknown }[] }>} query
 */
async function loadMsgfRagRules(query) {
  const { rows } = await query(
    `SELECT rule_key, payload FROM public.msgf_rules WHERE rule_namespace = $1`,
    ["rag"]
  );

  const byKey = Object.fromEntries(rows.map((r) => [r.rule_key, r.payload]));
  const required = [
    "source_types",
    "author_only_source_types",
    "plot_point_order_default",
    "hud_min_words",
    "hud_max_words",
    "warning_max_words",
    "rag_master_limit",
  ];
  for (const k of required) {
    if (byKey[k] === undefined || byKey[k] === null) {
      throw new Error(
        `msgf_rules missing rag/${k}. Apply MSGF migration 20260516900000_msgf_legacy_express_tables_and_rules.sql`
      );
    }
  }

  const asArray = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (payload && typeof payload === "object" && Array.isArray(payload.values)) return payload.values;
    throw new Error("msgf_rules payload must be a JSON array or { values: [] }");
  };

  const asNumber = (payload) => {
    if (typeof payload === "number" && Number.isFinite(payload)) return payload;
    if (payload && typeof payload === "object" && typeof payload.value === "number") return payload.value;
    const n = Number(payload);
    if (Number.isFinite(n)) return n;
    throw new Error("msgf_rules numeric payload must be a JSON number or { value: number }");
  };

  const sourceTypes = asArray(byKey.source_types).map((x) => String(x));
  const authorOnly = new Set(asArray(byKey.author_only_source_types).map((x) => String(x)));
  const plotPointOrderDefault = byKey.plot_point_order_default;
  if (!plotPointOrderDefault || typeof plotPointOrderDefault !== "object" || Array.isArray(plotPointOrderDefault)) {
    throw new Error("msgf_rules rag/plot_point_order_default must be a JSON object");
  }

  return {
    RAG_SOURCE_TYPES: sourceTypes,
    AUTHOR_ONLY_SOURCE_TYPES: authorOnly,
    PLOT_POINT_ORDER_DEFAULT: plotPointOrderDefault,
    HUD_MIN_WORDS: asNumber(byKey.hud_min_words),
    HUD_MAX_WORDS: asNumber(byKey.hud_max_words),
    WARNING_MAX_WORDS: asNumber(byKey.warning_max_words),
    RAG_MASTER_LIMIT: asNumber(byKey.rag_master_limit),
  };
}

module.exports = { loadMsgfRagRules };
