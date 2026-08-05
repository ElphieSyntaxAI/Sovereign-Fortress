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
 * Distribution Build ID: MSGF-1b90a4ac-20260802T111608Z-internal
 */
import { createHash } from "node:crypto";

import {
  filterLocalMetacognitionContext,
  formatEntityDictionaryForPrompt,
  formatPlotBeatsForPrompt,
  loadPass1InputGate,
  loadPass2InputGate,
  loadPass3InputGate,
  mergeMetacognitionIntoState,
} from "./gates/input-gate";
import {
  parseAndValidatePass1,
  parseAndValidatePass2,
  parseAndValidatePass3,
} from "./gates/output-gate";
import { dedupeEntities, dedupePlotBeats } from "./dedupe";
import { buildStructuralMacroWindows } from "./macro-windows";
import { generateCompilerBullets, hasGeminiCredentials } from "./llm-adapter";
import { resolveDomainProfile } from "./profiles/index";
import {
  buildDocumentCompilerStructuralSignals,
  formatSignalsForConvergePrompt,
} from "./structural-signals";
import type {
  CompilerRunParams,
  DocumentIngestCompilerState,
  MultiPassCompilerResult,
} from "./types";

function emptyState(domain: CompilerRunParams["domain_profile"], windows: DocumentIngestCompilerState["macro_windows"]): DocumentIngestCompilerState {
  return {
    version: "3-pass-v1",
    domain_profile: domain,
    macro_windows: windows,
    entities: [],
    plot_beats: [],
    window_metacognition: [],
    passes_completed: [],
  };
}

async function runPass1Window(
  state: DocumentIngestCompilerState,
  profile: ReturnType<typeof resolveDomainProfile>,
  windowIndex: number,
  slotHint: string,
  signalsText: string
): Promise<{ state: DocumentIngestCompilerState; error?: string }> {
  const window = state.macro_windows[windowIndex];
  const gate = loadPass1InputGate(window, state);
  const user = [
    `Macro-window ${window.index + 1}/${window.total}: ${window.label}`,
    signalsText,
    slotHint ? `Slot hint: ${slotHint}` : "",
    "",
    "WINDOW TEXT:",
    gate.window.text.slice(0, 10_000),
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const raw = await generateCompilerBullets({ system: profile.pass1SystemPrompt, user });
    const entities = parseAndValidatePass1(raw, window.window_id, profile.entityKinds);
    return {
      state: {
        ...state,
        entities: dedupeEntities([...state.entities, ...entities]),
      },
    };
  } catch (e) {
    return { state, error: e instanceof Error ? e.message : String(e) };
  }
}

async function runPass2Window(
  state: DocumentIngestCompilerState,
  profile: ReturnType<typeof resolveDomainProfile>,
  windowIndex: number,
  signalsText: string,
  existingOutline?: string | null
): Promise<{ state: DocumentIngestCompilerState; error?: string }> {
  const window = state.macro_windows[windowIndex];
  const gate = loadPass2InputGate(window, state);
  const user = [
    `Macro-window ${window.index + 1}/${window.total}: ${window.label}`,
    signalsText,
    existingOutline ? `Existing outline context:\n${existingOutline.slice(0, 4000)}` : "",
    "",
    "ENTITY DICTIONARY:",
    formatEntityDictionaryForPrompt(gate.entityDictionary),
    "",
    "WINDOW TEXT:",
    gate.window.text.slice(0, 10_000),
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const raw = await generateCompilerBullets({ system: profile.pass2SystemPrompt, user });
    const beats = parseAndValidatePass2(raw, window.window_id);
    return {
      state: {
        ...state,
        plot_beats: dedupePlotBeats([...state.plot_beats, ...beats]),
      },
    };
  } catch (e) {
    return { state, error: e instanceof Error ? e.message : String(e) };
  }
}

