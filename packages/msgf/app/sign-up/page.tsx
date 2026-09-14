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
 * Distribution Build ID: MSGF-c122f849-20260911T161212Z-internal
 */
import Link from "next/link";

import { BetaSignupForm } from "@/app/_components/marketing/BetaSignupForm";
import { AuthLandingNav } from "@/app/_components/landing/AuthLandingNav";

export default function SignUpPage() {
  return (
    <div className="landing-mesh min-h-screen text-slate-100">
      <AuthLandingNav />
      <main className="mx-auto max-w-lg px-5 py-12 sm:py-16">
        <BetaSignupForm product="msgf" />
        <p className="mt-6 text-center text-sm text-slate-500">
          <Link href="/" className="text-emerald-400/90 hover:underline">
            ← Back to home
          </Link>
        </p>
      </main>
    </div>
  );
}
