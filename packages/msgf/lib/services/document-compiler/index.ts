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
 * Distribution Build ID: MSGF-1826a636-20260922T234439Z-internal
 */
export * from "./types";
export {
  buildStructuralMacroWindows,
  splitDocumentForConverge,
  type ConvergeTextChunk,
} from "./macro-windows";
export {
  buildDocumentCompilerStructuralSignals,
  formatSignalsForConvergePrompt,
} from "./structural-signals";
export {
  runMultiPassDocumentCompiler,
  compileStateToArtifacts,
  compilerStateDigest,
} from "./orchestrator";
export {
  resolveEnrichedChunkTopology,
  buildEducationChunkTopology,
} from "./topology";
export { resolveDomainProfile, authorNarrativeProfile, educationCurriculumProfile } from "./profiles/index";
export { buildEntityFingerprint, buildBeatId } from "./fingerprints";
export { hasGeminiCredentials, generateCompilerBullets } from "./llm-adapter";
export { dedupeEntities, dedupePlotBeats } from "./dedupe";
