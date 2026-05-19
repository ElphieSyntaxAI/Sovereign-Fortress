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
 * Distribution Build ID: MSGF-b4602b0-20260519T165710Z-internal
 */
import Link from "next/link";

import { MarketingSection } from "@/app/_components/marketing/MarketingSection";
import { MarketingShell } from "@/app/_components/marketing/MarketingShell";
import { PricingCtaButton } from "@/app/_components/pricing/PricingCtaButton";

const DASHBOARD_URL =
  process.env.MSGF_APP_URL?.trim() ||
  process.env.NEXT_PUBLIC_MSGF_APP_URL?.trim() ||
  "https://elphiesgatedai.elphiesyntax.com/dashboard";

export const metadata = {
  title: "Getting Started | Elphie's Gated AI",
  description: "MSGF quickstart — token, IDE extension, BYOK vs Independent Pro engine strategy.",
};

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="marketing-code overflow-x-auto rounded-xl border border-emerald-500/20 bg-[#0a0612]/90 px-4 py-3 text-xs text-emerald-100/90 sm:text-sm">
      <code>{children}</code>
    </pre>
  );
}

export default function GettingStartedPage() {
  return (
    <MarketingShell className="pricing-page">
      <main className="mx-auto max-w-3xl px-5 pb-24 pt-12 sm:pt-16">
        <header className="mx-auto mb-14 max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-300/90">
            Runbook
          </p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
            MSGF <span className="text-gradient-jewel">Quickstart</span>
          </h1>
          <p className="mx-auto mt-5 text-base leading-relaxed text-slate-400">
            Three steps from dashboard token to a live six-pillar engine in your IDE.
          </p>
        </header>

        <ol className="space-y-8">
          <li>
            <MarketingSection eyebrow="Step 1" title="Initialize Your Token">
              <p>
                Sign in to your dashboard console to copy your sandboxed access token.
              </p>
              <CodeBlock>{DASHBOARD_URL}</CodeBlock>
              <p>
                <Link
                  href="/dashboard"
                  className="font-medium text-emerald-400 underline-offset-4 hover:underline"
                >
                  Open dashboard
                </Link>{" "}
                (or use the production URL above) and paste the token into your workspace settings.
              </p>
            </MarketingSection>
          </li>

          <li>
            <MarketingSection eyebrow="Step 2" title="Boot Your Extension">
              <p>
                Install the <strong className="text-[#f8fafc]">msgf-pulse-guard</strong> extension
                in Cursor or VS Code, and drop your credentials into your project workspace
                settings.
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
            <MarketingSection
              eyebrow="Step 3"
              title="Establish Your Engine Strategy"
              variant="featured"
            >
              <div className="space-y-6">
                <div className="rounded-xl border border-emerald-500/20 bg-[#160f29]/50 p-5">
                  <h3 className="text-base font-bold text-emerald-200">
                    The BYOK Path ($0)
                  </h3>
                  <p className="mt-2">
                    Drop a <code className="text-emerald-300">gemini.key</code> and{" "}
                    <code className="text-emerald-300">claude.key</code> file directly into your
                    local workspace <code className="text-violet-200">.msgf/keys/</code> folder to
                    run cross-model consensus entirely on your own wallet.
                  </p>
                  <CodeBlock>{`.msgf/keys/gemini.key\n.msgf/keys/claude.key`}</CodeBlock>
                </div>

                <div className="rounded-xl border border-violet-500/25 bg-[#120a22]/60 p-5">
                  <h3 className="text-base font-bold text-violet-200">
                    The Independent Pro Path ($99 · buy once)
                  </h3>
                  <p className="mt-2">
                    Activate our premium managed cloud network keys. Let our Cloud Run clusters
                    handle the inference load automatically — no provider keys required for Year 1
                    managed consensus.
                  </p>
                  <div className="mt-4">
                    <PricingCtaButton
                      kind="stripe_checkout"
                      label="Buy perpetual license — $99"
                      plan="pro_individual"
                      variant="featured"
                    />
                  </div>
                </div>
              </div>
            </MarketingSection>
          </li>
        </ol>

        <p className="mt-12 text-center text-sm text-slate-500">
          Need the full tier matrix?{" "}
          <Link href="/pricing" className="text-violet-400/90 underline-offset-4 hover:underline">
            Compare pricing
          </Link>
        </p>
      </main>
    </MarketingShell>
  );
}
