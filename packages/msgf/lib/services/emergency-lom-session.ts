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
 * Distribution Build ID: MSGF-1013d7a-20260522T022234Z-internal
 */
/**
 * Emergency LOM session — Gemini + Claude analyze a Sentinel snapshot vs P2 Roadmap.
 */

import { v1beta1 } from "@google-cloud/aiplatform";

import { getGcpProjectId, SERVICE_ACCOUNT_PATH } from "@/lib/msgf-vertex";
import type { DiagnosticSnapshot } from "@/lib/schemas/diagnostic-snapshot";
import {
  buildP2RoadmapDirective,
  buildVaultCrossRefContext,
  type P2RoadmapConfig,
  type PrioritizedVaultLineage,
} from "@/lib/services/p2-flow-roadmap";
import type { SentinelDriftAssessment } from "@/lib/services/LogicDriftService";
import {
  executeAiWave,
  isCostRunawayError,
  runWithLlmTimeoutSimple,
} from "@/lib/services/cost-runaway-guard";
import {
  isAnthropicPublisherModelPath,
  runAnthropicDirectPublisherModel,
} from "@/lib/services/anthropic-direct-fallback";

const VERTEX_LOCATION = process.env.GCP_LOCATION || "us-central1";
const CLAUDE_VERTEX_LOCATION =
  process.env.MSGF_CLAUDE_VERTEX_LOCATION?.trim() ||
  process.env.GCP_CLAUDE_LOCATION?.trim() ||
  "global";
const GEMINI_MODEL_ID = process.env.MSGF_VERTEX_MODEL || "gemini-2.5-flash";
const CLAUDE_MODEL_ID = process.env.MSGF_CLAUDE_MODEL || "claude-sonnet-4@20250514";

function vertexEndpointForLocation(location: string): string {
  return location === "global" ? "aiplatform.googleapis.com" : `${location}-aiplatform.googleapis.com`;
}

function vertexEndpointForModelPath(modelPath: string): string {
  const location = modelPath.match(/\/locations\/([^/]+)\//)?.[1] || VERTEX_LOCATION;
  return vertexEndpointForLocation(location);
}

export type EmergencyLomVerdict = "ROADMAP_ALIGNED" | "ROADMAP_CONFLICT" | "INCONCLUSIVE";

export type EmergencyLomModelResult = {
  verdict: EmergencyLomVerdict;
  reason: string;
};

export type EmergencyLomSessionResult = {
  gemini: EmergencyLomModelResult;
  claude: EmergencyLomModelResult;
  modelsAgree: boolean;
  roadmapConflictDetected: boolean;
  lomRecursionPath: "emergency_sentinel";
};

function parseLomVerdict(text: string): EmergencyLomModelResult {
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  const jsonCandidate = cleaned.match(/\{[\s\S]*\}/)?.[0] ?? cleaned;
  try {
    const parsed = JSON.parse(jsonCandidate) as { verdict?: string; reason?: string };
    const v = parsed.verdict?.toUpperCase();
    const verdict: EmergencyLomVerdict =
      v === "ROADMAP_ALIGNED"
        ? "ROADMAP_ALIGNED"
        : v === "ROADMAP_CONFLICT"
          ? "ROADMAP_CONFLICT"
          : "INCONCLUSIVE";
    return { verdict, reason: parsed.reason?.trim() || "No reason returned." };
  } catch {
    const lower = cleaned.toLowerCase();
    if (lower.includes("roadmap_conflict") || lower.includes("conflict")) {
      return { verdict: "ROADMAP_CONFLICT", reason: "Parsed from free text." };
    }
    if (lower.includes("roadmap_aligned") || lower.includes("aligned")) {
      return { verdict: "ROADMAP_ALIGNED", reason: "Parsed from free text." };
    }
    return { verdict: "INCONCLUSIVE", reason: "Unparseable model response." };
  }
}

async function runPublisherModel(
  modelPath: string,
  prompt: string
): Promise<EmergencyLomModelResult> {
  if (isAnthropicPublisherModelPath(modelPath) && process.env.ANTHROPIC_API_KEY?.trim()) {
    const text = await runAnthropicDirectPublisherModel({
      modelPath,
      prompt,
      maxTokens: 280,
      temperature: 0.1,
    });
    return parseLomVerdict(text);
  }

  const client = new v1beta1.PredictionServiceClient({
    keyFilename: SERVICE_ACCOUNT_PATH,
    apiEndpoint: vertexEndpointForModelPath(modelPath),
  });

  const [resp] = await runWithLlmTimeoutSimple(`emergency_lom.publisher.${modelPath.slice(-32)}`, () =>
    client.generateContent({
      model: modelPath,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 280 },
    })
  );

  const text = resp?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  return parseLomVerdict(text);
}

