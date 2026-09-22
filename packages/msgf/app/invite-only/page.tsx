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
import Link from "next/link";

const REASON_COPY: Record<string, string> = {
  domain_unmapped:
    "Your Google Workspace domain is not registered with an MSGF company. Ask your admin to add the domain, or accept a team invite.",
  consumer_domain:
    "Personal Google accounts (gmail.com and similar) cannot open company tenancy. Use your work Workspace account or an invite link.",
  not_google: "This page is for Workspace SSO. Sign in with Google Workspace or use a team invite.",
  no_email: "Your Google account did not provide an email address.",
  profile_update_failed: "We could not attach your company profile. Try again or contact support.",
};

export default async function InviteOnlyPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const sp = await searchParams;
  const reason = (sp.reason ?? "domain_unmapped").trim();
  const copy = REASON_COPY[reason] ?? REASON_COPY.domain_unmapped;

  return (
    <main className="landing-mesh flex min-h-screen items-center justify-center px-6 text-slate-200">
      <div className="glass-panel max-w-lg space-y-4 rounded-2xl p-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-300/90">
          Invite only
        </p>
        <h1 className="text-2xl font-semibold text-slate-50">Company access required</h1>
        <p className="text-sm text-slate-400">{copy}</p>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <Link
            href="/sign-in"
            className="rounded-full border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:border-slate-400"
          >
            Back to sign in
          </Link>
          <Link
            href="/admin/sign-in"
            className="rounded-full bg-gradient-to-r from-emerald-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Admin sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
