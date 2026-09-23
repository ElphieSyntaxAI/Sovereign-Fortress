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
 * Company team invites, roster, bootstrap, integration status.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { PlatformRole } from "@/lib/platform-rbac";
import { isPostMvpFeatureEnabled } from "@/lib/post-mvp-gates";
import { listActiveIdeTokens } from "@/lib/services/ide-token-service";
import {
  createSigningEnvelopeForInvite,
} from "@/lib/services/signing/createSigningEnvelopeForInvite";
import { getSigningProviderForCompany } from "@/lib/services/signing/index";
import {
  appendVaultLog,
  createInviteBundle,
  grantDocumentsToUser,
  type OnboardingBundleInput,
} from "@/lib/services/tenant-onboarding-vault";
import { listUserProjects, type UserProjectRow } from "@/lib/services/user-projects";

export const TeamPlatformRoleSchema = z.enum(["admin", "security", "auditor", "dev"]);

export const OnboardingBundleSchema = z
  .object({
    include_pillar_guide: z.boolean().default(false),
    include_architecture_template: z.boolean().default(false),
    enforce_docusign: z.boolean().default(false),
    custom_document_ids: z.array(z.string().uuid()).default([]),
  })
  .strict();

export const CreateTeamInviteSchema = z
  .object({
    email: z.string().email().max(320),
    team_platform_role: TeamPlatformRoleSchema,
    project_origins: z.array(z.string().min(1).max(256)).min(1),
    onboarding: OnboardingBundleSchema.optional(),
  })
  .strict();

export type TeamRosterRow = {
  user_id: string;
  email: string;
  team_platform_role: PlatformRole | null;
  project_origins: string[];
  project_labels: string[];
  integration_status: "connected" | "partial" | "pending";
  compliance_status: "active" | "pending_signatures" | "n/a";
  onboarding_doc_count: number;
};

export async function resolveOrCreateCompanyForAdmin(
  admin: SupabaseClient,
  userId: string,
  existingCompanyId: string | null,
  isIndependent: boolean
): Promise<string> {
  if (existingCompanyId) return existingCompanyId;

  const slug = isIndependent ? `personal-${userId}` : `org-${userId.slice(0, 8)}`;
  const { data: existing } = await admin
    .from("msgf_companies")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (existing?.id) {
    await admin
      .from("p4_profiles")
      .update({ company_id: existing.id })
      .eq("user_id", userId);
    return String(existing.id);
  }

  const displayName = isIndependent ? "Personal sandbox org" : "Company workspace";
  const { data: created, error } = await admin
    .from("msgf_companies")
    .insert({
      display_name: displayName,
      slug,
      owner_user_id: userId,
    })
    .select("id")
    .single();

  if (error) throw new Error(`resolveOrCreateCompany: ${error.message}`);

  await admin
    .from("p4_profiles")
    .update({ company_id: created.id })
    .eq("user_id", userId);

  return String(created.id);
}

export async function listInviteProjectOptions(
  admin: SupabaseClient,
  userId: string,
  companyId: string,
  isIndependent: boolean
): Promise<Array<{ project_origin: string; display_name: string }>> {
  if (!isIndependent) {
    const { data } = await admin
      .from("msgf_company_projects")
      .select("project_origin, display_name")
      .eq("company_id", companyId)
      .order("display_name");
    if (data?.length) return data as Array<{ project_origin: string; display_name: string }>;
  }

  const projects = await listUserProjects(admin, userId);
  return projects.map((p) => ({
    project_origin: p.project_origin,
    display_name: p.display_name,
  }));
}

export function resolveIntegrationStatus(
  assignedOrigins: string[],
  tokens: Awaited<ReturnType<typeof listActiveIdeTokens>>
): "connected" | "partial" | "pending" {
  if (!assignedOrigins.length) return "pending";
  const activeOrigins = new Set(
    tokens.map((t) => {
      const parts = String(t.tenant_id ?? "").split(":");
      return parts[parts.length - 1] ?? "";
    })
  );
  const matched = assignedOrigins.filter((o) => activeOrigins.has(o));
  if (matched.length === assignedOrigins.length) return "connected";
  if (matched.length > 0) return "partial";
  return "pending";
}

