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
 * Distribution Build ID: MSGF-dde0b5b-20260519T185358Z-internal
 */
import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <main className="mx-auto max-w-md space-y-4 p-8 text-center">
      <h1 className="text-xl font-semibold text-zinc-100">Unauthorized</h1>
      <p className="text-sm text-zinc-400">
        You do not have access to this tenant or resource.
      </p>
      <Link
        href="/"
        className="inline-block text-sm text-zinc-300 underline-offset-4 hover:underline"
      >
        Home
      </Link>
    </main>
  );
}
