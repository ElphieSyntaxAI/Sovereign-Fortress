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
 * Distribution Build ID: MSGF-1826a636-20260922T234439Z-internal
 */
/**
 * Trusted permissive OSS allowlist for ARBITRATE bulk-triage.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/** Default SPDX-style ids — company/global tables can extend. */
export const DEFAULT_TRUSTED_PERMITSIVE_LICENSES = [
  "MIT",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "ISC",
  "0BSD",
  "Unlicense",
] as const;

export function normalizeLicenseId(raw: string | null | undefined): string {
  return (raw ?? "")
    .trim()
    .replace(/^spdx:/i, "")
    .replace(/\s+/g, "-")
    .toUpperCase()
    .replace(/APACHE-2(\.0)?/i, "APACHE-2.0")
    .replace(/^MIT$/i, "MIT");
}

export function licenseMatchesAllowlist(
  license: string | null | undefined,
  allowlist: readonly string[]
): boolean {
  const n = normalizeLicenseId(license);
  if (!n) return false;
  const set = new Set(allowlist.map((l) => normalizeLicenseId(l)));
  if (set.has(n)) return true;
  // soft aliases
  if (n.includes("MIT") && set.has("MIT")) return true;
  if (n.includes("APACHE") && set.has("APACHE-2.0")) return true;
  if (n.startsWith("BSD") && (set.has("BSD-2-CLAUSE") || set.has("BSD-3-CLAUSE"))) {
    return true;
  }
  return false;
}

export type TrustedOssEligibility = {
  eligible: boolean;
  reason: string;
  attribution_class: string | null;
  license: string | null;
};

export function evaluateTrustedOssEligibility(
  metadata: Record<string, unknown> | null | undefined,
  allowlist: readonly string[] = DEFAULT_TRUSTED_PERMITSIVE_LICENSES
): TrustedOssEligibility {
  const meta = metadata && typeof metadata === "object" ? metadata : {};
  const attribution =
    typeof meta.attribution_class === "string"
      ? meta.attribution_class
      : typeof meta.license_class === "string"
        ? meta.license_class
        : null;
  const license =
    typeof meta.license === "string"
      ? meta.license
      : typeof meta.spdx === "string"
        ? meta.spdx
        : typeof meta.source_license === "string"
          ? meta.source_license
          : null;

  if (attribution === "copyleft_risk" || attribution === "untrusted_external") {
    return {
      eligible: false,
      reason: `attribution_class=${attribution} requires single-item HITL`,
      attribution_class: attribution,
      license,
    };
  }

  if (attribution === "permissive_oss") {
    return {
      eligible: true,
      reason: "attribution_class=permissive_oss",
      attribution_class: attribution,
      license,
    };
  }

  if (license && licenseMatchesAllowlist(license, allowlist)) {
    return {
      eligible: true,
      reason: `license ${normalizeLicenseId(license)} on allowlist`,
      attribution_class: attribution,
      license,
    };
  }

  if (meta.trusted_oss_candidate === true) {
    return {
      eligible: true,
      reason: "trusted_oss_candidate metadata flag",
      attribution_class: attribution,
      license,
    };
  }

  return {
    eligible: false,
    reason: "no permissive_oss attribution or allowlisted license on incident metadata",
    attribution_class: attribution,
    license,
  };
}

/**
 * Build incident.metadata fields from P7 source hits / preflight escalate reason
 * so trusted-OSS bulk triage can evaluate eligibility.
 */
export function incidentAttributionMetadataFromHits(
  hits: ReadonlyArray<{
    attribution_class?: string | null;
    resource_key?: string | null;
    file_path?: string | null;
    label?: string | null;
  }>,
  escalateReason?: string | null
): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  const fromReason = escalateReason?.match(/attribution_class:([a-z0-9_]+)/i);
  if (fromReason?.[1]) {
    out.attribution_class = fromReason[1].toLowerCase();
  }

  const blocking = hits.find(
    (h) =>
      h.attribution_class === "copyleft_risk" ||
      h.attribution_class === "untrusted_external" ||
      h.attribution_class === "permissive_oss"
  );
  const pick =
    blocking ??
    hits.find((h) => h.attribution_class && h.attribution_class !== "unknown") ??
    hits[0];

  if (pick?.attribution_class) {
    out.attribution_class = pick.attribution_class;
  }
  if (pick?.resource_key) out.resource_key = pick.resource_key;
  if (pick?.file_path) out.file_path = pick.file_path;
  if (pick?.label) out.source_label = String(pick.label).slice(0, 200);

  if (out.attribution_class === "permissive_oss") {
    out.trusted_oss_candidate = true;
  }

  return out;
}

export async function loadTrustedLicenseAllowlist(
  admin: SupabaseClient,
  opts: { tenant_id?: string | null; company_id?: string | null }
): Promise<string[]> {
  const defaults = [...DEFAULT_TRUSTED_PERMITSIVE_LICENSES];
  try {
    let q = admin
      .from("msgf_trusted_license_allowlist")
      .select("licenses, scope, tenant_id, company_id")
      .eq("enabled", true)
      .limit(20);
    const { data, error } = await q;
    if (error || !data?.length) return defaults;

    const merged = new Set(defaults.map((d) => normalizeLicenseId(d)));
    for (const row of data) {
      const scope = typeof row.scope === "string" ? row.scope : "global";
      const tid = typeof row.tenant_id === "string" ? row.tenant_id : "";
      const cid = typeof row.company_id === "string" ? row.company_id : "";
      if (scope === "global") {
        /* always merge */
      } else if (scope === "tenant" && opts.tenant_id && tid === opts.tenant_id) {
        /* merge */
      } else if (scope === "company" && opts.company_id && cid === opts.company_id) {
        /* merge */
      } else {
        continue;
      }
      const licenses = Array.isArray(row.licenses) ? row.licenses : [];
      for (const lic of licenses) {
        if (typeof lic === "string" && lic.trim()) merged.add(normalizeLicenseId(lic));
      }
    }
    return [...merged];
  } catch {
    return defaults;
  }
}
