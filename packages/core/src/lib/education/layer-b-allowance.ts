/**
 * Layer B — teacher AI allowance levels 0–4 (P1 LLM boundaries).
 */

export type AiAllowanceLevel = 0 | 1 | 2 | 3 | 4;

export const AI_ALLOWANCE_LEVELS = [0, 1, 2, 3, 4] as const;

export const AI_ALLOWANCE_LEVEL_NAMES: Record<
  AiAllowanceLevel,
  string
> = {
  0: "Absolute Zero",
  1: "Resource Gate",
  2: "Scaffold Engine",
  3: "Socratic Dialogue",
  4: "Open Sandbox",
};

const LEGACY_ALLOWANCE_MAP: Record<string, AiAllowanceLevel> = {
  L3_FORBIDDEN: 0,
  L1_DICTIONARY: 1,
  L2_SOCRATIC: 3,
  L2_SCAFFOLD: 2,
  L4_OPEN: 4,
};

export function isAiAllowanceLevel(n: number): n is AiAllowanceLevel {
  return Number.isInteger(n) && n >= 0 && n <= 4;
}

export function normalizeAiAllowanceLevel(
  raw: unknown,
  fallback: AiAllowanceLevel = 3
): AiAllowanceLevel {
  if (typeof raw === "number" && isAiAllowanceLevel(raw)) return raw;
  if (typeof raw === "string") {
    const legacy = LEGACY_ALLOWANCE_MAP[raw.trim()];
    if (legacy !== undefined) return legacy;
    const num = Number(raw.trim());
    if (isAiAllowanceLevel(num)) return num;
  }
  return fallback;
}

export type LayerBRuntimeFlags = {
  layer: "B";
  aiAllowanceLevel: AiAllowanceLevel;
  levelName: string;
  bypassLlmOrchestration: boolean;
  chatInterfaceEnabled: boolean;
  rejectChatStreams: boolean;
  wrapLlmPrompts: boolean;
  heavyAuditLogging: boolean;
};

export function resolveLayerBFlags(level: AiAllowanceLevel): LayerBRuntimeFlags {
  const bypassLlm = level === 0 || level === 1;
  return {
    layer: "B",
    aiAllowanceLevel: level,
    levelName: AI_ALLOWANCE_LEVEL_NAMES[level],
    bypassLlmOrchestration: bypassLlm,
    chatInterfaceEnabled: level >= 2,
    rejectChatStreams: level === 1,
    wrapLlmPrompts: level >= 2,
    heavyAuditLogging: level === 4,
  };
}

export type LayerBAllowanceEvent = {
  type: "layer_b_allowance_updated";
  assignmentId: string;
  aiAllowanceLevel: AiAllowanceLevel;
  levelName: string;
  flags: LayerBRuntimeFlags;
  updatedAt: string;
};
