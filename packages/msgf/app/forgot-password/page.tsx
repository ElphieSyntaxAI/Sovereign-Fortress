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

import { AuthLandingNav } from "@/app/_components/landing/AuthLandingNav";
import { ForgotPasswordForm } from "@/app/_components/auth/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <div className="landing-mesh min-h-screen text-slate-100">
      <AuthLandingNav />
      <main className="mx-auto flex max-w-md flex-col gap-6 px-5 py-12 sm:py-16">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Forgot password</h1>
          <p className="text-sm text-slate-400">
            We&apos;ll email you a secure link to reset your credentials.
          </p>
        </div>
        <ForgotPasswordForm />
        <p className="text-center text-sm text-slate-500">
          <Link href="/sign-in" className="text-violet-400/90 hover:underline">
            ← Back to sign in
          </Link>
        </p>
      </main>
    </div>
  );
}
