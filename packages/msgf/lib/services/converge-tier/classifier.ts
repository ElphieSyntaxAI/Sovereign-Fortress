/**
 * @msgf-license-header
 * Part B1 — pure heuristic code-delta classifier (<5ms, zero LLM).
 */
import type { ClassifierResult, CodeDeltaPayload, ConvergeTier } from "@/lib/services/converge-tier/types";

const HIGH_RISK_PATH =
  /(?:^|\/)(auth|security|middleware|engine|db|database|schema|payment|billing)(?:\/|$)|\.env|credentials|secret/i;
const LOW_RISK_PATH = /\.(md|css|scss|txt|json)$/i;
const TEST_PATH = /(?:^|\/)(tests?|__tests__|spec)(?:\/|$)/i;
const FORMAT_ONLY_HINT = /^[\s+\-]*$/;

/** Force tier from path globs (company rules applied upstream). */
export type ClassifierPathOverride = {
  pathGlob: string;
  forceTier: ConvergeTier;
};

function normalizePath(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\.\/+/, "").toLowerCase();
}

function scorePath(path: string): { score: number; reasons: string[] } {
  const p = normalizePath(path);
  const reasons: string[] = [];
  let score = 0.35;

  if (HIGH_RISK_PATH.test(p)) {
    score = Math.max(score, 0.92);
    reasons.push(`high_risk_path:${p}`);
  } else if (TEST_PATH.test(p)) {
    score = Math.min(score, 0.22);
    reasons.push(`test_path:${p}`);
  } else if (LOW_RISK_PATH.test(p)) {
    score = Math.min(score, 0.12);
    reasons.push(`low_risk_ext:${p}`);
  } else if (p.includes("/features/") || p.includes("/components/")) {
    score = Math.max(score, 0.48);
    reasons.push(`feature_path:${p}`);
  }

  return { score, reasons };
}

function diffLineWeight(payload: CodeDeltaPayload): number {
  const add = payload.linesAdded ?? 0;
  const mod = payload.linesModified ?? 0;
  const del = payload.linesDeleted ?? 0;
  const total = add + mod + del;
  if (total <= 3) return 0.05;
  if (total <= 20) return 0.12;
  if (total <= 80) return 0.22;
  return 0.45;
}

function mapScoreToTier(score: number): ConvergeTier {
  if (score < 0.3) return "TIER_1";
  if (score <= 0.7) return "TIER_2";
  return "TIER_3";
}

function matchGlob(path: string, glob: string): boolean {
  const g = normalizePath(glob).replace(/\*\*/g, "§§").replace(/\*/g, "[^/]*").replace(/§§/g, ".*");
  try {
    return new RegExp(`^${g}(?:/.*)?$`).test(normalizePath(path));
  } catch {
    return false;
  }
}

function applyPathOverrides(
  paths: string[],
  overrides: ClassifierPathOverride[] | undefined
): { tier: ConvergeTier | null; reason: string | null } {
  if (!overrides?.length) return { tier: null, reason: null };
  for (const path of paths) {
    for (const rule of overrides) {
      if (matchGlob(path, rule.pathGlob)) {
        return { tier: rule.forceTier, reason: `company_override:${rule.pathGlob}→${rule.forceTier}` };
      }
    }
  }
  return { tier: null, reason: null };
}

/**
 * Classify a code delta into TIER_1 | TIER_2 | TIER_3.
 * Target: &lt;5ms on typical payloads (no LLM, no I/O).
 */
export function classifyCodeDelta(
  payload: CodeDeltaPayload,
  opts?: { pathOverrides?: ClassifierPathOverride[] }
): ClassifierResult {
  const t0 = performance.now();
  const paths = (payload.paths ?? []).map(normalizePath).filter(Boolean);
  const reasons: string[] = [];

  const override = applyPathOverrides(paths, opts?.pathOverrides);
  if (override.tier) {
    return {
      tier: override.tier,
      riskScore: override.tier === "TIER_3" ? 0.95 : override.tier === "TIER_2" ? 0.5 : 0.15,
      reasons: override.reason ? [override.reason] : [],
      durationMs: performance.now() - t0,
    };
  }

  let maxScore = 0.1;
  for (const path of paths.length ? paths : ["unknown"]) {
    const { score, reasons: pr } = scorePath(path);
    maxScore = Math.max(maxScore, score);
    reasons.push(...pr);
  }

  maxScore = Math.min(1, maxScore + diffLineWeight(payload));

  const snippet = payload.diffSnippet?.trim() ?? "";
  if (snippet && FORMAT_ONLY_HINT.test(snippet.replace(/[^\s+\-]/g, ""))) {
    maxScore = Math.min(maxScore, 0.18);
    reasons.push("format_only_heuristic");
  }

  const tier = mapScoreToTier(maxScore);
  if (paths.some((p) => HIGH_RISK_PATH.test(p))) {
    reasons.push("path_force_t3");
    return {
      tier: "TIER_3",
      riskScore: Math.max(maxScore, 0.91),
      reasons,
      durationMs: performance.now() - t0,
    };
  }

  return {
    tier,
    riskScore: maxScore,
    reasons,
    durationMs: performance.now() - t0,
  };
}

/** Derive a minimal delta from Pulse IDE context when no git diff is present. */
export function deriveCodeDeltaFromPulseContext(params: {
  activeFilePath?: string | null;
  pulseText?: string;
  projectOrigin?: string | null;
  companyId?: string | null;
}): CodeDeltaPayload {
  const paths: string[] = [];
  if (params.activeFilePath?.trim()) {
    paths.push(params.activeFilePath.trim().replace(/\\/g, "/"));
  }
  const text = params.pulseText ?? "";
  const lines = text.split(/\n/).filter((l) => l.trim().length > 0);
  return {
    paths,
    linesAdded: Math.min(lines.length, 120),
    linesModified: 0,
    linesDeleted: 0,
    diffSnippet: text.slice(0, 2000),
    projectOrigin: params.projectOrigin ?? null,
    companyId: params.companyId ?? null,
  };
}
