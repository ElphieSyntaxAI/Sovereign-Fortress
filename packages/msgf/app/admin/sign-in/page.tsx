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
import { LandingNav } from "@/app/_components/landing/LandingNav";

type Props = {
  searchParams: Promise<{ next?: string }>;
};

export default async function AdminSignInPage({ searchParams }: Props) {
  const { next } = await searchParams;
  const postLoginPath =
    typeof next === "string" && next.startsWith("/") && !next.startsWith("//")
      ? next
      : "/admin/portal";

  return (
    <div className="landing-mesh min-h-screen text-slate-100">
      <LandingNav />
      <main className="mx-auto flex max-w-md flex-col gap-6 px-5 py-12 sm:py-16">
        <div className="space-y-2 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-300/90">
            MSGF Operator Access
          </p>
          <h1 className="text-2xl font-bold tracking-tight">Admin sign in</h1>
          <p className="text-sm text-slate-400">
            Canonical operator sign-in for the whole product family (MSGF, Author Ecosystem, Syntax
            Education). Satellite apps expose{" "}
            <code className="text-violet-300">/admin/sign-in</code> and forward here. After email
            confirmation you should land back on MSGF; if you land on Author or Syntax Educates
            first, their <code className="text-violet-300">/auth/callback</code> shim forwards you
            here automatically.
          </p>
          <p className="text-xs text-slate-500">
            Elphie Syntax Workspace is the only global admin. Individual operator accounts
            use <code className="text-violet-300">COMPANY_ADMIN</code> on a personal sandbox
            (not a team tenant).
          </p>
        </div>
        <AuthForm mode="sign-in" postLoginPath={postLoginPath} variant="admin" />
        <p className="text-center text-sm text-slate-500">
          <Link href="/" className="text-violet-400/90 hover:underline">
            ← Back to home
          </Link>
        </p>
      </main>
    </div>
  );
}
