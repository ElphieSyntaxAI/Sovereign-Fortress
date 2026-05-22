import { cookies, headers } from "next/headers";

import { LandingNav } from "@/app/_components/landing/LandingNav";
import { createClient, requestHostFromHeaders } from "@/utils/supabase/server";

/** Site header that keeps you signed in across marketing pages (Dashboard / Workspace links). */
export async function AuthLandingNav() {
  const cookieStore = await cookies();
  const hdrs = await headers();
  const supabase = createClient(cookieStore, requestHostFromHeaders(hdrs));
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <LandingNav userEmail={user?.email ?? null} />;
}