function buildEmergencyLomPrompt(params: {
  snapshot: DiagnosticSnapshot;
  drift: SentinelDriftAssessment;
  p2Roadmap: P2RoadmapConfig;
  vaultP2: PrioritizedVaultLineage;
}): string {
  const editor = params.snapshot.editor ?? {};
  const p2Directive = buildP2RoadmapDirective(params.p2Roadmap);
  const vaultCtx = buildVaultCrossRefContext(params.vaultP2);

  return `You are an Emergency LOM (Logic of Mind) analyst for MSGF self-heal.
${p2Directive}
${vaultCtx}

Logic drift score: ${params.drift.score} (escalate=${params.drift.escalateToGlobalBrain})
P2 roadmap contradiction (deterministic): ${params.drift.contradictsP2Roadmap}
DEFEND preflight tier: ${params.drift.preflightTier}

Operator report:
${params.snapshot.operator_note?.slice(0, 2000) ?? ""}

Editor excerpt (privacy-safe summary only):
${typeof editor.editor_text_excerpt === "string" ? editor.editor_text_excerpt.slice(0, 1200) : "(none)"}

Wiki notes excerpt:
${typeof editor.wiki_notes_excerpt === "string" ? editor.wiki_notes_excerpt.slice(0, 800) : "(none)"}

Task: Decide if the user's session is blocked by a **P2 Roadmap conflict** (deprecated Vault pattern vs MSGF 1.0 modular pipeline).

Reply with strict JSON only:
{"verdict":"ROADMAP_ALIGNED"|"ROADMAP_CONFLICT"|"INCONCLUSIVE","reason":"short reason"}

- ROADMAP_CONFLICT: stale/deprecated architecture or Vault pattern contradicts P2; user needs a session-local unblock.
- ROADMAP_ALIGNED: issue is routine; no roadmap conflict.
- INCONCLUSIVE: insufficient signal.`;
}

/**
 * Dual-model emergency LOM — ties into the same recursion semantics as PulseEngine CONVERGE.
 */
export async function runEmergencyLomSession(params: {
  snapshot: DiagnosticSnapshot;
  drift: SentinelDriftAssessment;
  p2Roadmap: P2RoadmapConfig;
}): Promise<EmergencyLomSessionResult> {
  const prompt = buildEmergencyLomPrompt({
    snapshot: params.snapshot,
    drift: params.drift,
    p2Roadmap: params.p2Roadmap,
    vaultP2: params.drift.vaultP2Prioritized,
  });

  const projectId = getGcpProjectId();
  const geminiPath = `projects/${projectId}/locations/${VERTEX_LOCATION}/publishers/google/models/${GEMINI_MODEL_ID}`;
  const claudePath = `projects/${projectId}/locations/${CLAUDE_VERTEX_LOCATION}/publishers/anthropic/models/${CLAUDE_MODEL_ID}`;

  let gemini: EmergencyLomModelResult;
  let claude: EmergencyLomModelResult;

  try {
    [gemini, claude] = await executeAiWave("emergency_lom.dual_publishers", () =>
      Promise.all([
        runPublisherModel(geminiPath, prompt),
        runPublisherModel(claudePath, prompt),
      ])
    );
  } catch (e) {
    if (isCostRunawayError(e)) {
      throw e;
    }
    const msg = e instanceof Error ? e.message : "Emergency LOM model call failed.";
    console.warn("[emergency-lom-session]", msg);
    gemini = { verdict: "INCONCLUSIVE", reason: msg };
    claude = { verdict: "INCONCLUSIVE", reason: msg };
  }

  const modelsAgree = gemini.verdict === claude.verdict;
  const roadmapConflictDetected =
    (gemini.verdict === "ROADMAP_CONFLICT" && claude.verdict === "ROADMAP_CONFLICT") ||
    (modelsAgree && gemini.verdict === "ROADMAP_CONFLICT") ||
    (params.drift.contradictsP2Roadmap &&
      (gemini.verdict === "ROADMAP_CONFLICT" || claude.verdict === "ROADMAP_CONFLICT"));

  return {
    gemini,
    claude,
    modelsAgree,
    roadmapConflictDetected,
    lomRecursionPath: "emergency_sentinel",
  };
}
