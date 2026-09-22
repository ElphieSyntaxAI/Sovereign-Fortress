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
import { Suspense } from "react";
import { cookies, headers } from "next/headers";

import { LandingNav } from "@/app/_components/landing/LandingNav";
import { createClient, requestHostFromHeaders } from "@/utils/supabase/server";

/**
 * Marketing site header. Cookie/auth lookup is streamed so a click to `/` does not
 * stall on Supabase before the home page can paint.
 */
export function AuthLandingNav() {
  return (
    <Suspense fallback={<LandingNav userEmail={null} />}>
      <AuthLandingNavSession />
    </Suspense>
  );
}

async function AuthLandingNavSession() {
  const cookieStore = await cookies();
  const hdrs = await headers();
  const supabase = createClient(cookieStore, requestHostFromHeaders(hdrs));
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <LandingNav userEmail={user?.email ?? null} />;
}
