/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * This source code and associated documentation are the exclusive property of
 * Elphie Syntax LLC. Unauthorized copying, distribution, publication, or
 * reverse-engineering — including decompilation, disassembly, or derivative
 * works — is strictly prohibited without prior written consent.
 *
 * Distribution Build ID: MSGF-149f647f-20260728T230931Z-internal
 */
import type { EntityKind, EntityRecord, PlotBeatRecord, SymbolicElement, WindowMetacognition } from "../types";
import { buildBeatId, buildEntityFingerprint } from "../fingerprints";
import { parseJsonStripFences } from "../parse-json";

const ENTITY_KINDS = new Set<string>([
  "character",
  "setting",
  "item",
  "faction",
  "concept",
  "standard",
  "vocabulary",
  "learning_objective",
  "other",
]);

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x ?? "").trim()).filter(Boolean);
}

function normalizeEntityKind(kind: unknown, allowedKinds: EntityKind[]): EntityKind {
  const k = String(kind ?? "other").trim().toLowerCase();
  if (ENTITY_KINDS.has(k) && allowedKinds.includes(k as EntityKind)) return k as EntityKind;
  return allowedKinds.includes("other") ? "other" : allowedKinds[0];
}

export function validatePass1Output(
  raw: unknown,
  windowId: string,
  allowedKinds: EntityKind[]
): EntityRecord[] {
  const root = raw as { entities?: unknown[] };
  if (!Array.isArray(root?.entities)) return [];
  const out: EntityRecord[] = [];
  for (const row of root.entities) {
    const r = row as Record<string, unknown>;
    const name = String(r.name ?? "").trim();
    if (!name) continue;
    const kind = normalizeEntityKind(r.kind, allowedKinds);
    const traits = asStringArray(r.traits).slice(0, 8);
    out.push({
      name,
      entity_fingerprint: buildEntityFingerprint(name, kind),
      kind,
      traits,
      source_window_ids: [windowId],
    });
  }
  return out;
}

export function validatePass2Output(raw: unknown, windowId: string): PlotBeatRecord[] {
  const root = raw as { plot_beats?: unknown[]; beats?: unknown[] };
  const rows = Array.isArray(root?.plot_beats)
    ? root.plot_beats
    : Array.isArray(root?.beats)
      ? root.beats
      : [];
  const out: PlotBeatRecord[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] as Record<string, unknown>;
    const synopsis = String(r.synopsis ?? r.summary ?? "").trim();
    if (!synopsis) continue;
    const order = Number.isFinite(Number(r.order)) ? Number(r.order) : i;
    const title = r.title != null ? String(r.title).trim() : undefined;
    const chapter_number =
      r.chapter_number != null && Number.isFinite(Number(r.chapter_number))
        ? Number(r.chapter_number)
        : null;
    const fps = asStringArray(r.active_entity_fingerprints ?? r.entities).slice(0, 12);
    out.push({
      beat_id: String(r.beat_id ?? buildBeatId(order, title)),
      synopsis,
      order,
      title,
      chapter_number,
      active_entity_fingerprints: fps,
      source_window_id: windowId,
    });
  }
  return out;
}

export function validatePass3Output(raw: unknown, windowId: string): WindowMetacognition {
  const root = raw as Record<string, unknown>;
  const breadcrumbs = asStringArray(root.thematic_breadcrumbs ?? root.breadcrumbs).slice(0, 12);
  const symRaw = Array.isArray(root.symbolic_elements) ? root.symbolic_elements : [];
  const symbolic_elements: SymbolicElement[] = [];
  for (const s of symRaw) {
    const row = s as Record<string, unknown>;
    const motif = String(row.motif ?? row.symbol ?? "").trim();
    const resonance = String(row.resonance ?? row.meaning ?? "").trim();
    if (motif) symbolic_elements.push({ motif, resonance });
  }
  return {
    window_id: windowId,
    thematic_breadcrumbs: breadcrumbs,
    symbolic_elements: symbolic_elements.slice(0, 8),
    active_entity_fingerprints: asStringArray(root.active_entity_fingerprints).slice(0, 16),
    active_beat_ids: asStringArray(root.active_beat_ids ?? root.plot_beats).slice(0, 16),
  };
}

export function parseAndValidatePass1(
  text: string,
  windowId: string,
  allowedKinds: EntityKind[]
): EntityRecord[] {
  return validatePass1Output(parseJsonStripFences(text), windowId, allowedKinds);
}

export function parseAndValidatePass2(text: string, windowId: string): PlotBeatRecord[] {
  return validatePass2Output(parseJsonStripFences(text), windowId);
}

export function parseAndValidatePass3(text: string, windowId: string): WindowMetacognition {
  return validatePass3Output(parseJsonStripFences(text), windowId);
}
