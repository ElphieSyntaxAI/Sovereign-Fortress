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
 * Distribution Build ID: MSGF-4e22f0c-20260518T205132Z-internal
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { createClient } from "@/utils/supabase/client";

type Mode = "sign-in" | "sign-up";

type Props = {
  mode: Mode;
};

export function AuthForm({ mode }: Props) {
  const router = useRouter();
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

      if (isSignUp) {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        setLoading(false);
        if (signUpError) {
          setError(signUpError.message);
          return;
        }
        setMessage("Check your email to confirm your account, or sign in if confirmation is disabled.");
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (signInError) {
        setError(signInError.message);
        return;
      }
      router.push("/todos");
      router.refresh();
    },
    [email, password, isSignUp, router]
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
          className="w-full rounded-lg border border-violet-500/25 bg-slate-950/80 px-3 py-2.5 text-sm text-slate-100 outline-none ring-emerald-500/30 focus:border-emerald-500/50 focus:ring-2"
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
          className="w-full rounded-lg border border-violet-500/25 bg-slate-950/80 px-3 py-2.5 text-sm text-slate-100 outline-none ring-violet-500/30 focus:border-violet-500/50 focus:ring-2"
        />
      </label>

      {error ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200" role="alert">
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
