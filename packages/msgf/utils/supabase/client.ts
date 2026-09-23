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
 * Distribution Build ID: MSGF-fca2d532-20260923T201750Z-internal
 */
import { createBrowserClient } from "@supabase/ssr";

import { withMsgfAuthCookieOptions } from "@/lib/msgf-auth-cookies";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const createClient = () => {
  if (!supabaseUrl?.trim() || !supabaseKey?.trim()) {
    const msg =
      "MSGF: Supabase browser client is missing NEXT_PUBLIC_SUPABASE_URL or " +
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. These are inlined at `next build` time — " +
      "rebuild the Docker image with --build-arg (see repo Dockerfile + setup-cloud.sh), " +
      "or run `next dev` with a root `.env.local` containing both keys.";
    if (typeof window !== "undefined") {
      console.error(msg);
    }
    throw new Error(msg);
  }

  const host =
    typeof window !== "undefined" ? window.location.hostname : undefined;
  const cookieOptions = withMsgfAuthCookieOptions({ path: "/" }, host);
  return createBrowserClient(supabaseUrl!, supabaseKey!, {
    cookieOptions: {
      ...(cookieOptions.domain ? { domain: cookieOptions.domain } : {}),
      path: cookieOptions.path,
      sameSite: cookieOptions.sameSite,
      secure: cookieOptions.secure,
    },
  });
};
