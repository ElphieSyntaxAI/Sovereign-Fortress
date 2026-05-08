import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { v1beta1 } from "@google-cloud/aiplatform";

import { createClient as createSupabaseServerClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import type { ShadowPreflightResult } from "@/lib/msgf-shadow";
import { pillarGateMeta } from "@/lib/msgf-pillar-meta";
import {
  StateLedgerP4,
  KeystrokeChunk,
  KeystrokeEvent,
  chunkKeystrokeStream,
} from "@/packages/core/src/P4";
import { CURRENT_LEGAL_VERSION } from "@/packages/core/src/msgf-legal";
import {
  calculateHalScore,
  getBiometricProfile,
  ModelVerdict,
  recalibrateUser,
  upsertBiometricProfileFromPulse,
} from "@/packages/core/src/msgf-consensus";
import {
  assertServiceAccountPresent,
  getGcpProjectId,
  getVertexGenerativeModel,
  SERVICE_ACCOUNT_PATH,
} from "@/packages/core/src/msgf-vertex";
import { preFlightCheck } from "@/packages/core/src/msgf-shadow";
import {
  getActiveSlice,
  HOT_LAYER_ACTIVE_SLICE_TTL_SECONDS,
  setActiveSlice,
} from "@/packages/core/src/msgf-hot-layer";
import { applyPulseCorsHeaders, pulseCorsPreflightResponse } from "@/lib/msgf-cors";

type PulseRequestBody = {
  keystrokes: KeystrokeEvent[];
  /** Optional human override outcome after manual tie-break review. */
  humanTieBreakerResolved?: boolean;
  /** Optional approved delta text to persist to Vault. */
  approvedDelta?: string;
};

type ConsensusVote = "HUMAN" | "NON_HUMAN" | "INCONCLUSIVE";

const VERTEX_LOCATION = process.env.GCP_LOCATION || "us-central1";
const GEMINI_MODEL_ID = process.env.MSGF_VERTEX_MODEL || "gemini-2.5-flash";
const CLAUDE_MODEL_ID = process.env.MSGF_CLAUDE_MODEL || "claude-4.6-sonnet";

function buildPrompt(chunk: KeystrokeChunk, beatsContext: string) {
  return `You are evaluating whether a writing keystroke chunk reflects normal human drafting behavior.

Prior user beat context:
${beatsContext}

Keystroke chunk:
${chunk.traceText}

Reply with strict JSON only:
{"verdict":"HUMAN","reason":"short reason"}

Allowed verdict values: HUMAN, NON_HUMAN, INCONCLUSIVE.`;
}

function parseVote(text: string): { verdict: ConsensusVote; reason: string } {
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  const jsonCandidate = cleaned.match(/\{[\s\S]*\}/)?.[0] ?? cleaned;
  try {
    const parsed = JSON.parse(jsonCandidate) as {
      verdict?: string;
      reason?: string;
    };
    const verdict =
      parsed.verdict === "HUMAN" ||
      parsed.verdict === "NON_HUMAN" ||
      parsed.verdict === "INCONCLUSIVE"
        ? parsed.verdict
        : "INCONCLUSIVE";
    return { verdict, reason: parsed.reason || "No reason returned." };
  } catch {
    return { verdict: "INCONCLUSIVE", reason: "Unparseable model response." };
  }
}

async function runPublisherModel(
  modelPath: string,
  prompt: string
): Promise<{ verdict: ConsensusVote; reason: string }> {
  const client = new v1beta1.PredictionServiceClient({
    keyFilename: SERVICE_ACCOUNT_PATH,
    apiEndpoint: `${VERTEX_LOCATION}-aiplatform.googleapis.com`,
  });

  const [resp] = await client.generateContent({
    model: modelPath,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 200 },
  });

  const text = resp?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  return parseVote(text);
}

