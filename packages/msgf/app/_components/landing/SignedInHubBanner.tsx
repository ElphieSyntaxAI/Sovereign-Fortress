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
import { cookies, headers } from "next/headers";

import { createClient, requestHostFromHeaders } from "@/utils/supabase/server";

/**
 * When a signed-in user lands on the public platform hub (`/`), make it obvious
 * this is not their governance dashboard — and give one clear exit into `/dashboard`.
 */
export async function SignedInHubBanner() {
  const cookieStore = await cookies();
  const hdrs = await headers();
  const supabase = createClient(cookieStore, requestHostFromHeaders(hdrs));
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return (
    <aside
      className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-5 py-4 text-center sm:px-6"
      aria-label="Signed-in shortcut"
    >
      <p className="text-sm text-emerald-50/95">
        You&apos;re signed in. This page is the{" "}
        <strong className="font-semibold text-white">platform chooser</strong> — not your
        governance console.
      </p>
      <Link
        href="/dashboard"
        className="mt-3 inline-flex rounded-full bg-gradient-to-r from-emerald-600 to-violet-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-violet-900/25 transition hover:from-emerald-500 hover:to-violet-500"
      >
        Go to your MSGF dashboard →
      </Link>
    </aside>
  );
}