async function runPass3Window(
  state: DocumentIngestCompilerState,
  profile: ReturnType<typeof resolveDomainProfile>,
  windowIndex: number
): Promise<{ state: DocumentIngestCompilerState; error?: string }> {
  const window = state.macro_windows[windowIndex];
  const gate = loadPass3InputGate(window, state);
  const local = filterLocalMetacognitionContext(window, state);
  const user = [
    `Macro-window ${window.index + 1}/${window.total}: ${window.label}`,
    "",
    "LOCAL ENTITIES:",
    formatEntityDictionaryForPrompt(local.entities),
    "",
    "LOCAL BEATS:",
    formatPlotBeatsForPrompt(local.beats),
    "",
    "WINDOW TEXT:",
    gate.window.text.slice(0, 8000),
  ].join("\n");

  try {
    const raw = await generateCompilerBullets({ system: profile.pass3SystemPrompt, user });
    const meta = parseAndValidatePass3(raw, window.window_id);
    return { state: mergeMetacognitionIntoState(state, meta) };
  } catch (e) {
    return { state, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function runMultiPassDocumentCompiler(
  params: CompilerRunParams
): Promise<MultiPassCompilerResult> {
  const profile = resolveDomainProfile(params.domain_profile);
  const signals = params.signals ?? buildDocumentCompilerStructuralSignals(params.text);
  const signalsText = formatSignalsForConvergePrompt(signals);
  const windows = buildStructuralMacroWindows(params.text, signals);
  let state = emptyState(params.domain_profile, windows);
  const window_errors: MultiPassCompilerResult["window_errors"] = [];
  const slotHint = params.slotHint ?? params.slot ?? "";

  if (!hasGeminiCredentials()) {
    const artifacts = profile.compileArtifacts(state, {
      manuscriptId: params.manuscriptId,
      slot: params.slot,
      subject_domain: params.subject_domain,
    });
    return { state, ...artifacts, window_errors: [{ window_id: "*", pass: "init", message: "No LLM credentials" }] };
  }

  for (let i = 0; i < state.macro_windows.length; i++) {
    const w = state.macro_windows[i];
    const p1 = await runPass1Window(state, profile, i, slotHint, signalsText);
    state = p1.state;
    if (p1.error) window_errors.push({ window_id: w.window_id, pass: "pass1", message: p1.error });
  }
  state = { ...state, passes_completed: [...state.passes_completed, "pass1"] };

  for (let i = 0; i < state.macro_windows.length; i++) {
    const w = state.macro_windows[i];
    const p2 = await runPass2Window(state, profile, i, signalsText, params.existingOutline);
    state = p2.state;
    if (p2.error) window_errors.push({ window_id: w.window_id, pass: "pass2", message: p2.error });
  }
  state = { ...state, passes_completed: [...state.passes_completed, "pass2"] };

  for (let i = 0; i < state.macro_windows.length; i++) {
    const w = state.macro_windows[i];
    const p3 = await runPass3Window(state, profile, i);
    state = p3.state;
    if (p3.error) window_errors.push({ window_id: w.window_id, pass: "pass3", message: p3.error });
  }
  state = { ...state, passes_completed: [...state.passes_completed, "pass3"] };

  const artifacts = profile.compileArtifacts(state, {
    manuscriptId: params.manuscriptId,
    slot: params.slot,
    subject_domain: params.subject_domain,
  });

  return { state, ...artifacts, window_errors };
}

export function compileStateToArtifacts(
  state: DocumentIngestCompilerState,
  slotOrParams: string | { manuscriptId: string; slot?: string; subject_domain?: string },
  manuscriptId?: string
): Pick<MultiPassCompilerResult, "proposed" | "outline_beats" | "semantic_regions"> {
  const params =
    typeof slotOrParams === "string"
      ? { manuscriptId: manuscriptId ?? "", slot: slotOrParams }
      : slotOrParams;
  const profile = resolveDomainProfile(state.domain_profile ?? "author_narrative");
  return profile.compileArtifacts(state, params);
}

export function compilerStateDigest(state: DocumentIngestCompilerState): string {
  const payload = JSON.stringify({
    entities: state.entities.length,
    beats: state.plot_beats.length,
    windows: state.macro_windows.length,
    meta: state.window_metacognition.length,
  });
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}
