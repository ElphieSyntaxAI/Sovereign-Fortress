/**
 * Revision audits aligned with docs/AUTHOR_ROADMAP.md → AUTHOR_ECOSYSTEM_ROADMAP.md:
 * - **STATE_COOLDOWN** (product): triggers Librarian (Logic) JSON report vs RAG World Bible + Outline (`revision_reports`).
 * - **Critic (Sensitivity)** (prior path): Claude pass persisted to `p4_revision_reports` (`CRITIC_SUMMARY`).
 *
 * RAG contracts: `apps/author-ecosystem/docs/rag/` (source_type `world_bible`, `story_outline`).
 */

import { createRequire } from "node:module";

import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";

import { assertUuid } from "./halMetrics.js";
import { getSupabaseAdmin } from "./supabaseAdmin.js";

const require = createRequire(import.meta.url);

/** Roadmap §5: planning-sync cooldown editorial state. */
export const STATE_COOLDOWN_PLANNING = "COOLDOWN_LOCKED" as const;
/** SSOT cooldown gate row value (`p4_manuscripts.cooldown_revision_status`). */
export const STATE_COOLDOWN_VAULT_GATE = "LOCKED" as const;

// ---------------------------------------------------------------------------
// Critic (Sensitivity) — p4_revision_reports CRITIC_SUMMARY
// ---------------------------------------------------------------------------

const CRITIC_MANUSCRIPT_MAX_CHARS = 95_000;
const CRITIC_SUMMARY_MAX_CHARS = 5_500;

const CRITIC_SYSTEM = [
  "You are the Critic (Sensitivity lens) for a fiction revision report.",
  "You receive the author's **locked manuscript snapshot** (plain text) and **metadata**: title and stated primary genre.",
  "Write **clear prose only** (no JSON, no markdown tables). Use short section headings in plain text lines if helpful.",
  "",
  "Cover exactly these lenses:",
  "1) **Market appeal** — opening energy, clarity of promise to the reader, comp/category signals, pacing hooks,",
  "   and whether the material would plausibly satisfy buyers/readers in the stated genre.",
  "2) **Theme consistency** — recurring motifs, moral or thematic through-line, and drift vs any clear central question.",
  "3) **Tone vs stated genre** — compare diction, register, pacing, and trope choices against what readers typically expect",
  "   from the given genre label. Say where the voice aligns, where it clashes, and what to adjust.",
  "",
  "Be constructive and specific; avoid generic praise. Aim for about **one page** total length.",
].join("\n");

let _anthropic: Anthropic | null | undefined;

function getAnthropic(): Anthropic | null {
  if (_anthropic === undefined) {
    const key = process.env.ANTHROPIC_API_KEY?.trim();
    _anthropic = key ? new Anthropic({ apiKey: key }) : null;
  }
  return _anthropic;
}

export type CriticsRevisionPassResult = {
  text: string;
  persisted: boolean;
  skippedReason?: string;
};

function capCriticsSummary(raw: string): string {
  const t = String(raw ?? "").trim();
  if (!t) return "";
  if (t.length <= CRITIC_SUMMARY_MAX_CHARS) return t;
  return t.slice(0, CRITIC_SUMMARY_MAX_CHARS - 1) + "…";
}

/**
 * Calls Claude on `p4_manuscripts.body_text` with **Market appeal**, **Theme consistency**,
 * and tone vs `genre_primary`, then inserts `p4_revision_reports` row `CRITIC_SUMMARY`.
 */
