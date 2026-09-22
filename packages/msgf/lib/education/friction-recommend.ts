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
 * Distribution Build ID: MSGF-570add3d-20260922T212921Z-internal
 */
/**
 * Friction-gap → catalog recommendation (masterdoc §4.1) — pure annotate helpers.
 */
import type {
  CatalogRowWithRecommendation,
  DistrictCatalogRow,
  FrictionHotspot,
} from "@/lib/education/curriculum-catalog";

/**
 * Map a hotspot bug index slug → keywords likely to appear in catalog titles / subjects.
 * Tokenizes slugs like `1.1.1_INVERSE_SIGN_ERROR` → ["inverse", "sign", "error"].
 */
export function hotspotKeywords(hotspot: FrictionHotspot): string[] {
  const slug = `${hotspot.level_1_category} ${hotspot.level_1_1_branch} ${hotspot.level_1_1_1_instance}`;
  return slug
    .toLowerCase()
    .replace(/^\d+(\.\d+)*_?/g, "")
    .split(/[\s._]+/)
    .filter((t) => t.length >= 3);
}

export function keywordsFromBottleneckLabel(label: string): string[] {
  return label
    .toLowerCase()
    .split(/[\s/,_-]+/)
    .filter((t) => t.length >= 3)
    .filter((t) => !["the", "and", "for", "with", "from", "into"].includes(t));
}

function rowMatchesKeywords(row: DistrictCatalogRow, keywords: string[]): string[] {
  const haystack =
    `${row.title} ${row.publisher ?? ""} ${row.subject_domain} ${JSON.stringify(row.layout).slice(0, 4000)}`
      .toLowerCase();
  return keywords.filter((k) => haystack.includes(k));
}

export function annotateRowsWithRecommendations(
  rows: DistrictCatalogRow[],
  hotspots: FrictionHotspot[]
): CatalogRowWithRecommendation[] {
  return rows.map((row) => {
    const matchedHotspots: FrictionHotspot[] = [];
    const allMatchedKeywords = new Set<string>();
    for (const hotspot of hotspots) {
      const keywords = hotspotKeywords(hotspot);
      const matched = rowMatchesKeywords(row, keywords);
      if (matched.length > 0) {
        matchedHotspots.push(hotspot);
        matched.forEach((k) => allMatchedKeywords.add(k));
      }
    }
    return {
      ...row,
      recommendation: {
        isRecommended: matchedHotspots.length > 0,
        matchedHotspots,
        matchedKeywords: Array.from(allMatchedKeywords),
      },
    };
  });
}

/**
 * Map classroom board bottlenecks → synthetic friction hotspots for catalog recommend.
 */
export function bottlenecksToHotspots(
  bottlenecks: Array<{ label: string; count: number }>
): FrictionHotspot[] {
  const now = new Date().toISOString();
  return bottlenecks.map((b, i) => {
    const words = keywordsFromBottleneckLabel(b.label);
    const slug = words.length ? words.join("_").toUpperCase() : `BOTTLENECK_${i}`;
    return {
      level_1_category: "1.0_FRICTION",
      level_1_1_branch: "1.1_CLASSROOM_BOARD",
      level_1_1_1_instance: `1.1.1_${slug}`.slice(0, 96),
      incident_count: b.count,
      last_seen: now,
    };
  });
}

export type BoardCatalogRecommendation = {
  catalogId: string;
  title: string;
  subjectDomain: string;
  matchedKeywords: string[];
  reason: string;
};

/**
 * Rank catalog titles suggested from board bottlenecks (teacher Classroom Board).
 */
export function recommendCatalogForBoardFriction(input: {
  bottlenecks: Array<{ label: string; count: number }>;
  catalogRows: DistrictCatalogRow[];
  limit?: number;
}): BoardCatalogRecommendation[] {
  const hotspots = bottlenecksToHotspots(input.bottlenecks);
  const annotated = annotateRowsWithRecommendations(input.catalogRows, hotspots);
  return annotated
    .filter((r) => r.recommendation.isRecommended)
    .map((r) => ({
      catalogId: r.id,
      title: r.title,
      subjectDomain: r.subject_domain,
      matchedKeywords: r.recommendation.matchedKeywords,
      reason: `Matches classroom friction: ${r.recommendation.matchedKeywords
        .slice(0, 4)
        .join(", ")}`,
    }))
    .slice(0, input.limit ?? 5);
}
