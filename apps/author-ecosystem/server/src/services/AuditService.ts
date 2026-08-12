import { createRequire } from "node:module";

import Anthropic from "@anthropic-ai/sdk";

import { authorAnthropicClientInit } from "../lib/authorMsgfGovernance.js";

/**
 * Narrative logic / continuity pass: Gemini with a very large wiki/Bible window.
 * Critic (Claude) routes through MSGF Shadow Proxy / Active Governance when configured.
 */
const require = createRequire(import.meta.url);
const { generateBullets } = require("./geminiClient.js") as {
  generateBullets: (opts: { system: string; user: string; model?: string }) => Promise<string>;
};

const LOGIC_AUDIT_SYSTEM = [
  "You are a narrative continuity and trope-awareness auditor for an author's planning sandbox.",
  "You receive NARRATIVE MASTER CONTEXT (full wiki / Bible where provided), LORE CONTEXT, and a SCENE SNAPSHOT.",
  "Reply with EXACTLY ONE line (no bullets, no JSON):",
  '- Either start with "Warning:" and name a concrete risk (trope overuse, motivation mismatch, setting vs goal conflict, continuity gap vs wiki, etc.),',
  '- Or start with "Logic Pass:" and briefly state why this beat coheres with the wiki and character goals.',
  "Stay under 220 characters. Be specific; avoid generic praise.",
].join("\n");

/** Large-context window for Gemini (whole-Bible style planning ingest). */
const LOGIC_WIKI_MAX_CHARS = 500_000;
const LOGIC_OUTLINE_MAX_CHARS = 24_000;
const SENSITIVITY_WIKI_MAX_CHARS = 48_000;

const SENSITIVITY_SYSTEM = [
  "You are a literary sensitivity critic.",
  "Write 2–5 short paragraphs of clear prose (no JSON, no bullet labels).",
  "Be constructive: name risks, then suggest reframes or craft moves the author could try.",
].join("\n");

const SENSITIVITY_USER_DIRECTIVE =
  "Analyze this scene for unintentional tropes, biased archetypes, and emotional resonance. " +
  "Contrast the author's intent with common literary pitfalls.";

let _anthropic: Anthropic | null | undefined;

function getAnthropic(): Anthropic | null {
  if (_anthropic === undefined) {
    const key = process.env.ANTHROPIC_API_KEY?.trim();
    _anthropic = key
      ? new Anthropic(authorAnthropicClientInit({ apiKey: key, surface: "bicameral_audit" }))
      : null;
  }
  return _anthropic;
}

export type SceneAuditSnapshot = {
  scene_label: string;
  scene_beat_text: string;
  environment: string;
  cast: string;
  logic_hooks: string;
  wiki_state_text: string;
  manuscript_outline_snapshot: string;
  /** Optional full outline from DB when snapshot is empty */
  manuscript_outline_db?: string;
};

export type DualAuditResult = {
  librarianLogic: string;
  criticSensitivity: string;
};

function firstNonEmptyLine(raw: string, fallback: string): string {
  const line =
    String(raw ?? "")
      .trim()
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find(Boolean) ?? "";
  let out = line || fallback;
  if (out.length > 500) out = out.slice(0, 497) + "…";
  return out;
}

function buildLogicUserPrompt(s: SceneAuditSnapshot): string {
  const wiki = s.wiki_state_text ? s.wiki_state_text.slice(0, LOGIC_WIKI_MAX_CHARS) : "(no wiki context supplied)";
  const outlineSnap = s.manuscript_outline_snapshot
    ? s.manuscript_outline_snapshot.slice(0, LOGIC_OUTLINE_MAX_CHARS)
    : "";
  const outlineDb = (s.manuscript_outline_db ?? "").trim().slice(0, LOGIC_OUTLINE_MAX_CHARS);
  const outlineBlock =
    outlineSnap || outlineDb || "(none)";

  return [
    "## Established wiki / canon (Bible — may be very long)",
    wiki,
    "",
    "## Manuscript outline",
    outlineBlock,
    "",
    "## Scene snapshot",
    `Label: ${s.scene_label}`,
    `Outline beat: ${s.scene_beat_text.trim() || "(not specified)"}`,
    `Environment: ${s.environment || "(empty)"}`,
    `Cast: ${s.cast || "(empty)"}`,
    `Logic hooks: ${s.logic_hooks || "(empty)"}`,
    "",
    "Emit your single audit line now.",
  ].join("\n");
}

