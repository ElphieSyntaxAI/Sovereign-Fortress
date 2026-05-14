import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ConsensusView, LoginModule, PillarBadge } from "@elphie-syntax/ui";

import { RegisterForm } from "../components/RegisterForm";
import { bffCredentials } from "../lib/bffFetch";

export default function LoginHomePage() {
  const navigate = useNavigate();
  const [authError, setAuthError] = useState(/** @type {string | null} */ (null));
  const [sessionMode, setSessionMode] = useState(/** @type {"signin" | "register"} */ ("signin"));

  return (
    <div className="dark min-h-screen bg-zinc-950 p-6 text-zinc-100">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="space-y-3">
          <h1 className="text-2xl font-semibold tracking-tight">Author Ecosystem</h1>
          <p className="text-sm text-zinc-400">
            Shared UI from <code className="text-zinc-300">@elphie-syntax/ui</code> (Tailwind v4 + React 19).
          </p>
          <div className="flex flex-wrap gap-2">
            <PillarBadge lineageLabel="MSGF_V3_STRICT.constraint_ledger.1.0.0" />
            <PillarBadge lineageLabel="MSGF_V3_STRICT.constraint_ledger.1.1.0" />
            <PillarBadge lineageLabel="MSGF_V3_STRICT.constraint_ledger.1.1.1" />
          </div>
        </header>

        <ConsensusView
          heading="Consensus (sample)"
          modelA={{
            name: "Gemini",
            content: '{"verdict":"HUMAN","reason":"Natural rhythm"}',
            footer: "Flash · low temperature",
          }}
          modelB={{
            name: "Claude",
            content: '{"verdict":"HUMAN","reason":"Consistent dwell"}',
            footer: "Sonnet · low temperature",
          }}
        />

        <div className="flex flex-col items-center gap-3">
          <div className="flex gap-2 rounded-full border border-zinc-800 bg-zinc-900/50 p-1">
            <button
              type="button"
              onClick={() => {
                setSessionMode("signin");
                setAuthError(null);
              }}
              className={
                sessionMode === "signin"
                  ? "rounded-full bg-zinc-100 px-4 py-1.5 text-xs font-medium text-zinc-950"
                  : "rounded-full px-4 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200"
              }
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => {
                setSessionMode("register");
                setAuthError(null);
              }}
              className={
                sessionMode === "register"
                  ? "rounded-full bg-zinc-100 px-4 py-1.5 text-xs font-medium text-zinc-950"
                  : "rounded-full px-4 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200"
              }
            >
              Register
            </button>
          </div>

          {sessionMode === "signin" ? (
            <LoginModule
              title="Session"
              submitLabel="Sign in"
              onSubmit={async (values) => {
                setAuthError(null);
                const res = await fetch("/api/auth/login", {
                  method: "POST",
                  ...bffCredentials,
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ email: values.email, password: values.password }),
                });
                const json = await res.json().catch(() => ({}));
                if (!res.ok) {
                  setAuthError(json.message || json.error || res.statusText);
                  return;
                }
                navigate("/dashboard", { replace: true });
              }}
            />
          ) : (
            <RegisterForm onError={setAuthError} />
          )}
          {authError ? (
            <p className="max-w-sm text-center text-sm text-red-400" role="alert">
              {authError}
            </p>
          ) : null}
        </div>

        <footer className="border-t border-zinc-800 pt-6 text-center text-sm text-zinc-500">
            <Link to="/terms" className="text-zinc-400 underline underline-offset-2 hover:text-zinc-200">
              Terms &amp; Conditions
            </Link>
            {" · "}
            <Link to="/nda" className="text-zinc-400 underline underline-offset-2 hover:text-zinc-200">
              NDAs
            </Link>
            {" · "}
            <Link to="/vault-pact" className="text-zinc-400 underline underline-offset-2 hover:text-zinc-200">
              Vault Pact
            </Link>
        </footer>
      </div>
    </div>
  );
}