export async function listTeamRoster(
  admin: SupabaseClient,
  companyId: string
): Promise<TeamRosterRow[]> {
  const { data: profiles, error } = await admin
    .from("p4_profiles")
    .select("user_id, team_platform_role, account_status, username")
    .eq("company_id", companyId);

  if (error) throw new Error(`listTeamRoster: ${error.message}`);

  const rows: TeamRosterRow[] = [];

  for (const profile of profiles ?? []) {
    const userId = String(profile.user_id);

    const { data: authUser } = await admin.auth.admin.getUserById(userId);
    const email = authUser.user?.email ?? profile.username ?? userId;

    const { data: assignments } = await admin
      .from("msgf_user_project_assignments")
      .select("project_origin, display_name")
      .eq("user_id", userId)
      .eq("company_id", companyId);

    const projectOrigins = (assignments ?? []).map((a) => a.project_origin as string);
    const projectLabels = (assignments ?? []).map((a) => a.display_name as string);

    const tokens = await listActiveIdeTokens(admin, userId).catch(() => []);
    const integration_status = resolveIntegrationStatus(projectOrigins, tokens);

    const { count } = await admin
      .from("msgf_user_onboarding_grants")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    const accountStatus = profile.account_status as string;
    const role = profile.team_platform_role as PlatformRole | null;
    const compliance_status =
      accountStatus === "pending_signatures"
        ? "pending_signatures"
        : role
          ? "active"
          : "n/a";

    rows.push({
      user_id: userId,
      email,
      team_platform_role: role,
      project_origins: projectOrigins,
      project_labels: projectLabels,
      integration_status,
      compliance_status,
      onboarding_doc_count: count ?? 0,
    });
  }

  return rows;
}

export async function createTeamInvite(
  admin: SupabaseClient,
  params: {
    companyId: string;
    invitedBy: string;
    email: string;
    teamPlatformRole: PlatformRole;
    projectOrigins: string[];
    onboarding?: OnboardingBundleInput;
    redirectTo: string;
  }
): Promise<{ invite_id: string }> {
  const email = params.email.trim().toLowerCase();
  const incoming = params.onboarding;
  const bundle: OnboardingBundleInput = {
    include_pillar_guide: incoming?.include_pillar_guide ?? false,
    include_architecture_template: incoming?.include_architecture_template ?? false,
    enforce_docusign: false,
    custom_document_ids: incoming?.custom_document_ids ?? [],
  };

  const { data: invite, error: inviteErr } = await admin
    .from("msgf_team_invites")
    .insert({
      company_id: params.companyId,
      email,
      team_platform_role: params.teamPlatformRole,
      project_origins: params.projectOrigins,
      invited_by: params.invitedBy,
      status: "pending",
    })
    .select("id")
    .single();

  if (inviteErr) throw new Error(`createTeamInvite: ${inviteErr.message}`);

  await createInviteBundle(admin, String(invite.id), bundle);

  const { error: authErr } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: params.redirectTo,
    data: {
      company_id: params.companyId,
      team_platform_role: params.teamPlatformRole,
      assigned_project_origins: params.projectOrigins,
      invite_id: invite.id,
      enforce_docusign: bundle.enforce_docusign,
    },
  });

  if (authErr) throw new Error(`inviteUserByEmail: ${authErr.message}`);

  return { invite_id: String(invite.id) };
}

