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
 * Distribution Build ID: MSGF-ee924ab-20260518T235305Z-internal
 */
import { createBrowserClient } from "@supabase/ssr";

import { msgfAuthCookieDomain } from "@/lib/msgf-auth-cookies";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const createClient = () => {
  const domain = msgfAuthCookieDomain();
  return createBrowserClient(supabaseUrl!, supabaseKey!, {
    cookieOptions: {
      ...(domain ? { domain } : {}),
      path: "/",
      sameSite: "lax",
      secure:
        process.env.NODE_ENV === "production" ||
        process.env.MSGF_AUTH_COOKIE_SECURE === "1",
    },
  });
};
