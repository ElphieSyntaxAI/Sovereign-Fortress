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
 * Admin legal governance — Utah / FERPA / COPPA / AI caps (Wave 5 surface).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { CURRENT_LEGAL_VERSION } from "@/lib/msgf-legal";
import { getUtahDisclosureCopy } from "@/lib/education/utah-disclosure";
import {
  trustedDomainsFromEnv,
} from "@/lib/education/trusted-domains";

export type EducationGovernanceSnapshot = {
  legalVersion: string;
  disclosurePolicyId: string;
  hb273: {
    autoGradeForbidden: true;
    iepMutationForbidden: true;
  };
  defaults: {
    maxAiAllowanceLevel: number;
    retentionDaysHint: number;
    ferpaMode: "strict";
    coppaMode: "parent_notice_required_under_13";
  };
  attestationCount30d: number;
  activeCatalogTitles: number;
  activeLessons: number;
  disclosureCopyPreview: ReturnType<typeof getUtahDisclosureCopy>;
  /** District Trusted Research Domain registry (Citation Hall / P6). */
  trustedResearchDomains: string[];
  trustedResearchDomainsSource: "env" | "platform_defaults";
};

export async function buildEducationGovernanceSnapshot(params: {
  admin: SupabaseClient;
  tenantId: string;
}): Promise<EducationGovernanceSnapshot> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [attest, catalog, lessons] = await Promise.all([
    params.admin
      .from("education_disclosure_attestations")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", params.tenantId)
      .gte("attested_at", since),
    params.admin
      .from("education_district_curriculum_catalog")
      .select("id", { count: "exact", head: true })
      .eq("district_tenant_id", params.tenantId)
      .eq("is_active", true),
    params.admin
      .from("education_lessons")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", params.tenantId),
  ]);

  const envDomains = process.env.EDUCATION_TRUSTED_DOMAINS?.trim();
  const trustSet = trustedDomainsFromEnv();
  const trustedResearchDomains = [...trustSet].sort();

  return {
    legalVersion: CURRENT_LEGAL_VERSION,
    disclosurePolicyId: "utah_sb149_hb273",
    hb273: {
      autoGradeForbidden: true,
      iepMutationForbidden: true,
    },
    defaults: {
      maxAiAllowanceLevel: 4,
      retentionDaysHint: 365,
      ferpaMode: "strict",
      coppaMode: "parent_notice_required_under_13",
    },
    attestationCount30d: attest.count ?? 0,
    activeCatalogTitles: catalog.count ?? 0,
    activeLessons: lessons.count ?? 0,
    disclosureCopyPreview: getUtahDisclosureCopy(),
    trustedResearchDomains,
    trustedResearchDomainsSource: envDomains ? "env" : "platform_defaults",
  };
}
