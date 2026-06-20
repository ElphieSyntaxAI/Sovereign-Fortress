import { Buffer } from "node:buffer";
import { Router, type Request, type Response } from "express";

import { assertUuid } from "../lib/halMetrics.js";
import { IngestionService, narrativeEmbedderProvider } from "../lib/narrative/IngestionService.js";
import {
  addConvergenceStats,
  convergeUpsertPlotBeats,
  convergeUpsertWikiEntries,
  type ConvergenceStats,
} from "../lib/ingestConverge.js";
import {
  compilePlanningCanon,
  type PlotEngineSyncPayload,
} from "../lib/planningCanonCompile.js";
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

async function handleSyncSession(req: Request, res: Response): Promise<void> {
  const user = readBearerUser(req, res);
  if (!user) return;

  let manuscriptId: string;
  try {
    manuscriptId = assertUuid(String(req.params.id ?? req.params.manuscriptId ?? ""), "manuscript id");
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Invalid manuscript id" });
    return;
  }

  const body = req.body as Record<string, unknown>;
  const wikiNotes = String(body.wikiNotes ?? "");
  const interviewTurns = (body.interviewTurns as InterviewTurnIn[]) ?? [];
  const plotBeats = (body.plotBeats as PlotBeatIn[]) ?? [];
  const plotEngine = (body.plotEngine as PlotEngineSyncPayload | null) ?? null;

  const canon = compilePlanningCanon({ plotEngine, plotBeats });
  const effectiveBeats =
    canon.outlineBeats.length > 0
      ? canon.outlineBeats.map((b) => ({ synopsis: b.synopsis, order: b.order }))
      : plotBeats;

  const supabase = getSupabaseAdmin();
  const { data: ms, error: msErr } = await supabase
    .from("p4_manuscripts")
    .select("id, tenant_id, outline")
    .eq("id", manuscriptId)
    .maybeSingle();

  if (msErr) {
    console.error("[sync-session] manuscript read", msErr.message);
    res.status(500).json({ error: msErr.message });
    return;
  }
  if (!ms) {
    res.status(404).json({ error: "Manuscript not found" });
    return;
  }

  const tenantId = assertUuid(String((ms as { tenant_id: string }).tenant_id), "tenant_id");

  const outlineText = buildOutlineFromBeats(effectiveBeats);
  let outlineUpdated = false;
  if (effectiveBeats.length > 0 && outlineText.length > 0) {
    const { error: upErr } = await supabase
      .from("p4_manuscripts")
      .update({ outline: outlineText, updated_at: new Date().toISOString() })
      .eq("id", manuscriptId);
    if (upErr) {
      res.status(500).json({ error: `Failed to update outline: ${upErr.message}` });
      return;
    }
    outlineUpdated = true;
  }

  const insightsMd = buildInsightsMarkdown(wikiNotes, interviewTurns);
  const warnings: string[] = [];
  let loreIngest: { chunksTotal: number; chunksInserted: number } | null = null;
  let plotIngest: { chunksTotal: number; chunksInserted: number } | null = null;
  let convergence: { lore: ConvergenceStats; plot: ConvergenceStats } = {
    lore: { inserted: 0, updated: 0, skipped: 0 },
    plot: { inserted: 0, updated: 0, skipped: 0 },
  };

  const ingestion = new IngestionService(supabase);

  if (canon.wikiEntries.length > 0) {
    try {
      const wikiResult = await convergeUpsertWikiEntries(supabase, {
        tenantId,
        manuscriptId,
        entries: canon.wikiEntries,
        extraMeta: {
          planning_session_sync: true,
          ledger: "wiki_snapshot",
          wiki_visibility: "draft",
          plot_engine_sync: true,
        },
        sourcePrefix: "planning-wiki",
      });
      convergence.lore = addConvergenceStats(convergence.lore, wikiResult.stats);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      warnings.push(`Plot engine wiki convergence: ${msg}`);
    }
  }

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
  } else if (effectiveBeats.length > 0) {
    warnings.push("Skipped plot vector re-index — outline text too short after beat merge.");
  }

  if (effectiveBeats.length > 0) {
    try {
      const plotStats = await convergeUpsertPlotBeats(supabase, {
        tenantId,
        manuscriptId,
        beats: effectiveBeats.map((b, i) => ({
          synopsis: String(b.synopsis ?? "").trim(),
          order: typeof b.order === "number" ? b.order : i,
          metadata: {
            outline: true,
            is_outline: true,
            scene_card: true,
            outline_entity_kind: "plot_point",
            planning_session_sync: true,
            plot_engine_sync: Boolean(plotEngine),
            ledger: "wiki_snapshot",
            wiki_visibility: "draft",
          },
        })),
        sourcePrefix: "planning-plot-beat",
      });
      convergence.plot = addConvergenceStats(convergence.plot, plotStats);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      warnings.push(`Plot beat convergence: ${msg}`);
    }
  }

  const anyWork =
    outlineUpdated ||
    loreIngest !== null ||
    plotIngest !== null ||
    convergence.lore.inserted + convergence.lore.updated > 0 ||
    convergence.plot.inserted + convergence.plot.updated > 0;

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

  res.status(200).json({
    success: anyWork,
    manuscript_id: manuscriptId,
    tenant_id: tenantId,
    outline_updated: outlineUpdated,
    lore_ingest: loreIngest,
    plot_ingest: plotIngest,
    convergence,
    canon_compile: canon.stats,
    embedder: narrativeEmbedderProvider(),
    warnings,
    revision_gate,
  });
}

/**
 * POST /api/manuscripts/:id/sync-session
 * POST /api/projects/:id/sync-session (deprecated alias)
 */
projectSyncController.post("/api/manuscripts/:id/sync-session", (req, res) => {
  void handleSyncSession(req, res);
});
projectSyncController.post("/api/projects/:id/sync-session", (req, res) => {
  void handleSyncSession(req, res);
});