function buildSensitivityUserPrompt(s: SceneAuditSnapshot): string {
  const wikiTrim = s.wiki_state_text ? s.wiki_state_text.slice(0, SENSITIVITY_WIKI_MAX_CHARS) : "(no wiki context)";
  return [
    SENSITIVITY_USER_DIRECTIVE,
    "",
    "## Scene",
    `Label: ${s.scene_label}`,
    `Beat: ${s.scene_beat_text.trim() || "(not specified)"}`,
    `Environment: ${s.environment || "(empty)"}`,
    `Cast: ${s.cast || "(empty)"}`,
    `Logic hooks: ${s.logic_hooks || "(empty)"}`,
    "",
    "## Trimmed wiki / canon (for trope and archetype cross-check)",
    wikiTrim,
  ].join("\n");
}

/**
 * Fast logic pass over the full planning Bible + outline + scene (Gemini).
 */
export async function runLogicAudit(snapshot: SceneAuditSnapshot): Promise<string> {
  const user = buildLogicUserPrompt(snapshot);
  const raw = await generateBullets({ system: LOGIC_AUDIT_SYSTEM, user });
  return firstNonEmptyLine(raw, "Logic Pass: (model returned empty — treat as neutral).");
}

/**
 * Sensitivity / trope-depth critique (Claude via `@anthropic-ai/sdk`, same family as MSGF narrative AI).
 */
export async function runSensitivityCritique(snapshot: SceneAuditSnapshot): Promise<string> {
  const client = getAnthropic();
  if (!client) {
    throw new Error("Missing ANTHROPIC_API_KEY for sensitivity critique");
  }
  const model = process.env.ANTHROPIC_CRITIQUE_MODEL?.trim() || "claude-3-5-sonnet-20241022";
  const user = buildSensitivityUserPrompt(snapshot);

  const message = await client.messages.create({
    model,
    max_tokens: 2048,
    system: SENSITIVITY_SYSTEM,
    messages: [{ role: "user", content: user }],
  });

  const block = message.content[0];
  const text = block && block.type === "text" ? block.text.trim() : "";
  if (!text) throw new Error("Claude returned empty sensitivity critique");
  return text.length > 12_000 ? text.slice(0, 11_997) + "…" : text;
}

export async function runDualSceneAudit(snapshot: SceneAuditSnapshot): Promise<DualAuditResult> {
  const [logicR, sensR] = await Promise.allSettled([runLogicAudit(snapshot), runSensitivityCritique(snapshot)]);

  const librarianLogic =
    logicR.status === "fulfilled"
      ? logicR.value
      : `Warning: Logic audit failed (${logicR.reason instanceof Error ? logicR.reason.message : String(logicR.reason)}).`;

  let criticSensitivity: string;
  if (sensR.status === "fulfilled") {
    criticSensitivity = sensR.value;
  } else {
    const msg = sensR.reason instanceof Error ? sensR.reason.message : String(sensR.reason);
    criticSensitivity = `(Critic unavailable: ${msg})`;
  }

  return { librarianLogic, criticSensitivity };
}

export function formatCombinedNarrativeAudit(d: DualAuditResult): string {
  const logic = d.librarianLogic.trim();
  const crit = d.criticSensitivity.trim().replace(/\s+/g, " ");
  const critShort = crit.length > 320 ? crit.slice(0, 317) + "…" : crit;
  return `Librarian (Logic): ${logic} · Critic (Sensitivity): ${critShort}`;
}