async function runConsensusForChunk(chunk: KeystrokeChunk, beatsContext: string) {
  const projectId = getGcpProjectId();
  const geminiPath = `projects/${projectId}/locations/${VERTEX_LOCATION}/publishers/google/models/${GEMINI_MODEL_ID}`;
  const claudePath = `projects/${projectId}/locations/${VERTEX_LOCATION}/publishers/anthropic/models/${CLAUDE_MODEL_ID}`;
  const prompt = buildPrompt(chunk, beatsContext);

  const [gemini, claude] = await Promise.all([
    runPublisherModel(geminiPath, prompt),
    runPublisherModel(claudePath, prompt),
  ]);

  const agreement = gemini.verdict === claude.verdict;
  const bothHuman = agreement && gemini.verdict === "HUMAN";

  return {
    gemini,
    claude,
    agreement,
    decision: bothHuman ? "HUMAN_CONFIRMED" : "HITL_TIEBREAKER_REQUIRED",
    halScore: bothHuman ? 100 : 0,
  };
}

function keystrokesToPlainText(events: KeystrokeEvent[]): string {
  return events
    .map((e) => {
      if (e.key === "Enter") return "\n";
      if (e.key === "Tab") return "\t";
      if (e.key === "Space" || e.key === " ") return " ";
      if (e.key.length === 1) return e.key;
      return "";
    })
    .join("");
}

function aggregateVerdict(votes: ConsensusVote[]): ModelVerdict {
  if (votes.some((v) => v === "NON_HUMAN")) return "NON_HUMAN";
  if (votes.some((v) => v === "INCONCLUSIVE")) return "INCONCLUSIVE";
  return "HUMAN";
}

const LOM_MAX_ATTEMPTS = 3;

function lomTestHarnessEnabled(): boolean {
  const v = process.env.MSGF_ENABLE_LOM_TEST;
  return v === "1" || v?.toLowerCase() === "true";
}

/**
 * One LOM arbitration tick on shadow-RED context. When `forceMock` is true
 * (test header + harness env), models are treated as persistently disagreeing.
 */
async function runSingleLomShadowAttempt(opts: {
  forceMock: boolean;
}): Promise<{ agreed: boolean }> {
  if (opts.forceMock) {
    return { agreed: false };
  }
  return { agreed: false };
}

function buildSyntheticRedPreflight(
  pulseText: string
): ShadowPreflightResult {
  return {
    tier: "RED",
    blocked: true,
    reason: "TEST: forced RED-tier shadow mismatch for LOM harness.",
    vaultMatch: null,
    hallMatch: {
      id: randomUUID(),
      content: pulseText.slice(0, 400) || "synthetic",
      metadata: {
        label: "hall.test_forced",
        ledger: "hall",
        pillar: "P6",
        instance: "1.1.1",
      },
    },
  };
}

async function persistDeltaToVault(params: {
  supabase: ReturnType<typeof createSupabaseServerClient>;
  authorId: string;
  summaryBeat: string;
  deltaAbstraction: string;
  halScore: number;
  legalVersion: string;
}) {
  const { supabase, authorId, summaryBeat, deltaAbstraction, halScore, legalVersion } =
    params;
  // PERSIST to cold layer (Vault) and keep hot-layer metadata compact.
  const { error } = await supabase.from("pillar_vectors").insert({
    content: deltaAbstraction,
    metadata: {
      pillar: "P6",
      ledger: "vault",
      index_type: "genealogical_bug_index",
      category: "P4",
      branch: "pulse_consensus",
      instance: "1.1.1",
      author_id: authorId,
      legal_version: legalVersion,
      hal_score: halScore,
      summary: summaryBeat,
      persisted_at: new Date().toISOString(),
    },
  });
  if (error) throw error;
}

async function buildDeltaAbstraction(params: {
  pulseText: string;
  consensus: Array<{ gemini: { verdict: ConsensusVote }; claude: { verdict: ConsensusVote } }>;
  halScore: number;
}): Promise<string> {
  const { pulseText, consensus, halScore } = params;
  const model = getVertexGenerativeModel();
  const prompt = `Summarize the following writing change into a privacy-safe engineering delta.

Requirements:
- Do not include names, IDs, or quoted user text.
- Output <= 3 bullets in plain text.
- Focus on logic intent and structural change only.

HAL score: ${halScore}
Consensus snapshot: ${consensus
    .map((c, i) => `chunk${i + 1}: gemini=${c.gemini.verdict}, claude=${c.claude.verdict}`)
    .join("; ")}

Source text (for abstraction only):
${pulseText.slice(0, 1800)}
`;

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 220 },
  });

  const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) {
    return `Privacy-safe delta abstraction: intent captured with HAL=${halScore} and consensus-derived structural update.`;
  }
  return text;
}

