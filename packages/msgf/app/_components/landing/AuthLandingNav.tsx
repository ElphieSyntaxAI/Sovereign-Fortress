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
 * Distribution Build ID: MSGF-1b90a4ac-20260802T111608Z-internal
 */
import { cookies, headers } from "next/headers";

import { LandingNav } from "@/app/_components/landing/LandingNav";
import { createClient, requestHostFromHeaders } from "@/utils/supabase/server";

/** Marketing site header. Signed-in users get the same primary app destinations as DashboardNav. */
export async function AuthLandingNav() {
  const cookieStore = await cookies();
  const hdrs = await headers();
  const supabase = createClient(cookieStore, requestHostFromHeaders(hdrs));
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <LandingNav userEmail={user?.email ?? null} />;
}
