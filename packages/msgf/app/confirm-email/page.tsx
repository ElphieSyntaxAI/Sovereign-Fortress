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
import Link from "next/link";

import { AuthLandingNav } from "@/app/_components/landing/AuthLandingNav";

type Props = {
  searchParams: Promise<{ email?: string }>;
};

export default async function ConfirmEmailPage({ searchParams }: Props) {
  const { email } = await searchParams;
  const displayEmail =
    typeof email === "string" && email.includes("@") ? email.trim() : "your inbox";

  return (
    <div className="landing-mesh min-h-screen text-slate-100">
      <AuthLandingNav />
      <main className="mx-auto flex max-w-xl flex-col gap-6 px-5 py-12 sm:py-16">
        <section className="glass-panel glass-panel-emerald rounded-3xl p-6 text-center sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300/90">
            Almost there
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">
            <span className="text-gradient-jewel">Confirm your Elphie Syntax account</span>
          </h1>
          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-slate-300">
            We sent a confirmation email to{" "}
            <span className="font-semibold text-emerald-200">{displayEmail}</span>. Open it and
            click <span className="font-semibold text-violet-200">Confirm sign up</span> to unlock
            the MSGF dashboard.
          </p>

          <div className="mt-8 grid gap-3 rounded-2xl border border-violet-500/20 bg-slate-950/45 p-4 text-left text-sm text-slate-300">
            <p>
              <span className="font-semibold text-slate-100">No email?</span> Check spam,
              promotions, and any quarantine filter on the mailbox.
            </p>
            <p>
              If it still does not arrive, use the <span className="font-semibold">Resend confirmation email</span>{" "}
              button on the sign-up page. Supabase also requires email confirmations to be enabled
              and SMTP configured in the project.
            </p>
          </div>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/sign-up"
              className="rounded-full border border-violet-500/30 bg-violet-500/10 px-5 py-3 text-sm font-semibold text-violet-100 transition hover:bg-violet-500/20"
            >
              Back to sign up
            </Link>
            <Link
              href="/sign-in"
              className="rounded-full bg-gradient-to-r from-emerald-600 to-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-900/30 transition hover:brightness-110"
            >
              I confirmed, sign in
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
