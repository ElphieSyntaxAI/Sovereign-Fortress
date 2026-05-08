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
