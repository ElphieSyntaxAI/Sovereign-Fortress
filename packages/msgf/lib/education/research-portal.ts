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
 * Distribution Build ID: MSGF-b4602b0-20260519T165710Z-internal
 */
/**
 * Syntax Education — Embedded Research Portal + Citation Hall Engine.
 * See pillars §2.6.1 (PILLAR 6 EXTENSION: RESEARCH MISMATCH ALERTS) and §3.2.
 *
 * Responsibilities:
 *  1. Track text blocks lifted from the iframe-sandboxed research portal.
 *  2. When a student pastes one of those snippets into the host document, check whether
 *     they clicked "Generate Citation Anchor" first.
 *     - Anchor present → Vault row at `3.1.1_ANCHORED_SOURCE_STRING` (positive index).
 *     - No anchor      → Hall row at `3.1.2_UNATTRIBUTED_SOURCE_STRING` (citation gap).
 *  3. Tag low-trust source domains for the teacher heat map (`3.1.3_UNTRUSTED_DOMAIN`).
 *
 * All persistence funnels through {@link persistToHall} / {@link persistToVault} so the
 * Citation Hall reuses the same `pillar_vectors` + `p4_narrative_logs` invariants as the
 * rest of P6.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import {
  LEARNING_BREAKDOWN_INDEX,
  breakdownIndexForCitation,
  breakdownIndexForUntrustedDomain,
} from "@/lib/education/learning-breakdown-index";
import { CURRENT_LEGAL_VERSION } from "@/lib/msgf-legal";
import {
  persistToHall,
  persistToVault,
  type ConstraintLedgerPersistResult,
} from "@/lib/services/constraint-ledger";

/**
 * Snippet captured from the research portal sidebar — held in memory (or short-TTL Redis)
 * by the add-on / extension and replayed when the student pastes into the host doc.
 */
export const ResearchSnippetSchema = z
  .object({
    /** Snippet identifier (uuid or hash). */
    snippetId: z.string().min(1).max(128),
    /** Source URL the student visited inside the iframe portal. */
    sourceUrl: z.string().url(),
    /** Verbatim text the student selected / copied from the source. */
    text: z.string().min(1).max(20000),
    /** Reading time (ms) accumulated on the source before this snippet was captured. */
    readingTimeMs: z.number().int().min(0).optional(),
    /** Timestamp of the capture (epoch ms). */
    capturedAt: z.number().int().min(0),
    /**
     * Whether the student clicked "Generate Citation Anchor" before lifting the snippet
     * into the host document. Drives Vault vs. Hall routing.
     */
    hasCitationAnchor: z.boolean(),
  })
  .strict();

export type ResearchSnippet = z.infer<typeof ResearchSnippetSchema>;

export const CitationCheckRequestSchema = z
  .object({
    assignmentId: z.string().uuid().optional(),
    sessionId: z.string().uuid().optional(),
    /** Host where the paste landed (Doc / Sheet / Slide / Word / Excel / PowerPoint / Sandbox). */
    writingSurface: z
      .enum([
        "sandbox",
        "google-docs",
        "google-sheets",
        "google-slides",
        "word-online",
        "excel-online",
        "powerpoint-online",
        "unknown",
      ])
      .optional(),
    ecosystemSource: z
      .enum(["SANDBOX_NATIVE", "GOOGLE_EDIT", "MS_OFFICE_EDIT"])
      .optional(),
    /** The text the student just pasted into the host document. */
    pastedText: z.string().min(1).max(20000),
    /**
     * Snippets the add-on knows the student lifted recently from the research portal.
     * Pass the full recent buffer — the engine will pick the best match.
     */
    recentSnippets: z.array(ResearchSnippetSchema).max(64),
  })
  .strict();

export type CitationCheckRequest = z.infer<typeof CitationCheckRequestSchema>;

/**
 * Default trusted scholarly source domains used when the tenant has no allow-list yet.
 * Real deployments override this via the admin governance dashboard (Phase 3).
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

export type CitationCheckClassification =
  | "ANCHORED"
  | "UNATTRIBUTED"
  | "UNTRUSTED_DOMAIN"
  | "NO_MATCH";

export type CitationCheckResult = {
  classification: CitationCheckClassification;
  matchedSnippetId?: string;
  matchScore?: number;
  sourceUrl?: string;
  sourceDomain?: string;
  trustedDomain: boolean;
  persisted: ConstraintLedgerPersistResult | null;
  bugIndex: string | null;
};

function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .trim();
}

/**
 * Lightweight Jaccard similarity over word shingles — good enough to catch a verbatim or
 * lightly edited paste without pulling in a heavy NLP dependency.
 */
function shingleJaccard(a: string, b: string, k = 5): number {
  const tokensA = normalizeText(a).split(" ").filter(Boolean);
  const tokensB = normalizeText(b).split(" ").filter(Boolean);
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

/** Threshold above which a paste is considered to match a recent research snippet. */
export const CITATION_MATCH_THRESHOLD = 0.45;

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
  for (let i = 0; i < parts.length - 1; i += 1) {
    const suffix = parts.slice(i).join(".");
    if (trustList.has(suffix)) return true;
  }
  return false;
}

