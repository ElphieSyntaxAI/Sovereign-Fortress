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
