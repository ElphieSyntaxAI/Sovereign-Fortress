/**
 * Author BFF workflow unit tests + optional live smoke (BFF on :3002).
 *
 *   npm run test -w @elphie-syntax/author-ecosystem-server
 *   AUTHOR_BFF_SMOKE=1 npm run test -w @elphie-syntax/author-ecosystem-server
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { isPersonaValidForPlatform } from "msgf/lib/platform-persona-auth";

import {
  buildManuscriptOutlineFromBeats,
  extractOutlineBeatsFromText,
  normalizeProposedWikiEntry,
} from "../src/lib/documentIngestOutline.js";
import {
  buildClarifyingQuestions,
  detectContentSignals,
  detectInDocumentConflicts,
  resolveNextStatusAfterScan,
} from "../src/lib/documentIngestStructure.js";
import {
  requiresAuthorshipGate,
  slotDefaultMetadata,
  type DocumentIngestSlot,
} from "../src/lib/documentIngestGate.js";
import { isPlatformOperatorEmail, parseGlobalAdminEmails } from "../src/lib/isPlatformOperator.js";

const BFF_BASE = (process.env.AUTHOR_ECOSYSTEM_URL ?? "http://127.0.0.1:3002").replace(/\/$/, "");
const RUN_SMOKE =
  process.argv.includes("--smoke") ||
  process.env.AUTHOR_BFF_SMOKE === "1" ||
  process.env.AUTHOR_BFF_SMOKE === "true";

describe("platform personas (author)", () => {
  test("valid author personas", () => {
    for (const p of ["author", "editor", "helper", "publisher"]) {
      assert.equal(isPersonaValidForPlatform("author", p), true, p);
    }
    assert.equal(isPersonaValidForPlatform("author", "fan"), false);
  });
});

describe("document ingest gate", () => {
  test("authorship gate triggers over 3000 words or 3 pages", () => {
    assert.equal(requiresAuthorshipGate(3001, 1), true);
    assert.equal(requiresAuthorshipGate(100, 4), true);
    assert.equal(requiresAuthorshipGate(100, 2), false);
    assert.equal(requiresAuthorshipGate(3001, 1), true);
  });

  test("slot metadata includes manuscript_id", () => {
    const ms = "00000000-0000-4000-8000-000000000099";
    const meta = slotDefaultMetadata("world_bible" as DocumentIngestSlot, ms);
    assert.equal(meta.manuscript_id, ms);
    assert.equal(meta.ingest_slot, "world_bible");
  });
});

describe("document ingest outline → wiki building blocks", () => {
  test("extractOutlineBeatsFromText finds numbered scenes", () => {
    const text = `
Chapter 1
1. Opening in the rain
2. The vault seals
Scene 3: Confrontation at the guild
    `.trim();
    const beats = extractOutlineBeatsFromText(text);
    assert.ok(beats.length >= 2);
    assert.ok(beats.some((b) => /rain/i.test(b.synopsis)));
  });

  test("normalizeProposedWikiEntry maps character kind", () => {
    const normalized = normalizeProposedWikiEntry(
      {
        title: "Elena",
        excerpt: "Protagonist, cautious.",
        chunk_type: "character",
        tags: [],
        wiki_metadata: { outline_entity_kind: "character" },
      },
      "ms-1",
      "character_sheet"
    );
    assert.equal(normalized.chunk_type, "character");
    assert.equal(normalized.wiki_metadata?.outline_entity_kind, "character");
    assert.equal(normalized.wiki_metadata?.manuscript_id, "ms-1");
  });

  test("buildManuscriptOutlineFromBeats produces plot sandbox text", () => {
    const outline = buildManuscriptOutlineFromBeats([
      { synopsis: "Beat A", order: 0 },
      { synopsis: "Beat B", order: 1 },
    ]);
    assert.match(outline, /Beat A/);
    assert.match(outline, /Beat B/);
    assert.ok(outline.length >= 20);
  });
});

describe("context-aware ingest structure", () => {
  test("detectContentSignals finds scene cards", () => {
    const text = "SCENE CARD #1\nINT. Kitchen\n\nSCENE CARD #2\nEXT. Road";
    const signals = detectContentSignals(text);
    assert.ok(signals.some((s) => s.kind === "scene_cards"));
  });

  test("detectInDocumentConflicts flags two chapter ones", () => {
    const text =
      "Chapter 1\nAlice enters.\n\n---\n\nChapter 1\nBob enters a different city.";
    const conflicts = detectInDocumentConflicts(text, "current_draft");
    assert.ok(conflicts.some((c) => c.code === "multiple_chapter_one"));
  });

  test("resolveNextStatusAfterScan prioritizes clarification", () => {
    assert.equal(
      resolveNextStatusAfterScan({
        gate: true,
        authorshipQuestionCount: 5,
        clarifying: [
          {
            id: "q1",
            code: "scope",
            question: "One book?",
            required: true,
          },
        ],
      }),
      "clarification"
    );
  });

  test("buildClarifyingQuestions when outline cast differs", () => {
    const existing =
      "Chapter 1 — Elena and Marcus arrive at the harbor guild. The old outline follows their alliance across the salt marshes and the sealed vault below the lighthouse.";
    const qs = buildClarifyingQuestions(
      [],
      { protagonist_names: ["Zara", "Milo"], setting_anchors: [], tone_or_genre: null },
      existing
    );
    assert.ok(qs.some((q) => q.code === "contradicts_manuscript"));
  });
});

describe("platform operator", () => {
  test("parseGlobalAdminEmails splits env list", () => {
    const prev = process.env.MSGF_GLOBAL_ADMIN_EMAILS;
    process.env.MSGF_GLOBAL_ADMIN_EMAILS = " A@x.com , b@y.com ";
    assert.deepEqual(parseGlobalAdminEmails(), ["a@x.com", "b@y.com"]);
    if (prev === undefined) delete process.env.MSGF_GLOBAL_ADMIN_EMAILS;
    else process.env.MSGF_GLOBAL_ADMIN_EMAILS = prev;
  });

  test("isPlatformOperatorEmail matches allowlist", () => {
    const prev = process.env.MSGF_GLOBAL_ADMIN_EMAILS;
    process.env.MSGF_GLOBAL_ADMIN_EMAILS = "ops@test.com";
    assert.equal(isPlatformOperatorEmail("ops@test.com"), true);
    assert.equal(isPlatformOperatorEmail("other@test.com"), false);
    if (prev === undefined) delete process.env.MSGF_GLOBAL_ADMIN_EMAILS;
    else process.env.MSGF_GLOBAL_ADMIN_EMAILS = prev;
  });
});

const describeSmoke = RUN_SMOKE ? describe : describe.skip;

describeSmoke("BFF smoke (optional)", () => {
  test("GET /api/ping", async () => {
    const res = await fetch(`${BFF_BASE}/api/ping`);
    assert.equal(res.status, 200);
    const json = (await res.json()) as { pong?: boolean; service?: string };
    assert.equal(json.pong, true);
    assert.equal(json.service, "author-ecosystem");
  });

  test("GET /api/status includes msgf_mapping", async () => {
    const res = await fetch(`${BFF_BASE}/api/status`);
    assert.equal(res.status, 200);
    const json = (await res.json()) as { msgf_mapping?: { tenant_id?: string } };
    assert.ok(json.msgf_mapping?.tenant_id);
  });

  test("GET /api/platform-admin/access without session returns 401", async () => {
    const res = await fetch(`${BFF_BASE}/api/platform-admin/access`);
    assert.equal(res.status, 401);
  });

  test("GET /api/onboarding/status without session returns 401", async () => {
    const res = await fetch(`${BFF_BASE}/api/onboarding/status`);
    assert.ok(res.status === 401 || res.status === 403);
  });
});
