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
 * Distribution Build ID: MSGF-92d026a-20260522T181651Z-internal
 */
import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <main className="mx-auto max-w-md space-y-4 p-8 text-center">
      <h1 className="text-xl font-semibold text-zinc-100">Unauthorized</h1>
      <p className="text-sm text-zinc-400">
        This account is signed in but does not have an MSGF operator role (
        <code className="text-violet-300">GLOBAL_ADMIN</code> or{" "}
        <code className="text-violet-300">COMPANY_ADMIN</code>). Run{" "}
        <code className="text-violet-300">npm run create:platform-admin -w msgf</code> for a test
        admin, or add your email to <code className="text-violet-300">MSGF_GLOBAL_ADMIN_EMAILS</code>
        .
      </p>
      <div className="flex flex-col gap-2 text-sm">
        <Link
          href="/admin/sign-in?next=/admin/portal"
          className="text-violet-300 underline-offset-4 hover:underline"
        >
          Admin sign-in (elphiesgatedai)
        </Link>
        <Link
          href="/"
          className="text-zinc-300 underline-offset-4 hover:underline"
        >
          Home
        </Link>
      </div>
    </main>
  );
}
