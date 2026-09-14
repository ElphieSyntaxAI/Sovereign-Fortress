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

import { AuthForm } from "@/app/_components/auth/AuthForm";
import { AuthLandingNav } from "@/app/_components/landing/AuthLandingNav";

type Props = {
  searchParams: Promise<{ next?: string }>;
};

export default async function SignInPage({ searchParams }: Props) {
  const { next } = await searchParams;
  const postLoginPath =
    typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : undefined;

  return (
    <div className="landing-mesh min-h-screen text-slate-100">
      <AuthLandingNav />
      <main className="mx-auto flex max-w-md flex-col gap-6 px-5 py-12 sm:py-16">
        <div className="space-y-2 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300/90">
            Elphie&apos;s Gated AI
          </p>
          <h1 className="text-2xl font-bold tracking-tight">Sign in</h1>
          <p className="text-sm text-slate-400">Access your tenant workspace and MSGF gates.</p>
        </div>
        <AuthForm mode="sign-in" postLoginPath={postLoginPath} />
        <p className="text-center text-sm text-slate-500">
          <Link href="/" className="text-violet-400/90 hover:underline">
            ← Back to home
          </Link>
        </p>
      </main>
    </div>
  );
}
