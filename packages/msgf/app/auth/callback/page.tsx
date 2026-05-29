"use client";

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
 * Distribution Build ID: MSGF-3ea5d0e-20260529T033030Z-internal
 */
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
 * Distribution Build ID: MSGF-c103094-20260526T230730Z-internal
 */
import { useEffect, useState } from "react";

import { msgfPostLoginPath, resolveAuthRedirectUrl } from "@/lib/auth-post-login";
import { createClient } from "@/utils/supabase/client";

function safeNext(raw: string | null): string {
  const n = raw?.trim();
  if (n && n.startsWith("/") && !n.startsWith("//")) return n;
  return msgfPostLoginPath();
}

/**
 * Completes Supabase auth after email confirm, magic link, or PKCE redirect.
 * Server `route.ts` cannot read URL hash fragments; this page handles `code`,
 * `token_hash`, and implicit hash sessions in the browser.
 */
export default function AuthCallbackPage() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function complete() {
      const params = new URLSearchParams(window.location.search);
      const next = safeNext(params.get("next"));
      const isAdminDest = next.startsWith("/admin");

      try {
        const supabase = createClient();
        const code = params.get("code");
        const tokenHash = params.get("token_hash");
        const type = params.get("type");

        if (code) {
          const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeErr) throw exchangeErr;
        } else if (tokenHash && type) {
          const { error: otpErr } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as "signup" | "invite" | "magiclink" | "recovery" | "email_change" | "email",
          });
          if (otpErr) throw otpErr;
        }

        const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
        if (sessionErr) throw sessionErr;

        if (!sessionData.session) {
          throw new Error(
            "No session after auth callback. Confirm the link was opened on the same host that sent the email, or sign in with password."
          );
        }

        if (cancelled) return;
        window.location.assign(resolveAuthRedirectUrl(next));
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[auth/callback]", e);
        setError(msg);
        const signIn = isAdminDest
          ? `/admin/sign-in?error=auth_callback&next=${encodeURIComponent(next)}`
          : "/sign-in?error=auth_callback";
        window.setTimeout(() => {
          window.location.assign(resolveAuthRedirectUrl(signIn));
        }, 4000);
      }
    }

    void complete();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="landing-mesh flex min-h-screen items-center justify-center px-6 text-slate-200">
      <div className="glass-panel max-w-md rounded-2xl p-8 text-center">
        <p className="text-sm text-slate-300">
          {error ? "Sign-in could not be completed." : "Finishing sign-in…"}
        </p>
        {error ? (
          <p className="mt-3 text-xs text-red-300/90">{error}</p>
        ) : (
          <p className="mt-2 text-xs text-slate-500">Redirecting to your dashboard.</p>
        )}
      </div>
    </main>
  );
}
