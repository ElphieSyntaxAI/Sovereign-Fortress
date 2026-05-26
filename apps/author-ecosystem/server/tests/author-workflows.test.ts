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
  extractBeatsFromTables,
  extractOutlineBeatsFromText,
  heuristicWikiFromTables,
  normalizeProposedWikiEntry,
} from "../src/lib/documentIngestOutline.js";
import { structureDocumentText } from "../src/lib/documentTextStructure.js";
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
import {
  buildCommitPreviewText,
  detectStructureMergeRisk,
} from "../src/lib/documentIngestMsgfGuard.js";
import {
  loadDocumentIngestKeywords,
  matchKeywordHintsInText,
} from "../src/lib/documentIngestKeywords.js";
import { buildDocumentIngestSignals } from "../src/lib/documentIngestSignals.js";
import { groundProposedWikiToSource } from "../src/lib/documentIngestMsgfPipeline.js";
import { buildAuthorDocumentSweepFiles } from "../src/lib/documentIngestMsgfSweep.js";
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

describe("document text structure (tables & tabs)", () => {
  test("structureDocumentText preserves tab columns as markdown table", () => {
    const raw = "Name\tRole\tArc\nElena\tLead\tRedemption\nMarcus\tMentor\tSacrifice";
    const structured = structureDocumentText(raw);
    assert.match(structured, /\| Name \| Role \| Arc \|/);
    assert.match(structured, /\| Elena \| Lead \| Redemption \|/);
    assert.ok(!structured.includes("Name Role Arc Elena"));
  });

  test("extractBeatsFromTables yields one beat per data row", () => {
    const structured = structureDocumentText("Scene\tBeat\n1\tOpening\n2\tTwist");
    const beats = extractBeatsFromTables(structured);
    assert.equal(beats.length, 2);
    assert.match(beats[0]!.synopsis, /Opening/i);
    assert.match(beats[1]!.synopsis, /Twist/i);
  });

  test("heuristicWikiFromTables maps rows to character wiki entries", () => {
    const structured = structureDocumentText("Name\tNotes\nElena\tCautious lead\nBob\tAntagonist");
    const wiki = heuristicWikiFromTables(structured, "character_sheet", "ms-1");
    assert.ok(wiki.length >= 2);
    assert.ok(wiki.some((w) => /Elena/i.test(w.title)));
  });
});

describe("document planning taxonomy", () => {
  test("classifies beginning outline vs chapter breakdown", async () => {
    const { classifyPlanningLayer, splitTabSections } = await import(
      "../src/lib/documentPlanningTaxonomy.js"
    );
    assert.equal(classifyPlanningLayer("Beginning Outline"), "macro_outline");
    assert.equal(classifyPlanningLayer("Chapter 3 Breakdown"), "chapter_breakdown");
    assert.equal(classifyPlanningLayer("Scene List"), "scene_grid");
    assert.equal(classifyPlanningLayer("Prologue"), "front_matter");
    assert.equal(classifyPlanningLayer("Epigraph"), "front_matter");
    assert.equal(classifyPlanningLayer("Book Synopsis"), "book_synopsis");
    assert.equal(classifyPlanningLayer("Spin off and sequel book Ideas"), "notes");
    assert.equal(classifyPlanningLayer("Chapter 30"), "chapter_breakdown");
    assert.equal(classifyPlanningLayer("Chapter 30 Spin off ideas"), "notes");

    const text =
      "--- TAB: Beginning Outline ---\n\nAct I setup\n\n--- TAB: Scene Grid ---\n\nScene 1: Open\nScene 2: Twist";
    const sections = splitTabSections(text);
    assert.equal(sections.length, 2);
    assert.equal(sections[0]!.layer, "macro_outline");
    assert.equal(sections[1]!.layer, "scene_grid");
  });
});

