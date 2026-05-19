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
 * Distribution Build ID: MSGF-853c3b6-20260519T054901Z-internal
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
 * Distribution Build ID: MSGF-2790974-20260519T053954Z-internal
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
 * Distribution Build ID: MSGF-2790974-20260519T053039Z-internal
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
 * Distribution Build ID: MSGF-753c05a-20260519T051006Z-internal
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
 * Distribution Build ID: MSGF-753c05a-20260519T050509Z-internal
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
 * Distribution Build ID: MSGF-f70c13c-20260519T044237Z-internal
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
 * Distribution Build ID: MSGF-ee924ab-20260518T235305Z-internal
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
 * Distribution Build ID: MSGF-4e22f0c-20260518T205132Z-internal
 */
import Link from "next/link";
import { useCallback, useState } from "react";

import { msgfPostLoginPath, resolveAuthRedirectUrl } from "@/lib/auth-post-login";
import { msgfAuthCookieDomainForHost } from "@/lib/msgf-auth-cookies";
import { createClient } from "@/utils/supabase/client";

type Mode = "sign-in" | "sign-up";

type Props = {
  mode: Mode;
  /** Override default post-login path (e.g. from `?next=/dashboard`). */
  postLoginPath?: string;
};

function authCallbackUrl(): string {
  return resolveAuthRedirectUrl("/auth/callback");
}

export function AuthForm({ mode, postLoginPath }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isSignUp = mode === "sign-up";

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError(null);
      setMessage(null);

      const supabase = createClient();

      try {
        if (isSignUp) {
          const { error: signUpError } = await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: authCallbackUrl() },
          });
          if (signUpError) {
            console.error("[AuthForm] sign-up failed:", signUpError.message, signUpError);
            setError(signUpError.message);
            return;
          }
          setMessage(
            "Check your email to confirm your account, or sign in if confirmation is disabled."
          );
          return;
        }

        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) {
          console.error("[AuthForm] signInWithPassword failed:", signInError.message, signInError);
          setError(signInError.message);
          return;
        }

        const session =
          signInData.session ??
          (await supabase.auth.getSession()).data.session ??
          null;
        if (!session) {
          const cookieDomain =
            msgfAuthCookieDomainForHost(
              typeof window !== "undefined" ? window.location.hostname : undefined
            ) ?? "(host-only)";
          const hint =
            "Sign-in returned 200 but no session was stored. If you deploy on *.run.app, set " +
            "MSGF_AUTH_COOKIE_DOMAIN=host and NEXT_PUBLIC_MSGF_AUTH_COOKIE_DOMAIN=host in Cloud Run " +
            "(or remove a baked-in NEXT_PUBLIC_MSGF_AUTH_COOKIE_DOMAIN=.elphiesyntax.com from the image). " +
            "Cookie domain in use for this host: " +
            cookieDomain +
            ".";
          console.error("[AuthForm] missing session after sign-in", {
            origin: window.location.origin,
            cookieDomain,
            hint,
          });
          setError(hint);
          return;
        }

        const targetPath =
          postLoginPath?.trim().startsWith("/") ? postLoginPath.trim() : msgfPostLoginPath();
        const redirectUrl = resolveAuthRedirectUrl(targetPath);
        console.info("[AuthForm] sign-in OK, redirecting to", redirectUrl);
        window.location.assign(redirectUrl);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[AuthForm] unhandled sign-in error:", err);
        setError(msg || "Sign-in failed. See browser console for details.");
      } finally {
        setLoading(false);
      }
    },
    [email, password, isSignUp, postLoginPath]
  );

  return (
    <form
      className="glass-panel glass-panel-emerald space-y-4 rounded-2xl p-6 sm:p-8"
      onSubmit={submit}
    >
      <label className="block space-y-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Email</span>
        <input
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          className="w-full rounded-lg border border-violet-500/25 bg-slate-950/80 px-3 py-2.5 text-sm text-slate-100 outline-none ring-emerald-500/30 focus:border-emerald-500/50 focus:ring-2 disabled:opacity-60"
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Password</span>
        <input
          type="password"
          autoComplete={isSignUp ? "new-password" : "current-password"}
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
          className="w-full rounded-lg border border-violet-500/25 bg-slate-950/80 px-3 py-2.5 text-sm text-slate-100 outline-none ring-violet-500/30 focus:border-violet-500/50 focus:ring-2 disabled:opacity-60"
        />
      </label>

      {error ? (
        <p
          className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          {message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-full bg-gradient-to-r from-emerald-600 to-violet-600 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
      >
        {loading ? "Please wait…" : isSignUp ? "Create account" : "Sign in"}
      </button>

      <p className="text-center text-sm text-slate-500">
        {isSignUp ? (
          <>
            Already have an account?{" "}
            <Link href="/sign-in" className="font-medium text-violet-300 hover:text-violet-200">
              Sign in
            </Link>
          </>
        ) : (
          <>
            New to Elphie&apos;s Gated AI?{" "}
            <Link href="/sign-up" className="font-medium text-emerald-300 hover:text-emerald-200">
              Sign up
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