export async function runCriticsRevisionPassAndPersist(
  supabase: SupabaseClient,
  manuscriptId: string
): Promise<CriticsRevisionPassResult> {
  const { data: ms, error: msErr } = await supabase
    .from("p4_manuscripts")
    .select("id, tenant_id, title, body_text, genre_primary, audit_score")
    .eq("id", manuscriptId)
    .maybeSingle();

  if (msErr) {
    return { text: "", persisted: false, skippedReason: `manuscript read: ${msErr.message}` };
  }
  if (!ms) {
    return { text: "", persisted: false, skippedReason: "manuscript not found" };
  }

  const tenantId = String((ms as Record<string, unknown>).tenant_id ?? "");
  const title = String((ms as Record<string, unknown>).title ?? "").trim() || "(untitled)";
  const genre = String((ms as Record<string, unknown>).genre_primary ?? "").trim() || "(not specified in metadata)";
  const body = String((ms as Record<string, unknown>).body_text ?? "").trim();
  const auditScoreRaw = Number((ms as Record<string, unknown>).audit_score ?? 0);
  const continuityForGate =
    Number.isFinite(auditScoreRaw) && auditScoreRaw > 0
      ? Math.min(1, Math.max(0, auditScoreRaw))
      : undefined;

  if (!body) {
    return { text: "", persisted: false, skippedReason: "empty body_text" };
  }

  const client = getAnthropic();
  if (!client) {
    const msg = "Critic (Sensitivity) skipped — set ANTHROPIC_API_KEY to enable Claude.";
    return { text: "", persisted: false, skippedReason: msg };
  }

  const excerpt = body.slice(0, CRITIC_MANUSCRIPT_MAX_CHARS);
  const truncated = body.length > CRITIC_MANUSCRIPT_MAX_CHARS;

  const user = [
    "## Manuscript metadata",
    `Title: ${title}`,
    `Stated primary genre (metadata): ${genre}`,
    truncated
      ? `Note: manuscript text is truncated to ${CRITIC_MANUSCRIPT_MAX_CHARS} characters for this pass.`
      : "Full manuscript snapshot follows.",
    "",
    "## Manuscript text",
    excerpt,
  ].join("\n");

  const model = process.env.ANTHROPIC_CRITIQUE_MODEL?.trim() || "claude-3-5-sonnet-20241022";

  let raw: string;
  try {
    const message = await client.messages.create({
      model,
      max_tokens: 4096,
      system: CRITIC_SYSTEM,
      messages: [{ role: "user", content: user }],
    });
    const block = message.content[0];
    raw = block && block.type === "text" ? block.text.trim() : "";
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { text: "", persisted: false, skippedReason: `Critic model error: ${msg}` };
  }

  const text = capCriticsSummary(raw);
  if (!text) {
    return { text: "", persisted: false, skippedReason: "Critic model returned empty text" };
  }

  const { error: insErr } = await supabase.from("p4_revision_reports").insert({
    tenant_id: tenantId,
    manuscript_id: manuscriptId,
    finding_type: "CRITIC_SUMMARY",
    severity: "info",
    details: {
      summary: text.slice(0, 4000),
      critic_summary: text,
      genre_primary: genre,
      lens: ["market_appeal", "theme_consistency", "tone_vs_genre"],
    },
    report_json:
      continuityForGate !== undefined ? { continuity_score: continuityForGate } : {},
    chunk_ids: [],
    cosine_similarity: null,
  });

  if (insErr) {
    console.error("[RevisionAuditService] CRITIC_SUMMARY insert failed", insErr.message);
    return { text, persisted: false, skippedReason: `persist failed: ${insErr.message}` };
  }

  return { text, persisted: true };
}

// ---------------------------------------------------------------------------
// Librarian (Logic) — revision_reports + legacy RAG (world_bible / story_outline)
// ---------------------------------------------------------------------------

export type ContinuityErrorEntry = {
  type: string;
  description: string;
  manuscript_evidence?: string;
  canon_evidence?: string;
  severity: "low" | "medium" | "high";
};

export type OutlineAdherenceEntry = {
  outline_beat: string;
  manuscript_status: "aligned" | "partial" | "missing" | "contradicted";
  notes?: string;
};

export type LibrarianLogicReportJson = {
  continuity_errors: ContinuityErrorEntry[];
  outline_adherence: OutlineAdherenceEntry[];
  summary: string;
  /** Author-facing line, e.g. `Audit Rigor: Forensic (8-week wait utilized).` */
  audit_rigor?: string;
  /** [0,1] from latest `p4_revision_reports` AUDIT_SUMMARY.details.auditScore when the Librarian row is written. */
  logic_score?: number;
  retrieval?: {
    world_bible_chunks: number;
    outline_chunks: number;
    narrative_library_fallback: boolean;
    /** Total unique legacy RAG rows budgeted for this pass (world_bible + story_outline). */
    rag_chunk_budget?: number;
    audit_rigor_tier?: "surface_scan" | "deep_dive" | "forensic";
  };
  error?: string;
  parse_error?: boolean;
};