function pulseJson(req: NextRequest, data: unknown, init?: ResponseInit) {
  const res = NextResponse.json(data, init);
  return applyPulseCorsHeaders(req, res);
}

export async function OPTIONS(req: NextRequest) {
  return pulseCorsPreflightResponse(req);
}

export async function POST(req: NextRequest) {
  try {
    // Mirrors msgf-init gate behavior before doing any AI work.
    assertServiceAccountPresent();

    const cookieStore = await cookies();
    const supabase = createSupabaseServerClient(cookieStore);

    // 1) Session gate: verify user session
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return pulseJson(req, { error: "Unauthorized" }, { status: 401 });
    }

    const authorId = user.id;

    // 2) Parse body
    const body = (await req.json()) as PulseRequestBody;
    const rawKeystrokes = body?.keystrokes ?? [];

    if (!Array.isArray(rawKeystrokes) || rawKeystrokes.length === 0) {
      return pulseJson(req,
        { error: "No keystroke data provided." },
        { status: 400 }
      );
    }

    // 3) Security gate: ensure the user already has a state_beats row for the latest legal pledge.
    const { data: signedBeat, error: signedBeatError } = await supabase
      .from("state_beats")
      .select("id, legal_version")
      .eq("author_id", authorId)
      .eq("legal_version", CURRENT_LEGAL_VERSION)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (signedBeatError) {
      console.error("MSGF Pulse: pledge lookup failed", signedBeatError);
      return pulseJson(req,
        { error: "Unable to verify pledge status." },
        { status: 500 }
      );
    }

    const signedVersion = signedBeat?.legal_version as string | null;
    if (signedVersion !== CURRENT_LEGAL_VERSION) {
      return pulseJson(req,
        {
          error: "Please sign the No-AI-Training Pledge to continue.",
        },
        { status: 403 }
      );
    }
    const legalVersion = signedVersion;

    // 3b) Adaptive baseline gate
    let biometricProfile = await getBiometricProfile(supabase, authorId);
    if (!biometricProfile) {
      biometricProfile = await recalibrateUser(supabase, authorId);
      return pulseJson(req,
        {
          ok: false,
          baseline_required: true,
          message: "Baseline Pulse required.",
          prompt: "Type 2-3 sentences about your favorite book",
          baseline_training_remaining:
            biometricProfile.baseline_training_remaining,
        },
        { status: 202 }
      );
    }

    // 4) Anonymization: ensure no raw student names are sent to P4 verification.
    const keystrokes: KeystrokeEvent[] = rawKeystrokes.map((k) => {
      const safeTarget =
        k.target && /name|student/i.test(k.target) ? "redacted" : k.target;

      // For safety, truncate any long key strings that could be pasted PII.
      const safeKey =
        typeof k.key === "string" && k.key.length > 64
          ? k.key.slice(0, 61) + "..."
          : k.key;

      return {
        ts: k.ts,
        key: safeKey,
        type: k.type,
        target: safeTarget,
      };
    });
    const pulseText = keystrokesToPlainText(keystrokes);

    const forceMismatch =
      req.headers.get("x-msgf-test-force-mismatch")?.toLowerCase() === "true";
    const harness = lomTestHarnessEnabled();

    // DEFEND protocol LOM Gate:
    // Block immediately if Shadow Mode detects RED-tier Hall lineage match.
    let preflight = await preFlightCheck(supabase, {
      text: pulseText,
      keystrokes,
      contextTag: "pulse_converge_gate",
    });

    if (forceMismatch && harness) {
      preflight = buildSyntheticRedPreflight(pulseText);
    }

    if (preflight.tier === "RED" && preflight.blocked) {
      if (forceMismatch && harness) {
        let attempts = 0;
        let agreed = false;
        while (attempts < LOM_MAX_ATTEMPTS && !agreed) {
          attempts += 1;
          const tick = await runSingleLomShadowAttempt({ forceMock: true });
          agreed = tick.agreed;
        }

        const p6 = pillarGateMeta("P6");
        try {
          const admin = createAdminClient();
          const { error: ledgerErr } = await admin.from("p4_state_ledger").insert({
            author_id: authorId,
            gate: "LOM_SHADOW_RED",
            consensus_status: "rejected",
            state_blob: {
              lineage_label: p6.lineageLabel,
              pillar: p6.pillar,
              lom_attempts: attempts,
              preflight_reason: preflight.reason,
              violation_code: p6.violationCode,
              test_force_mismatch: true,
            },
          });
          if (ledgerErr) {
            console.error("MSGF Pulse: p4_state_ledger insert failed", ledgerErr);
            return pulseJson(req,
              { error: "Ledger write failed.", details: ledgerErr.message },
              { status: 500 }
            );
          }
        } catch (adminErr: unknown) {
          console.error("MSGF Pulse: admin client / ledger error", adminErr);
          return pulseJson(req,
            { error: "Ledger configuration error." },
            { status: 500 }
          );
        }

        return pulseJson(req,
          {
            err: "ERR_RECURSION_LIMIT",
            error:
              "DEFEND LOM recursion guard: triple disagreement on shadow RED.",
            lom_attempts: attempts,
            lineage: { label: p6.lineageLabel },
          },
          { status: 403 }
        );
      }

      const hallLabel =
        typeof preflight.hallMatch?.metadata?.label === "string"
          ? preflight.hallMatch.metadata.label
          : "hall.unknown";
      return pulseJson(req,
        {
          error: "Forbidden by DEFEND LOM Gate.",
          reason: preflight.reason,
          lineage: {
            label: hallLabel,
          },
        },
        { status: 403 }
      );
    }

    const p4 = new StateLedgerP4(supabase);
    // Hot Layer first: check Redis Active Slice before hitting Cold Layer.
    const activeSlice = await getActiveSlice(authorId);
    let previousBeats = activeSlice?.previousBeats ?? [];
    let previousRetryCount = activeSlice?.previousRetryCount ?? 0;
    let beatsContext = activeSlice?.beatsContext ?? "(no prior beats)";

    if (!activeSlice) {
      previousBeats = await p4.fetchPreviousBeats(authorId, 32);
      const latestBeat = previousBeats[previousBeats.length - 1];
      previousRetryCount =
        typeof latestBeat?.metadata?.retry_count === "number"
          ? (latestBeat.metadata.retry_count as number)
          : 0;
      beatsContext = previousBeats.length
        ? previousBeats
            .map((b) => `[${b.sequence_index}] ${b.beat_text}`)
            .join("\n")
        : "(no prior beats)";
      await setActiveSlice({
        authorId,
        previousBeats,
        previousRetryCount,
      });
    }

    // 5) Existing P4 Gemini check (anonymized input only)
    const { chunks, results } = await p4.verifyKeystrokeStream(
      authorId,
      keystrokes
    );

    // 6) Consensus check per chunk: Gemini 2.5 Flash + Claude 4.6 Sonnet via Vertex
    const chunkForConsensus = chunkKeystrokeStream(keystrokes);
    const consensus = await Promise.all(
      chunkForConsensus.map((c) => runConsensusForChunk(c, beatsContext))
    );

    const allHumanConfirmed = consensus.every(
      (c) => c.decision === "HUMAN_CONFIRMED"
    );

    // 7) Adaptive HAL scoring (biometric + linguistic + integrity)
    const geminiVerdict = aggregateVerdict(consensus.map((c) => c.gemini.verdict));
    const claudeVerdict = aggregateVerdict(consensus.map((c) => c.claude.verdict));
    const hal = calculateHalScore({
      biometric: {
        userId: authorId,
        keystrokes,
        textSample: pulseText,
        profile: biometricProfile,
      },
      // Zero-Level Security: linguistic check gets text + beat text only (no user id).
      linguistic: {
        currentText: pulseText,
        historicalBeats: previousBeats.map((b) => ({
          beat_text: b.beat_text,
          sequence_index: b.sequence_index,
        })),
        geminiVerdict,
        claudeVerdict,
      },
      integrity: {
        currentText: pulseText,
        geminiReason: consensus.map((c) => c.gemini.reason).join(" | "),
        claudeReason: consensus.map((c) => c.claude.reason).join(" | "),
      },
    });

    const halScore = hal.halScore;
    const recalibrationActive = hal.flags.baselineTrainingActive;
    const modelsDisagree = geminiVerdict !== claudeVerdict;
    const lowHalAndDisagree = halScore < 70 && modelsDisagree;
    const retryCount = lowHalAndDisagree
      ? previousRetryCount + 1
      : previousRetryCount;
    const tieBreakerProtocolTriggered = retryCount > 3;
    const requiresTieBreaker =
      !allHumanConfirmed ||
      halScore < 70 ||
      (halScore < 70 && recalibrationActive) ||
      tieBreakerProtocolTriggered;

    // If recalibration is active and HAL is low, require HITL but do not block.
    const blockUser = false;
    const humanTieBreakerResolved = body?.humanTieBreakerResolved === true;

    const updatedProfile = await upsertBiometricProfileFromPulse({
      supabase,
      userId: authorId,
      keystrokes,
    });

    // 8) Persist beat with compact hot-layer metadata
    const summaryBeat = `Pulse ${allHumanConfirmed ? "HUMAN" : "FLAGGED"}; chunks=${chunks.length}; hal=${halScore}`;

    const storedBeat = await p4.appendBeat(authorId, summaryBeat, {
      legalVersion,
      label: requiresTieBreaker ? "pulse_tiebreaker_required" : "pulse_human",
      metadata: {
        chunkCount: chunks.length,
        // Keep only lightweight state in hot layer.
        consensus_summary: {
          gemini: geminiVerdict,
          claude: claudeVerdict,
          all_human_confirmed: allHumanConfirmed,
          models_disagree: modelsDisagree,
        },
        hal_subscores: hal.subScores,
        hal_weights: hal.weights,
        hal_flags: hal.flags,
        hal_score: halScore,
        retry_count: retryCount,
        tie_breaker_protocol_triggered: tieBreakerProtocolTriggered,
        human_tiebreaker_required: requiresTieBreaker,
        human_tiebreaker_resolved: humanTieBreakerResolved,
        block_user: blockUser,
        ewma_rhythm: updatedProfile.rhythm_hash,
        ewma_speed: updatedProfile.ewma_speed,
        recalibration_active: recalibrationActive,
      },
    });

    // 9) PERSIST successful consensus/tie-break to Vault, drop redundant state from hot layer.
    const persistableDelta =
      body?.approvedDelta?.trim() ||
      (await buildDeltaAbstraction({
        pulseText,
        consensus,
        halScore,
      }));
    const canPersist = !requiresTieBreaker || humanTieBreakerResolved;
    if (canPersist) {
      await persistDeltaToVault({
        supabase,
        authorId,
        summaryBeat,
        deltaAbstraction: persistableDelta,
        halScore,
        legalVersion,
      });
    }

    // Refresh hot Active Slice with latest state and short TTL to keep layer lean.
    const refreshedBeats = [...previousBeats, storedBeat].slice(-32);
    await setActiveSlice({
      authorId,
      previousBeats: refreshedBeats,
      previousRetryCount: retryCount,
    });

    return pulseJson(req, {
      ok: true,
      beat: storedBeat,
      chunks,
      results,
      hal_score: halScore,
      retry_count: retryCount,
      tie_breaker_protocol_triggered: tieBreakerProtocolTriggered,
      human_tiebreaker_required: requiresTieBreaker,
      human_tiebreaker_resolved: humanTieBreakerResolved,
      block_user: blockUser,
      active_slice_ttl_seconds: HOT_LAYER_ACTIVE_SLICE_TTL_SECONDS,
      hot_layer_hit: Boolean(activeSlice),
    });
  } catch (err: any) {
    console.error("MSGF Pulse route error", err);
    return pulseJson(req,
      { error: "Unexpected MSGF Pulse error." },
      { status: 500 }
    );
  }
}

