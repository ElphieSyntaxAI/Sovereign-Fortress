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
 * Distribution Build ID: MSGF-753c05a-20260519T051006Z-internal
 */
import Link from "next/link";

import { AuthForm } from "@/app/_components/auth/AuthForm";
import { LandingNav } from "@/app/_components/landing/LandingNav";

export default function SignUpPage() {
  return (
    <div className="landing-mesh min-h-screen text-slate-100">
      <LandingNav />
      <main className="mx-auto flex max-w-md flex-col gap-6 px-5 py-12 sm:py-16">
        <div className="space-y-2 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-300/90">
            Elphie&apos;s Gated AI
          </p>
          <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
          <p className="text-sm text-slate-400">Join the glass-box framework — sovereign AI with visible gates.</p>
        </div>
        <AuthForm mode="sign-up" />
        <p className="text-center text-sm text-slate-500">
          <Link href="/" className="text-emerald-400/90 hover:underline">
            ← Back to home
          </Link>
        </p>
      </main>
    </div>
  );
}