describe("document ingest MSGF guard", () => {
  test("detectStructureMergeRisk flags tabular doc with few wiki entries", () => {
    const structured = structureDocumentText(
      "Name\tRole\tArc\nElena\tLead\tRedemption\nMarcus\tMentor\tSacrifice\nBob\tAntagonist\tFall"
    );
    const risk = detectStructureMergeRisk(
      structured,
      [{ title: "Merged blob", excerpt: "x".repeat(50), chunk_type: "other", tags: [], wiki_metadata: {} }],
      [{ synopsis: "one beat only", order: 0 }]
    );
    assert.equal(risk.risk, true);
    assert.ok(risk.table_row_estimate >= 3);
  });

  test("buildCommitPreviewText includes wiki and beat summaries", () => {
    const preview = buildCommitPreviewText({
      slot: "character_sheet",
      filename: "cast.gdoc",
      sourceText: "Name\tNotes\nElena\tLead",
      proposed: [
        {
          title: "Elena",
          excerpt: "Cautious protagonist with a hidden past in the vault.",
          chunk_type: "character",
          tags: [],
          wiki_metadata: {},
        },
      ],
      outlineBeats: [{ synopsis: "Elena intro", order: 0 }],
    });
    assert.match(preview, /PROPOSED_WIKI/);
    assert.match(preview, /Elena/);
  });
});