export async function applyTeamInviteBootstrap(
  admin: SupabaseClient,
  user: { id: string; email?: string; user_metadata?: Record<string, unknown> }
): Promise<{
  project_origins: string[];
  enforce_docusign: boolean;
  signing_url: string | null;
  onboarding_pack_count: number;
}> {
  const meta = user.user_metadata ?? {};
  const companyId = String(meta.company_id ?? "").trim();
  const teamRole = String(meta.team_platform_role ?? "dev").trim() as PlatformRole;
  const projectOrigins = Array.isArray(meta.assigned_project_origins)
    ? (meta.assigned_project_origins as string[])
    : [];
  const inviteId = String(meta.invite_id ?? "").trim();
  const enforceDocusign =
    isPostMvpFeatureEnabled("signing") && Boolean(meta.enforce_docusign);

  if (!companyId || !inviteId) {
    return {
      project_origins: [],
      enforce_docusign: false,
      signing_url: null,
      onboarding_pack_count: 0,
    };
  }

  const { data: invite } = await admin
    .from("msgf_team_invites")
    .select("id, invited_by, project_origins")
    .eq("id", inviteId)
    .maybeSingle();

  const origins =
    projectOrigins.length > 0
      ? projectOrigins
      : ((invite?.project_origins as string[] | undefined) ?? []);

  const accountStatus = enforceDocusign ? "pending_signatures" : "active";

  await admin.from("p4_profiles").upsert(
    {
      user_id: user.id,
      username: user.email?.split("@")[0] ?? "member",
      company_id: companyId,
      team_platform_role: teamRole,
      account_status: accountStatus,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  for (const origin of origins) {
    const displayName = origin.split("/").pop() ?? origin;
    await admin.from("msgf_user_project_assignments").upsert(
      {
        user_id: user.id,
        company_id: companyId,
        project_origin: origin,
        display_name: displayName,
      },
      { onConflict: "user_id,company_id,project_origin" }
    );

    const { data: companyProject } = await admin
      .from("msgf_company_projects")
      .select("display_name, local_path, github_url, source_type")
      .eq("company_id", companyId)
      .eq("project_origin", origin)
      .maybeSingle();

    const { data: adminProject } = await admin
      .from("msgf_user_projects")
      .select("*")
      .eq("user_id", invite?.invited_by ?? user.id)
      .eq("project_origin", origin)
      .maybeSingle();

    const template = (adminProject as UserProjectRow | null) ?? null;

    await admin.from("msgf_user_projects").upsert(
      {
        user_id: user.id,
        source_type: template?.source_type ?? "local",
        display_name: companyProject?.display_name ?? template?.display_name ?? displayName,
        local_path: companyProject?.local_path ?? template?.local_path ?? null,
        github_url: companyProject?.github_url ?? template?.github_url ?? null,
        repository_full_name: template?.repository_full_name ?? null,
        project_origin: origin,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,project_origin" }
    );
  }

  await admin
    .from("msgf_team_invites")
    .update({
      status: "accepted",
      accepted_at: new Date().toISOString(),
      accepted_user_id: user.id,
    })
    .eq("id", inviteId);

  const { data: bundle } = await admin
    .from("msgf_invite_onboarding_bundles")
    .select("*")
    .eq("invite_id", inviteId)
    .maybeSingle();

  let onboardingPackCount = 0;
  if (bundle) {
    const granted = await grantDocumentsToUser(admin, {
      userId: user.id,
      inviteId,
      companyId,
      invitedBy: String(invite?.invited_by ?? user.id),
      bundle: {
        include_pillar_guide: Boolean(bundle.include_pillar_guide),
        include_architecture_template: Boolean(bundle.include_architecture_template),
        enforce_docusign: Boolean(bundle.enforce_docusign),
        custom_document_ids: (bundle.custom_document_ids as string[]) ?? [],
      },
    });
    onboardingPackCount = granted.length;
  }

  let signingUrl: string | null = null;
  if (enforceDocusign) {
    const provider = await getSigningProviderForCompany(admin, companyId);
    const env = await createSigningEnvelopeForInvite(admin, {
      inviteId,
      companyId,
      userId: user.id,
      email: user.email ?? "",
      signerName: user.email?.split("@")[0] ?? "Team member",
    });
    if (env) {
      signingUrl = env.signing_url;
    } else if (!provider.isAvailable()) {
      await admin
        .from("p4_profiles")
        .update({ account_status: "active", updated_at: new Date().toISOString() })
        .eq("user_id", user.id);
      await admin
        .from("msgf_team_invites")
        .update({ onboarding_status: "APPROVED" })
        .eq("id", inviteId);
      await appendVaultLog(admin, companyId, "signing_skipped_unconfigured", {
        invite_id: inviteId,
        user_id: user.id,
        provider: provider.id,
        note: "Invite required signing but no provider credentials or MSGF_SIGNING_MOCK / MSGF_DOCUSIGN_MOCK is configured.",
      });
    }
  }

  return {
    project_origins: origins,
    enforce_docusign: enforceDocusign,
    signing_url: signingUrl,
    onboarding_pack_count: onboardingPackCount,
  };
}

export async function getComplianceStatus(
  admin: SupabaseClient,
  userId: string
): Promise<{
  account_status: string;
  signing_url: string | null;
  is_locked: boolean;
}> {
  const { data: profile } = await admin
    .from("p4_profiles")
    .select("account_status, team_platform_role")
    .eq("user_id", userId)
    .maybeSingle();

  const accountStatus = (profile?.account_status as string) ?? "active";
  const role = profile?.team_platform_role as PlatformRole | null;

  const { data: envelope } = await admin
    .from("msgf_docusign_envelopes")
    .select("signing_url, status")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const isLocked =
    isPostMvpFeatureEnabled("signing") &&
    accountStatus === "pending_signatures" &&
    (role === "dev" || role === "security");

  return {
    account_status: accountStatus,
    signing_url: (envelope?.signing_url as string | null) ?? null,
    is_locked: isLocked,
  };
}
