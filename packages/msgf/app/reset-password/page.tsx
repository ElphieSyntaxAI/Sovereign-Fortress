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
 * Distribution Build ID: MSGF-191e80fa-20260921T055901Z-internal
 */
import Link from "next/link";

import { ResetPasswordClient } from "@/app/_components/auth/ResetPasswordClient";
import { AuthLandingNav } from "@/app/_components/landing/AuthLandingNav";

export default function ResetPasswordPage() {
  return (
    <div className="landing-mesh min-h-screen text-slate-100">
      <AuthLandingNav />
      <main className="mx-auto flex max-w-md flex-col gap-6 px-5 py-12 sm:py-16">
        <ResetPasswordClient />
      </main>
    </div>
  );
}
