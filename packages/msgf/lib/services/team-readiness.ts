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
import type { SupabaseClient } from "@supabase/supabase-js";

import { listCompanyDomains } from "@/lib/services/company-domains";
import { envSigningProviderDefault } from "@/lib/services/signing/resolveSigningProvider";
import type { SigningProviderId } from "@/lib/services/signing/SigningProvider";

export type TeamReadinessSnapshot = {
  company_id: string;
  company_name: string | null;
  domains_count: number;
  domains: string[];
  signing_provider: SigningProviderId;
  dropbox_archive_path: string | null;
  pending_signatures: number;
  approved_invites: number;
  mapped_projects: number;
  archive_backlog: number;
  checklist: Array<{
    id: string;
    label: string;
    done: boolean;
    hint?: string;
  }>;
};

export async function getTeamReadiness(
  admin: SupabaseClient,
  companyId: string
): Promise<TeamReadinessSnapshot> {
  const { data: company } = await admin
    .from("msgf_companies")
    .select("display_name, signing_provider, dropbox_archive_path")
    .eq("id", companyId)
    .maybeSingle();

  const domains = await listCompanyDomains(admin, companyId).catch(() => []);

  const signingProvider =
    ((company as { signing_provider?: string } | null)?.signing_provider?.trim().toLowerCase() ===
    "dropbox_sign"
      ? "dropbox_sign"
      : "docusign") as SigningProviderId;

  const { count: pendingSig } = await admin
    .from("msgf_team_invites")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("onboarding_status", "PENDING_SIGNATURE");

  const { count: approved } = await admin
    .from("msgf_team_invites")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("onboarding_status", "APPROVED");

  const { count: projects } = await admin
    .from("msgf_company_projects")
    .select("project_origin", { count: "exact", head: true })
    .eq("company_id", companyId);

  // Fallback: user project assignments for company
  let mappedProjects = projects ?? 0;
  if (!mappedProjects) {
    const { count: assigns } = await admin
      .from("msgf_user_project_assignments")
      .select("project_origin", { count: "exact", head: true })
      .eq("company_id", companyId);
    mappedProjects = assigns ?? 0;
  }

  const { count: backlog } = await admin
    .from("msgf_docusign_envelopes")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .in("archive_status", ["pending_local", "queued", "failed"]);

  const archivePath =
    (company as { dropbox_archive_path?: string | null } | null)?.dropbox_archive_path ?? null;

  const checklist = [
    {
      id: "domains",
      label: "Workspace domains allowlisted",
      done: domains.length > 0,
      hint: "POST /api/msgf/workspace/company-domains",
    },
    {
      id: "signing",
      label: `Signing provider set (${signingProvider})`,
      done: Boolean(signingProvider),
      hint: `Env default: ${envSigningProviderDefault()}`,
    },
    {
      id: "archive",
      label: "Dropbox archive path configured",
      done: Boolean(archivePath?.trim()),
      hint: "Optional — defaults to DROPBOX_ARCHIVE_ROOT",
    },
    {
      id: "projects",
      label: "Company projects mapped",
      done: mappedProjects > 0,
      hint: "Setup Projects + assign origins on invite",
    },
    {
      id: "signatures",
      label: "No pending signatures blocking IDE",
      done: (pendingSig ?? 0) === 0,
      hint: `${pendingSig ?? 0} pending`,
    },
  ];

  return {
    company_id: companyId,
    company_name: (company as { display_name?: string } | null)?.display_name ?? null,
    domains_count: domains.length,
    domains: domains.map((d) => d.domain),
    signing_provider: signingProvider,
    dropbox_archive_path: archivePath,
    pending_signatures: pendingSig ?? 0,
    approved_invites: approved ?? 0,
    mapped_projects: mappedProjects,
    archive_backlog: backlog ?? 0,
    checklist,
  };
}

export async function updateCompanySigningSettings(
  admin: SupabaseClient,
  companyId: string,
  patch: {
    signing_provider?: SigningProviderId;
    dropbox_archive_path?: string | null;
  }
): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.signing_provider === "docusign" || patch.signing_provider === "dropbox_sign") {
    update.signing_provider = patch.signing_provider;
  }
  if (patch.dropbox_archive_path !== undefined) {
    const v = patch.dropbox_archive_path?.trim() || null;
    update.dropbox_archive_path = v;
  }
  if (!Object.keys(update).length) return;

  const { error } = await admin.from("msgf_companies").update(update).eq("id", companyId);
  if (error) throw new Error(`updateCompanySigningSettings: ${error.message}`);
}
