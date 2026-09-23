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
 * Distribution Build ID: MSGF-fca2d532-20260923T201750Z-internal
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildStructuralMacroWindows,
  buildEntityFingerprint,
  buildBeatId,
  compileStateToArtifacts,
  resolveEnrichedChunkTopology,
  buildDocumentCompilerStructuralSignals,
  type DocumentIngestCompilerState,
} from "../lib/services/document-compiler/index.js";

describe("document-compiler", () => {
  it("buildStructuralMacroWindows splits on chapter headings", () => {
    const text = [
      "Chapter 1: The Gate",
      "Marcus enters the vault.",
      "",
      "Chapter 2: Aftermath",
      "The green light pulses again.",
    ].join("\n");
    const signals = buildDocumentCompilerStructuralSignals(text);
    const windows = buildStructuralMacroWindows(text, signals);
    assert.ok(windows.length >= 2);
    assert.equal(windows[0]?.kind, "chapter");
  });

  it("buildEntityFingerprint uses fingerprint_ prefix", () => {
    assert.equal(buildEntityFingerprint("Marcus Albanus", "character"), "fingerprint_marcus_albanus");
  });

  it("resolveEnrichedChunkTopology maps window-local entities and breadcrumbs", () => {
    const state: DocumentIngestCompilerState = {
      version: "3-pass-v1",
      domain_profile: "author_narrative",
      macro_windows: [
        {
          window_id: "macro_chapter_0",
          index: 0,
          total: 1,
          label: "Chapter 1",
          text: "Marcus sees the green light.",
          char_start: 0,
          char_end: 30,
          kind: "chapter",
        },
      ],
      entities: [
        {
          name: "Marcus Albanus",
          entity_fingerprint: "fingerprint_marcus_albanus",
          kind: "character",
          traits: ["commander"],
          source_window_ids: ["macro_chapter_0"],
        },
      ],
      plot_beats: [
        {
          beat_id: "beat_id_scene_1",
          synopsis: "Marcus discovers the hidden vault beneath the station.",
          order: 0,
          active_entity_fingerprints: ["fingerprint_marcus_albanus"],
          source_window_id: "macro_chapter_0",
        },
      ],
      window_metacognition: [
        {
          window_id: "macro_chapter_0",
          thematic_breadcrumbs: ["#foreshadowing", "#lore_dependency"],
          symbolic_elements: [{ motif: "green light", resonance: "idealized future" }],
          active_entity_fingerprints: ["fingerprint_marcus_albanus"],
          active_beat_ids: ["beat_id_scene_1"],
        },
      ],
      passes_completed: ["pass1", "pass2", "pass3"],
    };

    const topo = resolveEnrichedChunkTopology({
      charStart: 5,
      charEnd: 20,
      compilerState: state,
      manuscriptId: "ms-1",
      ingestSlot: "current_draft",
    });

    assert.deepEqual(topo.active_entities, ["fingerprint_marcus_albanus"]);
    assert.deepEqual(topo.plot_beats, ["beat_id_scene_1"]);
    assert.ok(topo.thematic_breadcrumbs.includes("#foreshadowing"));
    assert.equal(topo.symbolism["green light"], "idealized future");
    assert.equal(topo.ledger, "source_manuscript");
  });

  it("compileStateToArtifacts produces wiki rows and outline beats", () => {
    const state: DocumentIngestCompilerState = {
      version: "3-pass-v1",
      domain_profile: "author_narrative",
      macro_windows: [],
      entities: [
        {
          name: "Marcus Albanus",
          entity_fingerprint: "fingerprint_marcus_albanus",
          kind: "character",
          traits: ["veteran pilot", "haunted by the gate incident"],
          source_window_ids: ["w0"],
        },
      ],
      plot_beats: [
        {
          beat_id: buildBeatId(0, "Vault Discovery"),
          synopsis: "Marcus Albanus opens the sealed vault beneath Elphine Station.",
          order: 0,
          title: "Vault Discovery",
          active_entity_fingerprints: ["fingerprint_marcus_albanus"],
          source_window_id: "w0",
        },
      ],
      window_metacognition: [],
      passes_completed: ["pass1", "pass2", "pass3"],
    };

    const { proposed, outline_beats } = compileStateToArtifacts(state, "current_draft", "ms-1");
    assert.ok(proposed.length >= 1);
    assert.equal(outline_beats.length, 1);
    assert.equal(outline_beats[0]?.beat_id, buildBeatId(0, "Vault Discovery"));
  });
});
