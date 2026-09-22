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
 * Distribution Build ID: MSGF-191e80fa-20260921T055901Z-internal
 */
export const DEFAULT_SENTRY_VAULT_MATCH_THRESHOLD = 0.75;

export type SentryStackFrame = {
  filename?: string | null;
  abs_path?: string | null;
  function?: string | null;
  module?: string | null;
  context_line?: string | null;
};

export type SentryCrashSignal = {
  issueId: string;
  title: string;
  culprit?: string | null;
  projectSlug?: string | null;
  release?: string | null;
  companyId?: string | null;
  projectOrigin?: string | null;
  frames: SentryStackFrame[];
};

export type VaultMatchCandidate = {
  id: string;
  content?: string | null;
  metadata?: Record<string, unknown> | null;
  quarantine_status?: string | null;
};

export type SentryVaultMatchResult = {
  vectorId: string;
  confidence: number;
  reasons: string[];
};

/** Normalize path-ish tokens for lexical overlap. */
export function tokenizeCrashText(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/\\/g, "/")
    .split(/[^a-z0-9_./-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3);
}

export function extractPathTokens(frames: SentryStackFrame[]): string[] {
  const out: string[] = [];
  for (const f of frames) {
    for (const raw of [f.filename, f.abs_path, f.module, f.function, f.context_line]) {
      if (!raw) continue;
      out.push(...tokenizeCrashText(String(raw)));
      const base = String(raw).replace(/\\/g, "/").split("/").pop();
      if (base && base.length >= 3) out.push(base.toLowerCase());
    }
  }
  return [...new Set(out)];
}

export function buildCrashQueryTokens(signal: SentryCrashSignal): string[] {
  const parts = [
    signal.title,
    signal.culprit ?? "",
    signal.projectSlug ?? "",
    signal.projectOrigin ?? "",
    signal.release ?? "",
    ...extractPathTokens(signal.frames),
  ];
  return [...new Set(parts.flatMap((p) => tokenizeCrashText(p)))];
}

/**
 * Confidence prefers path/filename overlap (crash localization), with title tokens as a soft boost.
 * Returns 0..1.
 */
export function scoreVaultCandidate(
  crashTokens: string[],
  candidate: VaultMatchCandidate,
  pathTokens: string[] = []
): SentryVaultMatchResult {
  const md = candidate.metadata ?? {};
  const hay = [
    candidate.content ?? "",
    String(md.file_path ?? ""),
    String(md.path ?? ""),
    String(md.source_path ?? ""),
    String(md.project_origin ?? ""),
    String(md.fix_delta ?? ""),
    JSON.stringify(md),
  ]
    .join("\n")
    .toLowerCase()
    .replace(/\\/g, "/");

  const reasons: string[] = [];
  const countHits = (tokens: string[]): number => {
    let hits = 0;
    for (const token of tokens) {
      if (token.length < 3) continue;
      if (hay.includes(token)) {
        hits += 1;
        if (reasons.length < 8) reasons.push(`hit:${token}`);
      }
    }
    return hits;
  };

  const paths = pathTokens.length ? pathTokens : crashTokens.filter((t) => t.includes(".") || t.includes("/"));
  const pathHits = countHits(paths);
  const softHits = countHits(crashTokens);

  let confidence = 0;
  if (paths.length > 0) {
    const pathScore = pathHits / paths.length;
    const softScore = crashTokens.length ? softHits / crashTokens.length : 0;
    confidence = Math.min(1, pathScore * 0.85 + softScore * 0.15);
    // Strong signal: any exact basename match with content/path agreement
    if (pathHits >= 2 && pathScore >= 0.4) {
      confidence = Math.max(confidence, Math.min(1, 0.7 + pathScore * 0.3));
    }
  } else if (crashTokens.length > 0) {
    confidence = softHits / crashTokens.length;
  }

  return { vectorId: candidate.id, confidence, reasons: reasons.length ? reasons : ["no_hits"] };
}

export function pickBestVaultMatch(
  signal: SentryCrashSignal,
  candidates: VaultMatchCandidate[],
  threshold: number = DEFAULT_SENTRY_VAULT_MATCH_THRESHOLD
): SentryVaultMatchResult | null {
  const tokens = buildCrashQueryTokens(signal);
  const pathTokens = extractPathTokens(signal.frames);
  let best: SentryVaultMatchResult | null = null;
  for (const c of candidates) {
    const status = (c.quarantine_status ?? "NONE").trim();
    if (status === "QUARANTINED" || status === "DEMOTED_HALL") continue;
    const scored = scoreVaultCandidate(tokens, c, pathTokens);
    if (!best || scored.confidence > best.confidence) best = scored;
  }
  if (!best || best.confidence < threshold) return null;
  return best;
}

export function resolveMatchThreshold(
  env: NodeJS.ProcessEnv = process.env,
  companyOverride?: number | null
): number {
  if (typeof companyOverride === "number" && Number.isFinite(companyOverride)) {
    return Math.min(1, Math.max(0, companyOverride));
  }
  const raw = env.SENTRY_VAULT_MATCH_THRESHOLD?.trim();
  if (raw) {
    const n = Number.parseFloat(raw);
    if (Number.isFinite(n)) return Math.min(1, Math.max(0, n));
  }
  return DEFAULT_SENTRY_VAULT_MATCH_THRESHOLD;
}
