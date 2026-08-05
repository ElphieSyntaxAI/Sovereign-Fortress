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
 * Distribution Build ID: MSGF-1b90a4ac-20260802T111608Z-internal
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { anonymizeEntityToken } from "@/lib/education/anonymize-entity-token";
import { summarizeParentAssignmentRows } from "@/lib/education/parent-digest-aggregate";
import {
  findReadingGateBeat,
  isReadingGateSatisfied,
  remainingFocusMs,
} from "@/lib/education/reading-gate-policy";
import {
  annotateRowsWithRecommendations,
  bottlenecksToHotspots,
  recommendCatalogForBoardFriction,
} from "@/lib/education/friction-recommend";
import type { DistrictCatalogRow, FrictionHotspot } from "@/lib/education/curriculum-catalog";
import {
  classifyCitationPaste,
  isDomainTrusted,
  mergeTrustedDomains,
  pickBestSnippetMatch,
} from "@/lib/education/trusted-domains";

describe("Parent digest aggregate (Resilience / Friction)", () => {
  it("builds resilience and friction scores without draft text", () => {
    const digest = summarizeParentAssignmentRows({
      entityToken: "tok_anon_stu_demo4th01",
      rows: [
        {
          current_state: "EDU_SUBMITTED_LOCK",
          hal_lite_metrics: {
            humanEffortConfidenceScore: 0.9,
            pasteInjectionWarnings: 0,
            activeWritingTimeSeconds: 400,
            pasteEventsCount: 0,
            keystrokeEventsCount: 200,
            documentDeltaChars: 800,
          },
        },
        {
          current_state: "EDU_MILESTONE_CHECKING",
          hal_lite_metrics: {
            humanEffortConfidenceScore: 0.55,
            pasteInjectionWarnings: 2,
            activeWritingTimeSeconds: 120,
            pasteEventsCount: 3,
            keystrokeEventsCount: 40,
            documentDeltaChars: 500,
          },
        },
      ],
    });
    assert.equal(digest.studentDisplayLabel, anonymizeEntityToken("tok_anon_stu_demo4th01"));
    assert.equal(digest.lessonsTouched, 2);
    assert.equal(digest.submittedCount, 1);
    assert.equal(digest.stuckCount, 1);
    assert.ok(digest.resilienceScore >= 0 && digest.resilienceScore <= 100);
    assert.ok(digest.frictionScore >= 0 && digest.frictionScore <= 100);
    assert.ok(digest.themeCategories.friction.some((t) => /structure|Paste/i.test(t)));
    assert.match(digest.legalNote, /H\.B\. 273/);
  });
});

describe("Reading gate policy", () => {
  it("satisfies when focus meets min block", () => {
    assert.equal(isReadingGateSatisfied(120_000, 120_000), true);
    assert.equal(isReadingGateSatisfied(119_999, 120_000), false);
    assert.equal(remainingFocusMs(30_000, 120_000), 90_000);
  });

  it("finds matching resource beat", () => {
    const hit = findReadingGateBeat(
      [
        {
          created_at: "2026-07-13T12:00:00.000Z",
          metadata: { resource_context_id: "rc-a", focus_block_ms: 130000 },
        },
      ],
      "rc-a"
    );
    assert.equal(hit.satisfied, true);
    assert.equal(hit.focusBlockMs, 130000);
    assert.equal(findReadingGateBeat([], "rc-b").satisfied, false);
  });
});

describe("Friction → catalog recommend", () => {
  const sampleRow = {
    id: "00000000-0000-4000-8000-0000000000c1",
    district_tenant_id: "syntax_education",
    title: "Paste Safety and Writing Craft Workbook",
    publisher: "Demo",
    isbn: null,
    subject_domain: "ela",
    grade_band: "4_6",
    source_type: "local_pdf",
    storage_object_path: "x",
    total_pages: 10,
    layout: [],
    is_active: true,
    approved_by: null,
    approved_at: null,
    created_at: "2026-07-13T00:00:00.000Z",
    updated_at: "2026-07-13T00:00:00.000Z",
  } as DistrictCatalogRow;

  it("annotates catalog rows from hotspots", () => {
    const hotspots: FrictionHotspot[] = [
      {
        level_1_category: "1.0_ELA",
        level_1_1_branch: "1.1_PASTE",
        level_1_1_1_instance: "1.1.1_PASTE_INJECTION",
        incident_count: 4,
        last_seen: "2026-07-13T00:00:00.000Z",
      },
    ];
    const annotated = annotateRowsWithRecommendations([sampleRow], hotspots);
    assert.equal(annotated[0]!.recommendation.isRecommended, true);
    assert.ok(annotated[0]!.recommendation.matchedKeywords.includes("paste"));
  });

  it("recommends from classroom bottlenecks", () => {
    const recs = recommendCatalogForBoardFriction({
      bottlenecks: [{ label: "Paste injection spike", count: 3 }],
      catalogRows: [sampleRow],
    });
    assert.ok(recs.length >= 1);
    assert.match(recs[0]!.reason, /friction/i);
    assert.ok(bottlenecksToHotspots([{ label: "Structural milestone incomplete", count: 2 }]).length);
  });
});

describe("Citation Hall + trusted domains", () => {
  const snippetText =
    "Algae use sunlight to make food in the pond ecosystem during daytime hours carefully.";

  it("trusts edu/gov suffixes and merges tenant extras", () => {
    assert.equal(isDomainTrusted("byu.edu"), true);
    assert.equal(isDomainTrusted("random-blog.example"), false);
    const merged = mergeTrustedDomains(["district-library.org"]);
    assert.equal(isDomainTrusted("district-library.org", merged), true);
  });

  it("classifies anchored, unattributed, and untrusted pastes", () => {
    const anchored = classifyCitationPaste({
      pastedText: snippetText,
      recentSnippets: [
        {
          snippetId: "s1",
          sourceUrl: "https://nasa.gov/algae",
          text: snippetText,
          capturedAt: Date.now(),
          hasCitationAnchor: true,
        },
      ],
    });
    assert.equal(anchored.classification, "ANCHORED");
    assert.equal(anchored.trustedDomain, true);

    const gap = classifyCitationPaste({
      pastedText: snippetText,
      recentSnippets: [
        {
          snippetId: "s2",
          sourceUrl: "https://khanacademy.org/science",
          text: snippetText,
          capturedAt: Date.now(),
          hasCitationAnchor: false,
        },
      ],
    });
    assert.equal(gap.classification, "UNATTRIBUTED");

    const untrusted = classifyCitationPaste({
      pastedText: snippetText,
      recentSnippets: [
        {
          snippetId: "s3",
          sourceUrl: "https://sketchy-notes.biz/essay",
          text: snippetText,
          capturedAt: Date.now(),
          hasCitationAnchor: false,
        },
      ],
    });
    assert.equal(untrusted.classification, "UNTRUSTED_DOMAIN");

    const none = pickBestSnippetMatch("totally unrelated words", []);
    assert.equal(none.snippet, null);
  });
});