export type CooldownRevisionAuditScheduleInput = {
  supabase: SupabaseClient;
  manuscriptId: string;
  tenantId: string;
  /** Prefer `p4_manuscripts.owner_id`; else tenant id when it matches `msgf_legacy_users`. */
  userIdForLegacyRag: string;
  /** Session key: `revision_cooldown_until`, vault `locked_until`, or tier `lock_expires_at` (ISO). */
  lockedUntilSession: string;
};

const LIBRARIAN_MS_EXCERPT = 14_000;

type LibrarianAuditRigorTier = "surface_scan" | "deep_dive" | "forensic";

type LibrarianAuditRigorPlan = {
  tier: LibrarianAuditRigorTier;
  /** Product label for authors (matches roadmap tiers). */
  modeLabel: string;
  maxRagChunks: number;
  loreFallbackLimit: number;
  plotFallbackLimit: number;
  contextCharCap: number;
  /** Extra system instructions for Gemini: how strict / wide to read. */
  promptRigorSection: string;
};

/** Parse `p4_manuscripts.cooldown_duration` (Postgres `interval`) into approximate days. */
function parseCooldownIntervalToDays(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return raw;
  if (typeof raw === "object" && raw !== null) {
    const r = raw as { days?: unknown; months?: unknown; years?: unknown };
    let d = 0;
    if (typeof r.days === "number" && Number.isFinite(r.days)) d += r.days;
    if (typeof r.months === "number" && Number.isFinite(r.months)) d += r.months * 30;
    if (typeof r.years === "number" && Number.isFinite(r.years)) d += r.years * 365;
    if (d > 0) return d;
  }
  const s = String(raw).trim();
  if (!s) return null;
  if (/^P/i.test(s)) {
    const compact = s.replace(/\s/g, "");
    let d = 0;
    const w = /(\d+)W/i.exec(compact);
    if (w) d += Number(w[1]) * 7;
    const day = /(\d+)D/i.exec(compact);
    if (day) d += Number(day[1]);
    if (d > 0) return d;
  }
  let days = 0;
  let m: RegExpExecArray | null;
  const reDays = /(\d+)\s*days?\b/gi;
  while ((m = reDays.exec(s)) !== null) days += Number(m[1]);
  const reWeeks = /(\d+)\s*weeks?\b/gi;
  while ((m = reWeeks.exec(s)) !== null) days += Number(m[1]) * 7;
  const reMonths = /(\d+)\s*(?:mon|months?)\b/gi;
  while ((m = reMonths.exec(s)) !== null) days += Number(m[1]) * 30;
  if (days > 0) return days;
  const spaceFirst = /^(\d+)\s+\d{1,2}:\d{2}:\d{2}/.exec(s);
  if (spaceFirst) {
    const n = Number(spaceFirst[1]);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

/**
 * Maps wall-clock `cooldown_duration` to retrieval depth + audit tone.
 * Buckets: ≥8 weeks → Forensic (100+ chunks), ≥6 weeks → Deep Dive (40), ≥4 weeks → Surface (15); shorter/unknown → Surface.
 */
function auditRigorPlanFromCooldownDuration(cooldownDuration: unknown): LibrarianAuditRigorPlan {
  const days = parseCooldownIntervalToDays(cooldownDuration);
  const weeks = days != null && days > 0 ? days / 7 : 0;

  if (weeks >= 8) {
    return {
      tier: "forensic",
      modeLabel: "Forensic",
      maxRagChunks: 120,
      loreFallbackLimit: 55,
      plotFallbackLimit: 70,
      contextCharCap: 36_000,
      promptRigorSection: [
        "## Audit Rigor: FORENSIC (8+ week cooldown)",
        "You are in **Forensic** mode: be maximally thorough and appropriately nitpicky.",
        "Prioritize **theme**, **tone**, voice consistency, symbolic/motif recurrence, and **deep-state logic loops** (long-arc causes, delayed payoffs, implied world rules).",
        "Trace **subplots** and secondary cast across the evidence; flag subtle contradictions and thematic drift, not only explicit lore clashes.",
        "Surface even low-confidence tensions when evidence suggests a pattern; label uncertainty in descriptions.",
      ].join("\n"),
    };
  }
  if (weeks >= 6) {
    return {
      tier: "deep_dive",
      modeLabel: "Deep Dive",
      maxRagChunks: 40,
      loreFallbackLimit: 28,
      plotFallbackLimit: 36,
      contextCharCap: 24_000,
      promptRigorSection: [
        "## Audit Rigor: DEEP DIVE (6+ week cooldown)",
        "You are in **Deep Dive** mode: be thorough and moderately nitpicky.",
        "Prioritize **character arcs**, relationship evolution, and **subplot tracking** against outline + bible.",
        "Connect beats across chapters where evidence allows; call out arc contradictions and dropped threads.",
      ].join("\n"),
    };
  }
  if (weeks >= 4) {
    return {
      tier: "surface_scan",
      modeLabel: "Surface Scan",
      maxRagChunks: 15,
      loreFallbackLimit: 12,
      plotFallbackLimit: 12,
      contextCharCap: 16_000,
      promptRigorSection: [
        "## Audit Rigor: SURFACE SCAN (4+ week cooldown)",
        "You are in **Surface Scan** mode: stay efficient — lightly nitpicky, not exhaustive.",
        "Focus on **immediate continuity**: names, places, dates, geography, timeline, and obvious outline mismatches.",
        "Do not chase deep thematic or voice-level issues unless they are clearly evidenced.",
      ].join("\n"),
    };
  }
  return {
    tier: "surface_scan",
    modeLabel: "Surface Scan",
    maxRagChunks: 15,
    loreFallbackLimit: 12,
    plotFallbackLimit: 12,
    contextCharCap: 16_000,
    promptRigorSection: [
      "## Audit Rigor: SURFACE SCAN (default — short or unset cooldown)",
      "Treat this as **Surface Scan**: prioritize **immediate continuity** (names, places, dates, obvious outline mismatches).",
      "Stay efficient; do not over-interpret thin evidence.",
    ].join("\n"),
  };
}

function buildAuditRigorAuthorLine(plan: LibrarianAuditRigorPlan, approxDays: number | null): string {
  if (approxDays != null && approxDays > 0) {
    const w = Math.max(1, Math.round(approxDays / 7));
    return `Audit Rigor: ${plan.modeLabel} (${w}-week wait utilized).`;
  }
  return `Audit Rigor: ${plan.modeLabel} (cooldown duration unset — default surface rigor).`;
}

function buildLibrarianSystem(plan: LibrarianAuditRigorPlan): string {
  return [
    "You are the Revision Librarian (Logic). Compare the MANUSCRIPT against WORLD BIBLE and STORY OUTLINE evidence.",
    plan.promptRigorSection,
    "",
    "Return **only** valid JSON (no markdown fences, no commentary). Schema:",
    '{ "continuity_errors": [ { "type": string, "description": string, "manuscript_evidence"?: string, "canon_evidence"?: string, "severity": "low"|"medium"|"high" } ],',
    '  "outline_adherence": [ { "outline_beat": string, "manuscript_status": "aligned"|"partial"|"missing"|"contradicted", "notes"?: string } ],',
    '  "summary": string }',
    "",
    "continuity_errors: concrete contradictions vs bible/outline (e.g. character eye color, dates, names, geography, timeline breaks).",
    "outline_adherence: each major beat from the outline evidence vs what the manuscript appears to do.",
    "If evidence is thin, return fewer items and say so in summary — do not invent quotes.",
  ].join("\n");
}

function toSqlVectorLiteral(vec: number[]): string {
  return `[${vec.map((n) => (Number.isFinite(n) ? n : 0)).join(",")}]`;
}

function loadGeminiClient(): {
  embedTexts: (texts: string[], opts: Record<string, unknown>) => Promise<number[][]>;
  generateBullets: (opts: { system: string; user: string; model?: string }) => Promise<string>;
} {
  return require("../services/geminiClient.js") as {
    embedTexts: (texts: string[], opts: Record<string, unknown>) => Promise<number[][]>;
    generateBullets: (opts: { system: string; user: string; model?: string }) => Promise<string>;
  };
}

function tryLoadDb(): { query: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> } | null {
  try {
    return require("./databaseUrlPool.cjs") as {
      query: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
    };
  } catch {
    return null;
  }
}

async function fetchLatestP4AuditSummaryScore01(
  supabase: SupabaseClient,
  manuscriptId: string
): Promise<number | null> {
  const { data, error } = await supabase
    .from("p4_revision_reports")
    .select("details")
    .eq("manuscript_id", manuscriptId)
    .eq("finding_type", "AUDIT_SUMMARY")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const det = (data as { details?: unknown }).details;
  if (!det || typeof det !== "object") return null;
  const a = (det as Record<string, unknown>)["auditScore"];
  if (typeof a !== "number" || !Number.isFinite(a)) return null;
  return Math.min(1, Math.max(0, a));
}

async function attachP4LogicScore(
  supabase: SupabaseClient,
  manuscriptId: string,
  report: LibrarianLogicReportJson
): Promise<LibrarianLogicReportJson> {
  let s = await fetchLatestP4AuditSummaryScore01(supabase, manuscriptId);
  if (s == null) {
    const { data: ms } = await supabase
      .from("p4_manuscripts")
      .select("audit_score")
      .eq("id", manuscriptId)
      .maybeSingle();
    const a = ms ? Number((ms as Record<string, unknown>)["audit_score"] ?? 0) : 0;
    if (Number.isFinite(a) && a > 0) s = Math.min(1, Math.max(0, a));
  }
  if (s == null) return report;
  return { ...report, logic_score: s };
}

function sliceWindows(text: string, maxTotal: number): string[] {
  const t = text.trim();
  if (!t) return [];
  const n = Math.min(3, Math.max(1, Math.ceil(t.length / 8000)));
  const window = Math.min(8000, Math.ceil(t.length / n));
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const start = Math.floor((i * t.length) / n);
    out.push(t.slice(start, start + window));
  }
  const joined = out.join("\n...\n");
  return [joined.length > maxTotal ? joined.slice(0, maxTotal) : joined];
}

async function retrieveLegacyRagContext(
  db: { query: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> },
  authorUserId: string,
  manuscriptId: string,
  manuscriptWindows: string[],
  maxChunks: number
): Promise<{ bible: string; outline: string; counts: { world_bible_chunks: number; outline_chunks: number } }> {
  const { embedTexts } = loadGeminiClient();
  const bibleChunks: string[] = [];
  const outlineChunks: string[] = [];
  const seen = new Set<string>();

  for (const window of manuscriptWindows) {
    if (seen.size >= maxChunks) break;
    if (!window.trim()) continue;
    const [qVec] = await embedTexts([window], {});
    if (!qVec?.length) continue;
    const literal = toSqlVectorLiteral(qVec);
    const sql = `
      SELECT c.chunk_id, c.content, s.source_type,
             1 - (c.embedding <=> $3::vector) AS cosine_similarity
        FROM msgf_legacy_rag_chunks c
        JOIN msgf_legacy_rag_sources s ON s.source_id = c.source_id
       WHERE c.author_user_id = $1::uuid
         AND c.project_id = $2::uuid
         AND c.audience = 'author'
         AND s.source_type IN ('world_bible', 'story_outline')
       ORDER BY c.embedding <=> $3::vector
       LIMIT $4
    `;
    const remaining = maxChunks - seen.size;
    const sqlLimit = Math.min(250, Math.max(1, remaining + 12));
    const { rows } = await db.query(sql, [authorUserId, manuscriptId, literal, sqlLimit]);
    for (const r of rows ?? []) {
      if (seen.size >= maxChunks) break;
      const id = String(r.chunk_id ?? "");
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const st = String(r.source_type ?? "");
      const line = `[${st} sim=${Number(r.cosine_similarity ?? 0).toFixed(3)}]\n${String(r.content ?? "").slice(0, 1200)}`;
      if (st === "world_bible") bibleChunks.push(line);
      else outlineChunks.push(line);
    }
  }

  return {
    bible: bibleChunks.join("\n\n"),
    outline: outlineChunks.join("\n\n"),
    counts: { world_bible_chunks: bibleChunks.length, outline_chunks: outlineChunks.length },
  };
}

function isOutlineMeta(meta: Record<string, unknown>, manuscriptId: string): boolean {
  if (meta["outline"] === true || meta["is_outline"] === true) return true;
  if (String(meta["manuscript_id"] ?? "") === manuscriptId) return true;
  return false;
}

async function fetchNarrativeLibraryFallback(
  supabase: SupabaseClient,
  tenantId: string,
  manuscriptId: string,
  opts?: { loreLimit: number; plotLimit: number }
): Promise<{ bible: string; outline: string }> {
  const loreLimit = opts?.loreLimit ?? 24;
  const plotLimit = opts?.plotLimit ?? 40;

  const { data: lore, error: e1 } = await supabase
    .from("p4_narrative_library_chunks")
    .select("content, source_document, chunk_index")
    .eq("tenant_id", tenantId)
    .eq("chunk_type", "lore")
    .order("chunk_index", { ascending: true })
    .limit(loreLimit);

  if (e1) console.error("[RevisionAuditService] lore fallback", e1.message);

  const { data: plot, error: e2 } = await supabase
    .from("p4_narrative_library_chunks")
    .select("content, source_document, chunk_index, metadata")
    .eq("tenant_id", tenantId)
    .eq("chunk_type", "plot")
    .order("chunk_index", { ascending: true })
    .limit(plotLimit);

  if (e2) console.error("[RevisionAuditService] plot fallback", e2.message);

  const bible = (lore ?? [])
    .map((r) => String((r as Record<string, unknown>).content ?? "").slice(0, 900))
    .filter(Boolean)
    .join("\n---\n");

  const outlineRows =
    (plot ?? []).filter((r) => {
      const rawMeta = (r as Record<string, unknown>).metadata;
      const meta = rawMeta && typeof rawMeta === "object" ? (rawMeta as Record<string, unknown>) : {};
      return isOutlineMeta(meta, manuscriptId);
    }) ?? [];

  const outline = outlineRows
    .map((r) => String((r as Record<string, unknown>).content ?? "").slice(0, 900))
    .filter(Boolean)
    .join("\n---\n");

  return { bible, outline };
}

function parseLibrarianJson(raw: string): LibrarianLogicReportJson {
  const t = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```/im.exec(t);
  const payload = (fence ? fence[1] : t).trim();
  try {
    const o = JSON.parse(payload) as Record<string, unknown>;
    const continuity = Array.isArray(o.continuity_errors) ? o.continuity_errors : [];
    const outline = Array.isArray(o.outline_adherence) ? o.outline_adherence : [];
    const summary = typeof o.summary === "string" ? o.summary : "";
    return {
      continuity_errors: continuity.map((x) => x as ContinuityErrorEntry),
      outline_adherence: outline.map((x) => x as OutlineAdherenceEntry),
      summary: summary || "(empty summary from model)",
    };
  } catch {
    return {
      continuity_errors: [],
      outline_adherence: [],
      summary: t.slice(0, 3000),
      parse_error: true,
    };
  }
}

/**
 * Runs Librarian (Logic): RAG retrieval over uploaded World Bible + Outline (`msgf_legacy_rag_*`),
 * falls back to `p4_narrative_library_chunks` lore/plot when legacy RAG is empty or DB pool is unavailable.
 * Retrieval depth and Gemini **Audit Rigor** follow `p4_manuscripts.cooldown_duration` (4w / 6w / 8w buckets).
 * Persists one row per `(manuscript_id, locked_until_session, librarian_logic)`.
 */
export async function runLibrarianLogicRevisionAuditForSession(
  input: CooldownRevisionAuditScheduleInput
): Promise<void> {
  const { supabase, manuscriptId, tenantId, userIdForLegacyRag, lockedUntilSession } = input;
  if (!lockedUntilSession) return;
  const sessionIso = new Date(lockedUntilSession).toISOString();
  if (!Number.isFinite(Date.parse(sessionIso))) return;

  const { data: dup, error: dupErr } = await supabase
    .from("revision_reports")
    .select("id")
    .eq("manuscript_id", manuscriptId)
    .eq("locked_until_session", sessionIso)
    .eq("report_kind", "librarian_logic")
    .maybeSingle();

  if (dupErr) {
    console.error("[RevisionAuditService] revision_reports dup check", dupErr.message);
    return;
  }
  if (dup) return;

  const { data: ms, error: msErr } = await supabase
    .from("p4_manuscripts")
    .select(
      "id, tenant_id, owner_id, title, body_text, outline, revision_status, cooldown_revision_status, locked_until, cooldown_duration"
    )
    .eq("id", manuscriptId)
    .maybeSingle();

  if (msErr || !ms) {
    console.error("[RevisionAuditService] manuscript read for librarian audit", msErr?.message);
    return;
  }

  const row = ms as Record<string, unknown>;
  const body = String(row.body_text ?? "").trim();
  const title = String(row.title ?? "").trim() || "(untitled)";
  const outlineField = String(row.outline ?? "").trim();
  const cooldownDur = row.cooldown_duration;
  const approxDays = parseCooldownIntervalToDays(cooldownDur);
  const plan = auditRigorPlanFromCooldownDuration(cooldownDur);
  const auditRigorAuthorLine = buildAuditRigorAuthorLine(plan, approxDays);

  let report: LibrarianLogicReportJson = {
    continuity_errors: [],
    outline_adherence: [],
    summary: "",
    audit_rigor: auditRigorAuthorLine,
    retrieval: {
      world_bible_chunks: 0,
      outline_chunks: 0,
      narrative_library_fallback: false,
      rag_chunk_budget: plan.maxRagChunks,
      audit_rigor_tier: plan.tier,
    },
  };

  if (!body) {
    report = {
      ...report,
      summary: "No manuscript body_text; skipping logic comparison.",
      error: "empty_body_text",
    };
    const reportForInsert = await attachP4LogicScore(supabase, manuscriptId, report);
    const { error: insE } = await supabase.from("revision_reports").insert({
      tenant_id: tenantId,
      manuscript_id: manuscriptId,
      locked_until_session: sessionIso,
      author_user_id: userIdForLegacyRag,
      report_kind: "librarian_logic",
      report_json: reportForInsert,
      model_used: null,
    });
    if (insE) console.error("[RevisionAuditService] revision_reports insert", insE.message);
    return;
  }

  const windows = sliceWindows(body, LIBRARIAN_MS_EXCERPT);
  const db = tryLoadDb();
  let bibleCtx = "";
  let outlineCtx = "";
  let usedFallback = false;

  let legacyAuthorId: string | null = userIdForLegacyRag;
  try {
    assertUuid(legacyAuthorId, "userIdForLegacyRag");
  } catch {
    legacyAuthorId = null;
  }

  try {
    if (db && legacyAuthorId) {
      const rag = await retrieveLegacyRagContext(db, legacyAuthorId, manuscriptId, windows, plan.maxRagChunks);
      bibleCtx = rag.bible;
      outlineCtx = rag.outline;
      report.retrieval = {
        world_bible_chunks: rag.counts.world_bible_chunks,
        outline_chunks: rag.counts.outline_chunks,
        narrative_library_fallback: false,
        rag_chunk_budget: plan.maxRagChunks,
        audit_rigor_tier: plan.tier,
      };
    }
    if (!bibleCtx.trim() && !outlineCtx.trim()) {
      const fb = await fetchNarrativeLibraryFallback(supabase, tenantId, manuscriptId, {
        loreLimit: plan.loreFallbackLimit,
        plotLimit: plan.plotFallbackLimit,
      });
      bibleCtx = fb.bible;
      outlineCtx = fb.outline + (outlineField ? `\n\n## outline column\n${outlineField.slice(0, 4000)}` : "");
      usedFallback = true;
      report.retrieval = {
        world_bible_chunks: 0,
        outline_chunks: 0,
        narrative_library_fallback: true,
        rag_chunk_budget: plan.maxRagChunks,
        audit_rigor_tier: plan.tier,
      };
    } else if (outlineField) {
      outlineCtx += `\n\n## outline column\n${outlineField.slice(0, 4000)}`;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[RevisionAuditService] retrieval", msg);
    report.error = `retrieval_failed: ${msg}`;
    const fb = await fetchNarrativeLibraryFallback(supabase, tenantId, manuscriptId, {
      loreLimit: plan.loreFallbackLimit,
      plotLimit: plan.plotFallbackLimit,
    });
    bibleCtx = fb.bible;
    outlineCtx = fb.outline + (outlineField ? `\n\n## outline column\n${outlineField.slice(0, 4000)}` : "");
    usedFallback = true;
    report.retrieval = {
      world_bible_chunks: 0,
      outline_chunks: 0,
      narrative_library_fallback: true,
      rag_chunk_budget: plan.maxRagChunks,
      audit_rigor_tier: plan.tier,
    };
  }

  const cap = plan.contextCharCap;
  const bibleBlock = bibleCtx.slice(0, cap);
  const outlineBlock = outlineCtx.slice(0, cap);
  const msBlock = windows.join("\n...\n").slice(0, LIBRARIAN_MS_EXCERPT);

  let modelUsed: string | null = null;
  try {
    const { generateBullets } = loadGeminiClient();
    modelUsed = process.env.GEMINI_CHAT_MODEL?.trim() || "gemini-2.0-flash";
    const user = [
      `## Manuscript title: ${title}`,
      `## Cooldown context`,
      auditRigorAuthorLine,
      `Legacy RAG chunk budget for this pass: up to ${plan.maxRagChunks} unique chunks (world bible + outline sources).`,
      "",
      `## Manuscript excerpt\n${msBlock}`,
      "",
      "## World Bible (RAG / library evidence — trim if empty means thin canon)",
      bibleBlock || "(none)",
      "",
      "## Outline (RAG / library evidence)",
      outlineBlock || "(none)",
    ].join("\n");

    const raw = await generateBullets({ system: buildLibrarianSystem(plan), user });
    const parsed = parseLibrarianJson(raw);
    const priorRetrieval = report.retrieval ?? {
      world_bible_chunks: 0,
      outline_chunks: 0,
      narrative_library_fallback: false,
    };
    report = {
      ...parsed,
      audit_rigor: auditRigorAuthorLine,
      retrieval: {
        ...priorRetrieval,
        narrative_library_fallback: usedFallback,
        rag_chunk_budget: plan.maxRagChunks,
        audit_rigor_tier: plan.tier,
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    report = {
      continuity_errors: [],
      outline_adherence: [],
      summary: `Librarian logic audit failed: ${msg}`,
      error: msg,
      audit_rigor: auditRigorAuthorLine,
      retrieval: report.retrieval,
    };
  }

  const reportForInsert = await attachP4LogicScore(supabase, manuscriptId, report);
  const { error: insErr } = await supabase.from("revision_reports").insert({
    tenant_id: tenantId,
    manuscript_id: manuscriptId,
    locked_until_session: sessionIso,
    author_user_id: userIdForLegacyRag,
    report_kind: "librarian_logic",
    report_json: reportForInsert,
    model_used: modelUsed,
  });

  if (insErr) console.error("[RevisionAuditService] revision_reports insert", insErr.message);
}

/**
 * Fire-and-forget when a manuscript enters **STATE_COOLDOWN** (planning `COOLDOWN_LOCKED`, vault gate, or tier lock).
 * Uses service Supabase; safe to call from HTTP handlers after the row is committed.
 */
export function scheduleLibrarianLogicRevisionAuditOnCooldown(input: CooldownRevisionAuditScheduleInput): void {
  void runLibrarianLogicRevisionAuditForSession(input).catch((e) =>
    console.error("[RevisionAuditService] runLibrarianLogicRevisionAuditForSession", e)
  );
}

/**
 * Resolve `userIdForLegacyRag` from `p4_manuscripts` and schedule Librarian logic audit (admin client).
 */
export async function scheduleLibrarianRevisionAuditFromManuscriptId(manuscriptId: string, lockedUntilSession: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { data: ms, error } = await supabase
    .from("p4_manuscripts")
    .select("tenant_id, owner_id")
    .eq("id", manuscriptId)
    .maybeSingle();
  if (error || !ms) {
    console.error("[RevisionAuditService] schedule from manuscript", error?.message);
    return;
  }
  const r = ms as Record<string, unknown>;
  const tenantId = String(r.tenant_id ?? "");
  const owner = r.owner_id != null ? String(r.owner_id) : "";
  const userIdForLegacyRag = owner || tenantId;
  scheduleLibrarianLogicRevisionAuditOnCooldown({
    supabase,
    manuscriptId,
    tenantId,
    userIdForLegacyRag,
    lockedUntilSession,
  });
}