describe("document ingest outline → wiki building blocks", () => {
  test("dedupes chapter beats from per-chapter tabs vs aggregate dump", () => {
    const text = [
      "--- TAB: Chapter 1 ---",
      "Chapter 1",
      "Acina Pov",
      "Opening beat in compound.",
      "",
      "--- TAB: Chapter 2 ---",
      "Chapter 2",
      "Acina Pov",
      "Second chapter beat.",
      "",
      "--- TAB: Document ---",
      "Chapter 1",
      "Acina Pov",
      "Opening beat in compound.",
      "Chapter 2",
      "Acina Pov",
      "Second chapter beat.",
    ].join("\n");
    const beats = extractOutlineBeatsFromText(text);
    assert.equal(beats.length, 2);
    assert.match(beats[0]!.title ?? "", /Chapter 1/i);
    assert.match(beats[1]!.title ?? "", /Chapter 2/i);
  });

  test("extracts book synopsis and spin-off ideas from master outline", () => {
    const text = [
      "--- TAB: The Quantum Heart Outline ---",
      "Beginning",
      "Acina on Earth",
      "Middle The Luna Trials Begin",
      "First Trial",
      "End",
      "Mating ceremonies",
      "Book Synopsis",
      "What happens when the world ends and wolves rise.",
      "Hints at sequal (told in Summers POV)",
      "Cliffhanger for Gods Games.",
      "Spin off and sequel book Ideas",
      "Sequel - Acina and Kamal conceive after Gods Games.",
      "Spin off - Perssine demon realm arc.",
    ].join("\n");
    const beats = extractOutlineBeatsFromText(text);
    assert.ok(beats.some((b) => b.title === "Book Synopsis" && /world ends/i.test(b.synopsis)));
    assert.ok(beats.some((b) => /Sequel/i.test(b.title ?? "") && /Gods Games/i.test(b.synopsis)));
    assert.ok(beats.some((b) => /Spin-off/i.test(b.title ?? "") && /Perssine/i.test(b.synopsis)));
  });

  test("detects split POV vs single POV chapters", async () => {
    const { resolvePovInfo, parseAllPovs, extractPovFromTableCell } = await import(
      "../src/lib/documentIngestOutline.js"
    );
    const split = resolvePovInfo(
      "Chapter 11\nKamals Pov\nAcina Pov\nSplit POV or possibly broken into 2 chapters"
    );
    assert.equal(split.mode, "split");
    assert.ok(split.povs.length >= 2);
    const single = resolvePovInfo("Chapter 3\nAcina Pov\nShe explores the compound.");
    assert.equal(single.mode, "single");
    assert.equal(single.povs[0], "Acina POV");

    const summers = parseAllPovs("Hints at sequel (told in Summers POV)");
    assert.ok(summers.some((p) => /summer/i.test(p)), summers.join(","));

    const summerTab = resolvePovInfo("Chapter 29\nSummer Pov\nThe vault opens.");
    assert.equal(summerTab.mode, "single");
    assert.ok(/summer/i.test(summerTab.povs[0] ?? ""));

    const tableCell = extractPovFromTableCell("Summer");
    assert.ok(tableCell.some((p) => /summer/i.test(p)));
  });

  test("chapter 29 tab keeps Summer POV and does not bundle chapter 30", () => {
    const text = [
      "--- TAB: Chapter 29 ---",
      "Chapter 29",
      "Summer Pov",
      "The final confrontation in the vault.",
      "Chapter 30",
      "Spin off ideas only.",
    ].join("\n");
    const beats = extractOutlineBeatsFromText(text);
    const ch29 = beats.find((b) => b.chapter_number === 29);
    assert.ok(ch29, "expected chapter 29 beat");
    assert.match(ch29!.title ?? "", /Summer/i);
    assert.ok(!/Spin off/i.test(ch29!.synopsis));
  });

  test("macro outline wiki titles use beat text not Item 1", async () => {
    const { heuristicWikiFromTables } = await import("../src/lib/documentIngestOutline.js");
    const text = [
      "--- TAB: Outline ---",
      "Beginning",
      "1. Acina on Earth discovers the gate.",
      "2. The compound alarm sounds.",
    ].join("\n");
    const wiki = heuristicWikiFromTables(text, "world_bible", "00000000-0000-4000-8000-000000000099");
    assert.ok(wiki.length >= 1);
    assert.ok(!wiki.some((w) => /^item\s+1$/i.test(w.title)));
    assert.ok(wiki.some((w) => /Acina on Earth/i.test(w.title) || /Acina on Earth/i.test(w.excerpt)));
  });

  test("compileOutlineBeats drops duplicate Beginning sections", async () => {
    const { compileOutlineBeats } = await import("../src/lib/documentIngestCompile.js");
    const body =
      "Acina on Earth\nAcinas watch breaks\nAcina goes beyond the compound";
    const beats = compileOutlineBeats([
      {
        synopsis: body,
        order: 0,
        title: "Beginning",
        planning_layer: "macro_outline",
        tab_title: "Tab A",
      },
      {
        synopsis: body,
        order: 1,
        title: "Beginning",
        planning_layer: "macro_outline",
        tab_title: "Tab B",
      },
      {
        synopsis: "Chapter beat",
        order: 2,
        title: "Chapter 1 — Acina POV",
        chapter_number: 1,
        planning_layer: "chapter_breakdown",
      },
    ]);
    assert.equal(beats.filter((b) => b.planning_layer === "macro_outline").length, 1);
    assert.equal(beats.filter((b) => b.chapter_number === 1).length, 1);
  });

  test("chapter 30 franchise tab is not a narrative chapter beat", () => {
    const text = [
      "--- TAB: Chapter 30 ---",
      "Spin off and sequel book Ideas",
      "Sequel - Acina and Kamal are having issues conceiving.",
      "Spin off - Perssine prison arc on demon worlds.",
    ].join("\n");
    const beats = extractOutlineBeatsFromText(text);
    assert.ok(!beats.some((b) => b.chapter_number === 30));
    assert.ok(beats.some((b) => /Spin-off.*Perssine/i.test(b.title ?? "")));
  });

  test("fills chapters 24-29 from aggregate when only tabs 1-23 exist", () => {
    const chapterTabs = Array.from({ length: 23 }, (_, i) => {
      const n = i + 1;
      return `--- TAB: Chapter ${n} ---\n\nChapter ${n}\nAcina Pov\nBeat for chapter ${n}.`;
    }).join("\n\n");
    const aggregate = [
      "--- TAB: The Quantum Heart Outline ---",
      "Beginning",
      "Setup",
      "",
      "Middle Chapter Outline",
      "Chapter\tWhat happens\tPOV",
      ...Array.from({ length: 6 }, (_, i) => {
        const n = 24 + i;
        return `${n}\tFinal arc beat ${n}\tAcina Pov`;
      }),
    ].join("\n");
    const beats = extractOutlineBeatsFromText(`${chapterTabs}\n\n${aggregate}`);
    const chapters = beats
      .map((b) => b.chapter_number)
      .filter((n): n is number => n != null)
      .sort((a, b) => a - b);
    assert.ok(chapters.includes(23), `have: ${chapters.join(",")}`);
    assert.ok(chapters.includes(24), `have: ${chapters.join(",")}`);
    assert.ok(chapters.includes(29), `have: ${chapters.join(",")}`);
    assert.equal(chapters.filter((n) => n === 24).length, 1);
  });

  test("split POV chapter tab gets split title", () => {
    const text = [
      "--- TAB: Chapter 11 ---",
      "Chapter 11",
      "Kamals Pov",
      "Acina Pov",
      "Split POV or possibly broken into 2 chapters",
      "Ball scene conflict.",
    ].join("\n");
    const beats = extractOutlineBeatsFromText(text);
    assert.equal(beats.length, 1);
    assert.match(beats[0]!.title ?? "", /Split POV/i);
    assert.equal(beats[0]!.pov_mode, "split");
  });

  test("chapter table rows get proper titles", () => {
    const table = structureDocumentText(
      "Chapter\tWhat happens\tPOV\n1\tOpens in compound\tAcina Pov\n2\tMarket run\tAcina Pov"
    );
    const beats = extractOutlineBeatsFromText(
      `--- TAB: Middle Chapter Outline ---\n\n${table}`
    );
    assert.equal(beats.length, 2);
    assert.match(beats[0]!.title ?? "", /Chapter 1.*Acina/i);
  });

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

describe("MSGF document ingest pipeline", () => {
  test("keyword hints match only when present in text", () => {
    const config = loadDocumentIngestKeywords();
    const hits = matchKeywordHintsInText("Chapter 3 — Split POV\nElena runs.", config);
    assert.ok(hits.some((h) => h.toLowerCase().includes("chapter")));
    assert.ok(hits.some((h) => h.toLowerCase().includes("split pov")));
    const none = matchKeywordHintsInText("Hello world only.", config);
    assert.equal(none.length, 0);
  });

  test("structural signals detect tabs and tables", () => {
    const text = "--- TAB: Outline ---\n| Scene | Beat |\n| 1 | Hook |\n| 2 | Twist |";
    const signals = buildDocumentIngestSignals(text);
    assert.ok(signals.tab_count >= 1);
    assert.ok(signals.table_beat_estimate >= 2);
    assert.match(signals.summary, /Structural signals/);
  });

  test("groundProposedWikiToSource drops ungrounded excerpts", () => {
    const source = "The city of Aldermere glowed under twin moons. Captain Reyes waited.";
    const { kept, dropped } = groundProposedWikiToSource(
      [
        {
          title: "Aldermere",
          excerpt: "The city of Aldermere glowed under twin moons.",
          chunk_type: "location",
          tags: [],
          wiki_metadata: { outline_entity_kind: "setting" },
        },
        {
          title: "Fake",
          excerpt: "This sentence does not appear anywhere in the uploaded document at all.",
          chunk_type: "other",
          tags: [],
          wiki_metadata: { outline_entity_kind: "note" },
        },
      ],
      source
    );
    assert.equal(kept.length, 1);
    assert.equal(dropped, 1);
  });

  test("buildAuthorDocumentSweepFiles assigns wiki shards with paths", () => {
    const files = buildAuthorDocumentSweepFiles({
      manuscriptId: "00000000-0000-4000-8000-000000000001",
      slot: "world_bible",
      sourceText: "A".repeat(300),
      proposed: [
        {
          title: "Elena",
          excerpt: "Elena is the protagonist who seeks redemption in the capital.",
          chunk_type: "character",
          tags: ["import"],
          wiki_metadata: { outline_entity_kind: "character" },
        },
      ],
      outlineBeats: [{ synopsis: "Opening beat", order: 0 }],
    });
    assert.ok(files.some((f) => f.path.includes("/wiki/")));
    assert.ok(files.some((f) => f.path.includes("/source.txt")));
    assert.ok(files.every((f) => f.bug_index?.level_1_category === "1.0_AUTHOR"));
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
