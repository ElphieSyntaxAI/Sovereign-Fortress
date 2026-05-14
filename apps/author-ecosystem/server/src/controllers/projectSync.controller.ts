import { Buffer } from "node:buffer";
import { Router, type Request, type Response } from "express";

import { assertUuid } from "../lib/halMetrics.js";
import { IngestionService } from "../lib/narrative/IngestionService.js";
import { applyPlanningSyncRevisionGate } from "../middleware/RevisionGateMiddleware.js";
import { readBearerUser } from "../lib/readBearerJwtUser.js";
import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";

export const projectSyncController = Router();

type InterviewTurnIn = { question?: string; answer?: string };
type PlotBeatIn = { synopsis?: string; order?: number };

function buildInsightsMarkdown(wikiNotes: string, turns: InterviewTurnIn[]): string {
  const parts: string[] = [];
  const wn = String(wikiNotes ?? "").trim();
  if (wn) {
    parts.push("# Author wiki notes (planning session)", "", wn, "");
  }
  const list = Array.isArray(turns) ? turns : [];
  if (list.length > 0) {
    parts.push("# Librarian interview — consolidated insights", "");
    let i = 0;
    for (const t of list) {
      i += 1;
      const q = String(t.question ?? "").trim() || "(question)";
      const a = String(t.answer ?? "").trim() || "(answer)";
      parts.push(`## Turn ${i}`, "", `**Q:** ${q}`, "", `**A:** ${a}`, "");
    }
  }
  parts.push(
    "",
    "---",
    "",
    "This document was produced by Planning Command Center → Sync to Librarian. Treat as author-only draft wiki material until published."
  );
  return parts.join("\n").trim();
}

function buildOutlineFromBeats(beats: PlotBeatIn[]): string {
  const rows = Array.isArray(beats) ? [...beats] : [];
  rows.sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0));
  return rows
    .map((b, i) => {
      const s = String(b.synopsis ?? "").trim();
      return s ? `${i + 1}. ${s}` : "";
    })
    .filter(Boolean)
    .join("\n\n");
}

/**
 * POST /api/projects/:id/sync-session
 * Consolidates planning session (interview, sandbox beats, wiki notes) into manuscript outline + narrative library vectors.
 * `:id` is the manuscript / project UUID (`p4_manuscripts.id`).
 */
projectSyncController.post("/api/projects/:id/sync-session", async (req: Request, res: Response) => {
  const user = readBearerUser(req, res);
  if (!user) return;

  let manuscriptId: string;
  try {
    manuscriptId = assertUuid(String(req.params.id ?? ""), "project id");
  } catch (e) {
    return res.status(400).json({ error: e instanceof Error ? e.message : "Invalid project id" });
  }

  const body = req.body as Record<string, unknown>;
  const wikiNotes = String(body.wikiNotes ?? "");
  const interviewTurns = (body.interviewTurns as InterviewTurnIn[]) ?? [];
  const plotBeats = (body.plotBeats as PlotBeatIn[]) ?? [];

  const supabase = getSupabaseAdmin();
  const { data: ms, error: msErr } = await supabase
    .from("p4_manuscripts")
    .select("id, tenant_id, outline")
    .eq("id", manuscriptId)
    .maybeSingle();

  if (msErr) {
    console.error("[sync-session] manuscript read", msErr.message);
    return res.status(500).json({ error: msErr.message });
  }
  if (!ms) {
    return res.status(404).json({ error: "Manuscript not found" });
  }

  const tenantId = assertUuid(String((ms as { tenant_id: string }).tenant_id), "tenant_id");

  const outlineText = buildOutlineFromBeats(plotBeats);
  let outlineUpdated = false;
  if (plotBeats.length > 0 && outlineText.length > 0) {
    const { error: upErr } = await supabase
      .from("p4_manuscripts")
      .update({ outline: outlineText, updated_at: new Date().toISOString() })
      .eq("id", manuscriptId);
    if (upErr) {
      return res.status(500).json({ error: `Failed to update outline: ${upErr.message}` });
    }
    outlineUpdated = true;
  }

  const insightsMd = buildInsightsMarkdown(wikiNotes, interviewTurns);
  const warnings: string[] = [];
  let loreIngest: { chunksTotal: number; chunksInserted: number } | null = null;
  let plotIngest: { chunksTotal: number; chunksInserted: number } | null = null;

  const ingestion = new IngestionService(supabase);

  if (insightsMd.length >= 80) {
    try {
      loreIngest = await ingestion.ingestManuscript({
        tenantId,
        sourceDocument: `planning_session_insights/${manuscriptId}`,
        chunkType: "lore",
        buffer: Buffer.from(insightsMd, "utf8"),
        filename: "planning-session-insights.md",
        metadata: {
          ledger: "wiki_snapshot",
          wiki_visibility: "draft",
          planning_session_sync: true,
          manuscript_id: manuscriptId,
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      warnings.push(`Lore ingest (wiki_snapshot): ${msg}`);
    }
  } else {
    warnings.push("Skipped lore ingest — combined interview + wiki notes below minimum size (80 chars).");
  }

  if (outlineText.length >= 40) {
    try {
      plotIngest = await ingestion.ingestManuscript({
        tenantId,
        sourceDocument: `planning_session_outline/${manuscriptId}`,
        chunkType: "plot",
        buffer: Buffer.from(outlineText, "utf8"),
        filename: "sandbox-outline.txt",
        metadata: {
          outline: true,
          is_outline: true,
          manuscript_id: manuscriptId,
          planning_session_sync: true,
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      warnings.push(`Plot re-index (outline beats): ${msg}`);
    }
  } else if (plotBeats.length > 0) {
    warnings.push("Skipped plot vector re-index — outline text too short after beat merge.");
  }

  const anyWork = outlineUpdated || loreIngest !== null || plotIngest !== null;

  let revision_gate: Awaited<ReturnType<typeof applyPlanningSyncRevisionGate>> | null = null;
  try {
    revision_gate = await applyPlanningSyncRevisionGate(supabase, {
      userId: user.userId,
      tenantId,
      manuscriptId,
      anyWork,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    warnings.push(`Revision gate: ${msg}`);
  }

  return res.status(200).json({
    success: anyWork,
    manuscript_id: manuscriptId,
    tenant_id: tenantId,
    outline_updated: outlineUpdated,
    lore_ingest: loreIngest,
    plot_ingest: plotIngest,
    warnings,
    revision_gate,
  });
});