function pickBestMatch(
  pastedText: string,
  snippets: ResearchSnippet[]
): { snippet: ResearchSnippet | null; score: number } {
  let bestSnippet: ResearchSnippet | null = null;
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

export type CitationCheckInput = {
  supabase: SupabaseClient;
  tenantId: string;
  entityId: string;
  request: CitationCheckRequest;
  /** Tenant-specific trusted domain allow-list; falls back to {@link DEFAULT_TRUSTED_DOMAINS}. */
  trustedDomains?: ReadonlySet<string>;
};

/**
 * Citation Hall Engine — classify a paste against recent research-portal snippets and
 * persist the appropriate Vault / Hall row. Idempotent vs. duplicate pastes only if the
 * caller dedupes upstream; the ledger writes once per call.
 */
export async function evaluateCitationGap(
  input: CitationCheckInput
): Promise<CitationCheckResult> {
  const parsed = CitationCheckRequestSchema.parse(input.request);
  const { snippet, score } = pickBestMatch(parsed.pastedText, parsed.recentSnippets);

  const ecosystemSource = parsed.ecosystemSource ?? "SANDBOX_NATIVE";
  const writingSurface = parsed.writingSurface ?? "unknown";

  if (!snippet || score < CITATION_MATCH_THRESHOLD) {
    return {
      classification: "NO_MATCH",
      trustedDomain: false,
      persisted: null,
      bugIndex: null,
    };
  }

  const sourceDomain = extractDomain(snippet.sourceUrl);
  const trustedDomain = isDomainTrusted(sourceDomain, input.trustedDomains);

  const narrativeExtra = {
    pillar_extension: "P6_2_6_1",
    ecosystem_source: ecosystemSource,
    writing_surface: writingSurface,
    research_snippet_id: snippet.snippetId,
    research_source_url: snippet.sourceUrl,
    research_source_domain: sourceDomain,
    research_reading_time_ms: snippet.readingTimeMs,
    match_score: Number(score.toFixed(3)),
    domain_trust: trustedDomain ? "trusted" : "low",
    assignment_id: parsed.assignmentId,
    session_id: parsed.sessionId,
  } as const;

  if (snippet.hasCitationAnchor) {
    const bugIndex = breakdownIndexForCitation(true);
    const persisted = await persistToVault({
      supabase: input.supabase,
      tenantId: input.tenantId,
      entityId: input.entityId,
      content: parsed.pastedText,
      bugIndex,
      summaryBeat: `Anchored citation pasted from ${sourceDomain ?? "research portal"}`,
      legalVersion: CURRENT_LEGAL_VERSION,
      halScore: 1,
      actionType: "EDU_CITATION_ANCHORED",
      narrativeExtra,
    });

    if (!trustedDomain) {
      await persistToHall({
        supabase: input.supabase,
        tenantId: input.tenantId,
        entityId: input.entityId,
        content: snippet.sourceUrl,
        bugIndex: breakdownIndexForUntrustedDomain(),
        reason: `Anchored citation from low-trust domain (${sourceDomain ?? "unknown"})`,
        tier: "YELLOW",
        severity: "Warning",
        actionType: "EDU_CITATION_UNTRUSTED_DOMAIN",
        narrativeExtra,
      });
    }

    return {
      classification: "ANCHORED",
      matchedSnippetId: snippet.snippetId,
      matchScore: score,
      sourceUrl: snippet.sourceUrl,
      sourceDomain: sourceDomain ?? undefined,
      trustedDomain,
      persisted,
      bugIndex: bugIndex.level_1_1_1_instance,
    };
  }

  const bugIndex = breakdownIndexForCitation(false);
  const persisted = await persistToHall({
    supabase: input.supabase,
    tenantId: input.tenantId,
    entityId: input.entityId,
    content: parsed.pastedText,
    bugIndex,
    reason: `Pasted research material without "Generate Citation Anchor" click (source: ${sourceDomain ?? "unknown"})`,
    tier: "YELLOW",
    severity: "Warning",
    actionType: "EDU_CITATION_UNATTRIBUTED",
    narrativeExtra,
  });

  return {
    classification: trustedDomain ? "UNATTRIBUTED" : "UNTRUSTED_DOMAIN",
    matchedSnippetId: snippet.snippetId,
    matchScore: score,
    sourceUrl: snippet.sourceUrl,
    sourceDomain: sourceDomain ?? undefined,
    trustedDomain,
    persisted,
    bugIndex: bugIndex.level_1_1_1_instance,
  };
}

export const RESEARCH_PORTAL_BREAKDOWNS = {
  anchored: LEARNING_BREAKDOWN_INDEX.researchAnchoredSource,
  unattributed: LEARNING_BREAKDOWN_INDEX.researchUnattributedSource,
  untrustedDomain: LEARNING_BREAKDOWN_INDEX.researchUntrustedDomain,
} as const;
