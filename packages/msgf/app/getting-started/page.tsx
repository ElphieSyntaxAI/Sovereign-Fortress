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
import Link from "next/link";
import { cookies, headers } from "next/headers";

import { PillarGuideSection } from "@/app/_components/getting-started/PillarGuideSection";
import { DashboardNav } from "@/app/_components/dashboard/DashboardNav";
import { MarketingSection } from "@/app/_components/marketing/MarketingSection";
import { MarketingShell } from "@/app/_components/marketing/MarketingShell";
import { ShadowSavingsHowTo } from "@/app/_components/marketing/ShadowSavingsHowTo";
import { PricingCtaButton } from "@/app/_components/pricing/PricingCtaButton";
import { resolveDashboardAccessForUser } from "@/lib/dashboard-access";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient, requestHostFromHeaders } from "@/utils/supabase/server";

export const metadata = {
  title: "Getting Started | MSGF",
  description: "MSGF quickstart, six policy domains, IDE extension, and optional bring-your-own keys.",
};

function QuickstartSteps() {
  return (
    <ol className="space-y-8">
      <li>
        <MarketingSection eyebrow="Step 1" title="Start in shadow mode">
          <p>
            <Link
              href="/shadow-trial"
              className="font-medium text-emerald-400 underline-offset-4 hover:underline"
            >
              Start the 7-day shadow-mode trial
            </Link>{" "}
            to point an SDK at the MSGF gateway — no console seat required. Already invited?{" "}
            <Link
              href="/sign-in?next=/workspace"
              className="font-medium text-emerald-400 underline-offset-4 hover:underline"
            >
              Sign in
            </Link>{" "}
            and open <strong className="text-[#f8fafc]">Workspace</strong> for a ready-made{" "}
            <code className="text-violet-200">.vscode/settings.json</code> block.{" "}
            <Link href="/sign-up" className="text-slate-400 underline-offset-4 hover:underline">
              Beta waitlist
            </Link>{" "}
            is for a console seat, not account creation.
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
            Register the folder you code in under{" "}
            <Link href="/setup/projects" className="text-cyan-400 underline-offset-4 hover:underline">
              Projects
            </Link>
            , then watch policy-domain health on your{" "}
            <Link href="/dashboard" className="text-emerald-400 underline-offset-4 hover:underline">
              governance dashboard
            </Link>
            . Optional BYOK keys live in <code className="text-violet-200">.msgf/keys/</code>{" "}
            (<code className="text-violet-200">gemini.key</code>,{" "}
            <code className="text-violet-200">claude.key</code>, optional{" "}
            <code className="text-violet-200">xai.key</code> for Grok). Pick routing presets on the
            dashboard under token cost.
          </p>
          <p className="mt-4">
            <Link
              href="/pricing"
              className="font-medium text-violet-400 underline-offset-4 hover:underline"
            >
              Compare pricing
            </Link>{" "}
            for managed Pro inference. Author and Education apps live under{" "}
            <Link href="/other-products" className="text-violet-400 underline-offset-4 hover:underline">
              Other products
            </Link>
            .
          </p>
        </MarketingSection>
      </li>
    </ol>
  );
}

export default async function GettingStartedPage() {
  const cookieStore = await cookies();
  const hdrs = await headers();
  const supabase = createClient(cookieStore, requestHostFromHeaders(hdrs));
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const admin = createAdminClient();
    const access = await resolveDashboardAccessForUser(user);

    return (
      <div className="app-shell min-h-screen text-slate-100">
        <DashboardNav
          userEmail={user.email ?? "Signed in"}
          showAdminPortalLink={access.canAccessAdminDashboard}
        />
        <main className="mx-auto max-w-4xl px-5 pb-24 pt-10 sm:pt-14">
          <header className="mx-auto mb-12 max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-300/90">
              Quickstart
            </p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
              MSGF in <span className="text-gradient-jewel">three steps</span>
            </h1>
            <p className="mx-auto mt-5 text-base leading-relaxed text-slate-400">
              Setup guide and policy-domain reference for your account.
            </p>
            <Link
              href="/dashboard"
              className="mt-4 inline-block text-sm font-medium text-emerald-400/90 underline-offset-4 hover:underline"
            >
              ← Back to dashboard
            </Link>
          </header>

          <QuickstartSteps />

          <div className="mt-12">
            <ShadowSavingsHowTo />
          </div>

          <hr className="my-16 border-slate-800/80" />

          <PillarGuideSection />
        </main>
      </div>
    );
  }

  return (
    <MarketingShell className="pricing-page">
      <main className="mx-auto max-w-4xl px-5 pb-24 pt-12 sm:pt-16">
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

        <QuickstartSteps />

        <div className="mt-12">
          <ShadowSavingsHowTo />
        </div>

        <p className="mt-12 text-center text-sm text-slate-500">
          <Link href="#six-pillars" className="text-violet-400/90 underline-offset-4 hover:underline">
            Jump to policy-domain guide
          </Link>
          {" · "}
          <Link href="/workspace" className="text-cyan-400/90 underline-offset-4 hover:underline">
            Open workspace setup
          </Link>
        </p>

        <hr className="my-16 border-slate-800/80" />

        <PillarGuideSection />
      </main>
    </MarketingShell>
  );
}
