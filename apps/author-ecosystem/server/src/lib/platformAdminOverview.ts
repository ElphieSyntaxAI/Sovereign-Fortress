import type { SupabaseClient } from "@supabase/supabase-js";

import { buildAuthorMsgfDashboardLinks } from "./authorMsgfDashboardLinks.js";

export type RoleSignupStat = {
  role: string;
  signups: number;
  manuscripts: number;
  avg_tokens: number;
  total_tokens: number;
};

export type PlatformAdminOverview = {
  generated_at: string;
  totals: {
    profiles: number;
    manuscripts: number;
    tokens_cumulative: number;
  };
  by_role: RoleSignupStat[];
  msgf_links: ReturnType<typeof buildAuthorMsgfDashboardLinks>;
  open_document_reviews: number;
};

const AUTHOR_ROLES = ["author", "editor", "helper", "publisher", "fan"] as const;

function normalizeRoleKey(raw: string): string {
  const r = raw.trim().toLowerCase();
  if (AUTHOR_ROLES.includes(r as (typeof AUTHOR_ROLES)[number])) return r;
  if (r === "collaborator") return "editor";
  return "author";
}

export async function fetchPlatformAdminOverview(
  admin: SupabaseClient
): Promise<PlatformAdminOverview> {
  const { data: profiles, error: profileErr } = await admin
    .from("p4_profiles")
    .select("user_id, user_role");
  if (profileErr) throw new Error(profileErr.message);

  const roleByUser = new Map<string, string>();
  for (const row of profiles ?? []) {
    const uid = String(row.user_id ?? "");
    if (!uid) continue;
    roleByUser.set(uid, normalizeRoleKey(String(row.user_role ?? "author")));
  }

  const signupByRole = new Map<string, number>();
  for (const role of AUTHOR_ROLES) signupByRole.set(role, 0);
  for (const role of roleByUser.values()) {
    signupByRole.set(role, (signupByRole.get(role) ?? 0) + 1);
  }

  const manuscriptsByRole = new Map<string, number>();
  for (const role of AUTHOR_ROLES) manuscriptsByRole.set(role, 0);

  const { data: manuscripts, error: msErr } = await admin
    .from("p4_manuscripts")
    .select("id, tenant_id");
  if (msErr) throw new Error(msErr.message);

  for (const m of manuscripts ?? []) {
    const tenant = String(m.tenant_id ?? "");
    const role = roleByUser.get(tenant) ?? "author";
    manuscriptsByRole.set(role, (manuscriptsByRole.get(role) ?? 0) + 1);
  }

  const tokensByRole = new Map<string, { sum: number; count: number }>();
  for (const role of AUTHOR_ROLES) tokensByRole.set(role, { sum: 0, count: 0 });

  const { data: usageRows, error: usageErr } = await admin
    .from("usage_monitor")
    .select("user_id, tokens_cumulative");
  if (!usageErr) {
    for (const row of usageRows ?? []) {
      const uid = String(row.user_id ?? "").trim();
      const role = roleByUser.get(uid) ?? "author";
      const tokens = Number(row.tokens_cumulative ?? 0);
      const bucket = tokensByRole.get(role) ?? { sum: 0, count: 0 };
      bucket.sum += tokens;
      bucket.count += 1;
      tokensByRole.set(role, bucket);
    }
  }

  const by_role: RoleSignupStat[] = AUTHOR_ROLES.map((role) => {
    const signups = signupByRole.get(role) ?? 0;
    const tokenBucket = tokensByRole.get(role) ?? { sum: 0, count: 0 };
    return {
      role,
      signups,
      manuscripts: manuscriptsByRole.get(role) ?? 0,
      avg_tokens: tokenBucket.count ? Math.round(tokenBucket.sum / tokenBucket.count) : 0,
      total_tokens: tokenBucket.sum,
    };
  });

  let reviewCount = 0;
  const { count, error: reviewErr } = await admin
    .from("p4_document_ingest_sessions")
    .select("id", { count: "exact", head: true })
    .eq("status", "review");
  if (!reviewErr) reviewCount = count ?? 0;

  const totalTokens = [...tokensByRole.values()].reduce((n, b) => n + b.sum, 0);

  return {
    generated_at: new Date().toISOString(),
    totals: {
      profiles: profiles?.length ?? 0,
      manuscripts: manuscripts?.length ?? 0,
      tokens_cumulative: totalTokens,
    },
    by_role,
    msgf_links: buildAuthorMsgfDashboardLinks(),
    open_document_reviews: reviewCount,
  };
}
