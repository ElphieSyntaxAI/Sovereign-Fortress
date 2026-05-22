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
 * Distribution Build ID: MSGF-e3b90d5-20260522T030006Z-internal
 */
import Link from "next/link";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { MarketingSection } from "@/app/_components/marketing/MarketingSection";
import { MarketingShell } from "@/app/_components/marketing/MarketingShell";
import { PricingCtaButton } from "@/app/_components/pricing/PricingCtaButton";
import { createClient, requestHostFromHeaders } from "@/utils/supabase/server";

export const metadata = {
  title: "Getting Started | Elphie's Gated AI",
  description: "MSGF quickstart — sign in, IDE extension, and optional BYOK.",
};

export default async function GettingStartedPage() {
  const cookieStore = await cookies();
  const hdrs = await headers();
  const supabase = createClient(cookieStore, requestHostFromHeaders(hdrs));
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/workspace");
  }

  return (
    <MarketingShell className="pricing-page">
      <main className="mx-auto max-w-3xl px-5 pb-24 pt-12 sm:pt-16">
        <header className="mx-auto mb-14 max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-300/90">
            Quickstart
          </p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
            MSGF in <span className="text-gradient-jewel">three steps</span>
          </h1>
          <p className="mx-auto mt-5 text-base leading-relaxed text-slate-400">
            Sign in once — your workspace generates IDE settings, extension download, and project
            mapping in one place.
          </p>
        </header>

        <ol className="space-y-8">
          <li>
            <MarketingSection eyebrow="Step 1" title="Create your account">
              <p>
                <Link
                  href="/sign-up"
                  className="font-medium text-emerald-400 underline-offset-4 hover:underline"
                >
                  Sign up
                </Link>{" "}
                or{" "}
                <Link
                  href="/sign-in?next=/workspace"
                  className="font-medium text-emerald-400 underline-offset-4 hover:underline"
                >
                  sign in
                </Link>
                . Open <strong className="text-[#f8fafc]">Workspace</strong> to copy a ready-made{" "}
                <code className="text-violet-200">.vscode/settings.json</code> block tied to your
                session.
              </p>
            </MarketingSection>
          </li>

          <li>
            <MarketingSection eyebrow="Step 2" title="Install msgf-pulse-guard">
              <p>
                Download the extension for Cursor or VS Code, install from the{" "}
                <code className="text-violet-200">.vsix</code>, and paste the settings from your
                workspace.
              </p>
              <div className="pt-2">
                <PricingCtaButton
                  kind="extension_download"
                  label="Download msgf-pulse-guard"
                  variant="outline"
                />
              </div>
            </MarketingSection>
          </li>

          <li>
            <MarketingSection eyebrow="Step 3" title="Map your repo & open the dashboard">
              <p>
                Register the folder you code in, then watch pillar health on your personal
                governance dashboard. Optional BYOK keys live in{" "}
                <code className="text-violet-200">.msgf/keys/</code> if you bring your own models.
              </p>
              <p className="mt-4">
                <Link
                  href="/pricing"
                  className="font-medium text-violet-400 underline-offset-4 hover:underline"
                >
                  Compare pricing
                </Link>{" "}
                for managed Pro inference.
              </p>
            </MarketingSection>
          </li>
        </ol>

        <p className="mt-12 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link href="/workspace" className="text-cyan-400/90 underline-offset-4 hover:underline">
            Open workspace setup
          </Link>
        </p>
      </main>
    </MarketingShell>
  );
}
