import { randomUUID } from "node:crypto";
import { Router, type Request, type Response } from "express";

import {
  attachContinuityFlags,
  proposeChapterFacts,
  type ChapterFactCard,
} from "../lib/chapterFacts.js";
import { readBearerUser } from "../lib/readBearerJwtUser.js";
import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";
import { writeWikiEntryWithMergeGate } from "../lib/wikiWriteGate.js";
import {
  buildWikiProvenance,
  formatWikiProvenanceRef,
} from "../lib/wikiProvenance.js";

export const chapterFactsController = Router();

const sessions = new Map<
  string,
  {
    tenantId: string;
    manuscriptId: string;
    cards: ChapterFactCard[];
    chapterNumber: number | null;
    createdAt: string;
  }
>();

async function assertManuscriptOwned(
  tenantId: string,
  manuscriptId: string
): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("p4_manuscripts")
    .select("id")
    .eq("id", manuscriptId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return Boolean(data);
}

/**
 * POST /api/chapter-facts/propose
 */
chapterFactsController.post("/api/chapter-facts/propose", async (req: Request, res: Response) => {
  const user = readBearerUser(req, res);
  if (!user) return;

  const body = (req.body ?? {}) as Record<string, unknown>;
  const manuscriptId = String(body.manuscript_id ?? "").trim();
  const chapterText = String(body.chapter_text ?? body.text ?? "").trim();
  const chapterNumber =
    body.chapter_number != null && Number.isFinite(Number(body.chapter_number))
      ? Number(body.chapter_number)
      : null;

  if (!manuscriptId) return res.status(400).json({ error: "manuscript_id is required" });
  if (chapterText.length < 80) {
    return res.status(400).json({ error: "chapter_text must be at least 80 characters" });
  }
  if (!(await assertManuscriptOwned(user.userId, manuscriptId))) {
    return res.status(404).json({ error: "Manuscript not found" });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { cards: raw, used_llm } = await proposeChapterFacts({
      text: chapterText,
      manuscriptId,
      chapterNumber,
    });
    const cards = await attachContinuityFlags(supabase, {
      tenantId: user.userId,
      manuscriptId,
      cards: raw,
    });

    const sessionId = randomUUID();
    sessions.set(sessionId, {
      tenantId: user.userId,
      manuscriptId,
      cards,
      chapterNumber,
      createdAt: new Date().toISOString(),
    });

    return res.json({
      session_id: sessionId,
      used_llm,
      card_count: cards.length,
      cards,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return res.status(500).json({ error: msg });
  }
});

/**
 * POST /api/chapter-facts/commit — approve cards → wiki backfill or Lore Merges
 */
chapterFactsController.post("/api/chapter-facts/commit", async (req: Request, res: Response) => {
  const user = readBearerUser(req, res);
  if (!user) return;

  const body = (req.body ?? {}) as Record<string, unknown>;
  const sessionId = String(body.session_id ?? "").trim();
  const manuscriptId = String(body.manuscript_id ?? "").trim();
  const approvedIndexes = Array.isArray(body.approved_indexes)
    ? body.approved_indexes.map((n) => Number(n)).filter((n) => Number.isFinite(n))
    : null;
  const approvedCards = Array.isArray(body.cards) ? (body.cards as ChapterFactCard[]) : null;

  const session = sessionId ? sessions.get(sessionId) : null;
  if (session && session.tenantId !== user.userId) {
    return res.status(403).json({ error: "Session forbidden" });
  }

  const mid = manuscriptId || session?.manuscriptId || "";
  if (!mid) return res.status(400).json({ error: "manuscript_id is required" });
  if (!(await assertManuscriptOwned(user.userId, mid))) {
    return res.status(404).json({ error: "Manuscript not found" });
  }

  let cards: ChapterFactCard[] = [];
  if (approvedCards && approvedCards.length > 0) {
    cards = approvedCards;
  } else if (session) {
    if (approvedIndexes && approvedIndexes.length > 0) {
      cards = approvedIndexes
        .map((i) => session.cards[i])
        .filter(Boolean) as ChapterFactCard[];
    } else {
      cards = session.cards.filter((c) => c.continuity_flags?.status !== "conflict");
      // Still allow conflicts via explicit indexes; default commit skips auto-conflict? Plan says conflicts open merges — include all approved or all cards
      cards = session.cards;
    }
  } else {
    return res.status(400).json({ error: "session_id or cards required" });
  }

  const supabase = getSupabaseAdmin();
  const provenance = buildWikiProvenance({
    source: "live_manuscript",
    channel: "chapter_facts",
    manuscriptId: mid,
    chapterNumber: session?.chapterNumber ?? null,
  });

  let wiki_upserted = 0;
  let merges_opened = 0;
  const merge_ids: string[] = [];

  for (const card of cards) {
    const preferMerge = card.continuity_flags?.status === "conflict";
    const gate = await writeWikiEntryWithMergeGate(supabase, {
      tenantId: user.userId,
      manuscriptId: mid,
      entry: card,
      provenance: card.provenance ?? provenance,
      sourcePrefix: "chapter-fact",
      continuityNote: card.continuity_flags?.note,
      preferMergeOnConflictFlag: preferMerge,
      extraMeta: {
        chapter_fact: true,
        major_event: card.major_event === true || card.tags?.includes("major_event"),
      },
    });
    if (gate.kind === "merge_opened") {
      merges_opened += 1;
      merge_ids.push(gate.merge.id);
    } else if (gate.result.action === "inserted" || gate.result.action === "updated") {
      wiki_upserted += 1;
    }
  }

  if (sessionId) sessions.delete(sessionId);

  return res.json({
    ok: true,
    wiki_upserted,
    merges_opened,
    merge_ids,
    message:
      merges_opened > 0
        ? `Saved ${wiki_upserted} wiki facts; ${merges_opened} conflict(s) opened as Lore Merges for review.`
        : `Backfilled ${wiki_upserted} wiki facts from chapter.`,
  });
});

/**
 * POST /api/chapter-facts/tag — selection → draft wiki or lore merge
 */
chapterFactsController.post("/api/chapter-facts/tag", async (req: Request, res: Response) => {
  const user = readBearerUser(req, res);
  if (!user) return;

  const body = (req.body ?? {}) as Record<string, unknown>;
  const manuscriptId = String(body.manuscript_id ?? "").trim();
  const selectedText = String(body.selected_text ?? body.text ?? "").trim();
  const tagKind = String(body.tag_kind ?? "continuity_note").trim();
  const note = String(body.note ?? "").trim();
  const chapterNumber =
    body.chapter_number != null && Number.isFinite(Number(body.chapter_number))
      ? Number(body.chapter_number)
      : null;

  const allowed = new Set(["breadcrumb", "major_event", "character_beat", "continuity_note"]);
  if (!allowed.has(tagKind)) {
    return res.status(400).json({
      error: "tag_kind must be breadcrumb|major_event|character_beat|continuity_note",
    });
  }
  if (!manuscriptId) return res.status(400).json({ error: "manuscript_id is required" });
  if (selectedText.length < 20) {
    return res.status(400).json({ error: "selected_text must be at least 20 characters" });
  }
  if (!(await assertManuscriptOwned(user.userId, manuscriptId))) {
    return res.status(404).json({ error: "Manuscript not found" });
  }

  const provenance = buildWikiProvenance({
    source: "live_manuscript",
    channel: "author_tag",
    manuscriptId,
    chapterNumber,
  });

  const kindMap: Record<string, string> = {
    breadcrumb: "note",
    major_event: "plot_point",
    character_beat: "character",
    continuity_note: "note",
  };
  const title =
    note.slice(0, 80) ||
    `${tagKind.replace(/_/g, " ")}: ${selectedText.slice(0, 48)}…`;

  const entry = {
    title,
    excerpt: selectedText.slice(0, 520),
    chunk_type:
      tagKind === "character_beat" ? ("character" as const) : tagKind === "major_event" ? ("event" as const) : ("other" as const),
    tags: ["author_tagged", tagKind, "live_manuscript"],
    wiki_metadata: {
      author_tagged: true,
      tag_kind: tagKind,
      outline_entity_kind: kindMap[tagKind],
      chapter_number: chapterNumber,
      manuscript_id: manuscriptId,
      provenance,
    },
  };

  const supabase = getSupabaseAdmin();
  const gate = await writeWikiEntryWithMergeGate(supabase, {
    tenantId: user.userId,
    manuscriptId,
    entry,
    provenance,
    sourcePrefix: "author-tag",
  });

  if (gate.kind === "merge_opened") {
    return res.status(202).json({
      ok: true,
      merge_opened: true,
      merge: gate.merge,
      ref_label: formatWikiProvenanceRef(provenance),
      message: "Conflict with existing lore — opened Lore Merge for review.",
    });
  }

  return res.json({
    ok: true,
    merge_opened: false,
    upsert: gate.result,
    ref_label: formatWikiProvenanceRef(provenance),
    message: "Tagged selection saved to draft wiki.",
  });
});
