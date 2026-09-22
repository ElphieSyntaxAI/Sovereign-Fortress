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
/**
 * Trusted research domain registry + citation paste matching (Citation Hall / P6).
 */

/** Minimal snippet shape — avoid circular import with research-portal. */
export type CitationSnippetLike = {
  snippetId: string;
  sourceUrl: string;
  text: string;
  hasCitationAnchor: boolean;
  readingTimeMs?: number;
  capturedAt?: number;
};

/**
 * Default trusted scholarly source domains used when the tenant has no allow-list yet.
 */
export const DEFAULT_TRUSTED_DOMAINS: ReadonlySet<string> = new Set([
  "edu",
  "gov",
  "nasa.gov",
  "nih.gov",
  "loc.gov",
  "si.edu",
  "jstor.org",
  "scholar.google.com",
  "doi.org",
  "arxiv.org",
  "nature.com",
  "science.org",
  "pubmed.ncbi.nlm.nih.gov",
  "britannica.com",
  "khanacademy.org",
]);

export const CITATION_MATCH_THRESHOLD = 0.45;

export function normalizeDomainList(domains: Iterable<string>): Set<string> {
  const out = new Set<string>();
  for (const d of domains) {
    const n = d
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "")
      .replace(/^\*\./, "");
    if (n) out.add(n);
  }
  return out;
}

/** Merge platform defaults with tenant extras (env / governance overrides). */
export function mergeTrustedDomains(
  tenantExtras?: Iterable<string> | null
): Set<string> {
  const merged = new Set(DEFAULT_TRUSTED_DOMAINS);
  if (tenantExtras) {
    for (const d of normalizeDomainList(tenantExtras)) merged.add(d);
  }
  return merged;
}

/** Load tenant extras from `EDUCATION_TRUSTED_DOMAINS` (comma-separated). */
export function trustedDomainsFromEnv(
  env: NodeJS.ProcessEnv = process.env
): Set<string> {
  const raw = env.EDUCATION_TRUSTED_DOMAINS?.trim();
  if (!raw) return mergeTrustedDomains();
  return mergeTrustedDomains(raw.split(/[,;\s]+/).filter(Boolean));
}

export function extractDomain(url: string): string | null {
  try {
    const u = new URL(url);
    return u.hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function isDomainTrusted(
  domain: string | null,
  trustList: ReadonlySet<string> = DEFAULT_TRUSTED_DOMAINS
): boolean {
  if (!domain) return false;
  if (trustList.has(domain)) return true;
  const parts = domain.split(".");
  // Include TLD-only entries like "edu" / "gov" from the platform trust list.
  for (let i = 0; i < parts.length; i += 1) {
    const suffix = parts.slice(i).join(".");
    if (trustList.has(suffix)) return true;
  }
  return false;
}

export function normalizeCitationText(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .trim();
}

export function shingleJaccard(a: string, b: string, k = 5): number {
  const tokensA = normalizeCitationText(a).split(" ").filter(Boolean);
  const tokensB = normalizeCitationText(b).split(" ").filter(Boolean);
  if (tokensA.length < k || tokensB.length < k) {
    const setA = new Set(tokensA);
    const setB = new Set(tokensB);
    if (setA.size === 0 || setB.size === 0) return 0;
    let intersect = 0;
    for (const t of setA) if (setB.has(t)) intersect += 1;
    return intersect / (setA.size + setB.size - intersect);
  }
  const shingles = (tokens: string[]): Set<string> => {
    const out = new Set<string>();
    for (let i = 0; i <= tokens.length - k; i += 1) {
      out.add(tokens.slice(i, i + k).join(" "));
    }
    return out;
  };
  const sa = shingles(tokensA);
  const sb = shingles(tokensB);
  if (sa.size === 0 || sb.size === 0) return 0;
  let intersect = 0;
  for (const s of sa) if (sb.has(s)) intersect += 1;
  return intersect / (sa.size + sb.size - intersect);
}

export function pickBestSnippetMatch(
  pastedText: string,
  snippets: CitationSnippetLike[]
): { snippet: CitationSnippetLike | null; score: number } {
  let bestSnippet: CitationSnippetLike | null = null;
  let bestScore = 0;
  for (const snippet of snippets) {
    const score = shingleJaccard(pastedText, snippet.text);
    if (score > bestScore) {
      bestSnippet = snippet;
      bestScore = score;
    }
  }
  return { snippet: bestSnippet, score: bestScore };
}

export type PureCitationClassification =
  | "ANCHORED"
  | "UNATTRIBUTED"
  | "UNTRUSTED_DOMAIN"
  | "NO_MATCH";

export type PureCitationResult = {
  classification: PureCitationClassification;
  matchedSnippetId?: string;
  matchScore?: number;
  sourceUrl?: string;
  sourceDomain?: string;
  trustedDomain: boolean;
  bugIndexInstance: string | null;
};

/**
 * Classify a paste against research snippets without DB I/O (unit-testable).
 */
export function classifyCitationPaste(input: {
  pastedText: string;
  recentSnippets: CitationSnippetLike[];
  trustedDomains?: ReadonlySet<string>;
  matchThreshold?: number;
}): PureCitationResult {
  const threshold = input.matchThreshold ?? CITATION_MATCH_THRESHOLD;
  const { snippet, score } = pickBestSnippetMatch(
    input.pastedText,
    input.recentSnippets
  );
  if (!snippet || score < threshold) {
    return { classification: "NO_MATCH", trustedDomain: false, bugIndexInstance: null };
  }

  const sourceDomain = extractDomain(snippet.sourceUrl);
  const trustedDomain = isDomainTrusted(
    sourceDomain,
    input.trustedDomains ?? DEFAULT_TRUSTED_DOMAINS
  );

  if (snippet.hasCitationAnchor) {
    return {
      classification: "ANCHORED",
      matchedSnippetId: snippet.snippetId,
      matchScore: score,
      sourceUrl: snippet.sourceUrl,
      sourceDomain: sourceDomain ?? undefined,
      trustedDomain,
      bugIndexInstance: "3.1.1_ANCHORED_SOURCE_STRING",
    };
  }

  return {
    classification: trustedDomain ? "UNATTRIBUTED" : "UNTRUSTED_DOMAIN",
    matchedSnippetId: snippet.snippetId,
    matchScore: score,
    sourceUrl: snippet.sourceUrl,
    sourceDomain: sourceDomain ?? undefined,
    trustedDomain,
    bugIndexInstance: trustedDomain
      ? "3.1.2_UNATTRIBUTED_SOURCE_STRING"
      : "3.1.3_UNTRUSTED_DOMAIN",
  };
}
