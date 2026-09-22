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
 * Distribution Build ID: MSGF-b4dfaf97-20260922T171835Z-internal
 */
import type { EntityRecord, PlotBeatRecord } from "./types";

export function dedupeEntities(entities: EntityRecord[]): EntityRecord[] {
  const byFp = new Map<string, EntityRecord>();
  for (const e of entities) {
    const existing = byFp.get(e.entity_fingerprint);
    if (!existing) {
      byFp.set(e.entity_fingerprint, { ...e, source_window_ids: [...e.source_window_ids] });
      continue;
    }
    const windows = new Set([...existing.source_window_ids, ...e.source_window_ids]);
    const traits = [...new Set([...existing.traits, ...e.traits])].slice(0, 8);
    byFp.set(e.entity_fingerprint, {
      ...existing,
      traits,
      source_window_ids: [...windows],
    });
  }
  return [...byFp.values()];
}

export function dedupePlotBeats(beats: PlotBeatRecord[]): PlotBeatRecord[] {
  const byId = new Map<string, PlotBeatRecord>();
  for (const b of beats) {
    const key = b.beat_id || `order_${b.order}`;
    if (!byId.has(key)) {
      byId.set(key, b);
      continue;
    }
    const prev = byId.get(key)!;
    if (b.synopsis.length > prev.synopsis.length) byId.set(key, b);
  }
  return [...byId.values()].sort((a, b) => a.order - b.order);
}
