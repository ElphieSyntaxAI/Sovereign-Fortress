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
 * Distribution Build ID: MSGF-b4dfaf97-20260922T171835Z-internal
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
import {
  CITATION_MATCH_THRESHOLD,
  DEFAULT_TRUSTED_DOMAINS,
  extractDomain,
  isDomainTrusted,
  pickBestSnippetMatch,
} from "@/lib/education/trusted-domains";

export {
  CITATION_MATCH_THRESHOLD,
  DEFAULT_TRUSTED_DOMAINS,
  extractDomain,
  isDomainTrusted,
} from "@/lib/education/trusted-domains";

/**
 * Snippet captured from the research portal sidebar — held in memory (or short-TTL Redis)
 * by the add-on / extension and replayed when the student pastes into the host doc.
 */
export const ResearchSnippetSchema = z
  .object({
    snippetId: z.string().min(1).max(128),
    sourceUrl: z.string().url(),
    text: z.string().min(1).max(20000),
    readingTimeMs: z.number().int().min(0).optional(),
    capturedAt: z.number().int().min(0),
    hasCitationAnchor: z.boolean(),
  })
  .strict();

export type ResearchSnippet = z.infer<typeof ResearchSnippetSchema>;

export const CitationCheckRequestSchema = z
  .object({
    assignmentId: z.string().uuid().optional(),
    sessionId: z.string().uuid().optional(),
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
    pastedText: z.string().min(1).max(20000),
    recentSnippets: z.array(ResearchSnippetSchema).max(64),
  })
  .strict();

export type CitationCheckRequest = z.infer<typeof CitationCheckRequestSchema>;

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
 * persist the appropriate Vault / Hall row.
 */
export async function evaluateCitationGap(
  input: CitationCheckInput
): Promise<CitationCheckResult> {
  const parsed = CitationCheckRequestSchema.parse(input.request);
  const { snippet, score } = pickBestSnippetMatch(
    parsed.pastedText,
    parsed.recentSnippets
  );

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
  const trustedDomain = isDomainTrusted(
    sourceDomain,
    input.trustedDomains ?? DEFAULT_TRUSTED_DOMAINS
  );

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
