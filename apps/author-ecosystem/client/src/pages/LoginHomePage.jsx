import { useState } from "react";
import { Link } from "react-router-dom";
import { PlatformLoginMatrix } from "@elphie-syntax/ui/platform-login";
import "@elphie-syntax/ui/platform-login.css";

import { OperatorAdminLink } from "../components/OperatorAdminLink";
import { RegisterForm } from "../components/RegisterForm";
import { bffFetch, formatBffFetchError } from "../lib/bffFetch";

export default function LoginHomePage() {
  const [authError, setAuthError] = useState(/** @type {string | null} */ (null));
  const [sessionMode, setSessionMode] = useState(/** @type {"signin" | "register"} */ ("signin"));

  return (
    <div className="dark min-h-screen">
      <div className="flex justify-center gap-2 px-4 pt-8">
        <div className="inline-flex rounded-full border border-emerald-500/20 bg-[#120a21]/80 p-1">
          <button
            type="button"
            onClick={() => {
              setSessionMode("signin");
              setAuthError(null);
            }}
            className={
              sessionMode === "signin"
                ? "rounded-full bg-emerald-500/90 px-4 py-1.5 text-xs font-semibold text-[#02120e]"
                : "rounded-full px-4 py-1.5 text-xs font-medium text-[#c9c4bc] hover:text-[#f5f0e8]"
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
                ? "rounded-full bg-emerald-500/90 px-4 py-1.5 text-xs font-semibold text-[#02120e]"
                : "rounded-full px-4 py-1.5 text-xs font-medium text-[#c9c4bc] hover:text-[#f5f0e8]"
            }
          >
            Register (Author)
          </button>
        </div>
      </div>

      {sessionMode === "signin" ? (
        <PlatformLoginMatrix
          title="Elphie Syntax"
          subtitle="Sovereign ethical AI across Author, Education, and Gated AI"
          onSubmit={async (payload) => {
            setAuthError(null);
            try {
            const res = await bffFetch("/api/auth/login", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                email: payload.email,
                password: payload.password,
                platform: payload.platform,
                persona: payload.persona,
              }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
              setAuthError(json.message || json.error || res.statusText);
              return;
            }
            const redirect = typeof json.redirectUrl === "string" ? json.redirectUrl : "/home";
            window.location.assign(redirect);
            } catch (e) {
              setAuthError(formatBffFetchError(e, "/api/auth/login"));
            }
          }}
        />
      ) : (
        <div className="platform-login-root flex flex-col items-center px-4 py-10">
          <div className="platform-login-panel w-full max-w-lg rounded-2xl p-6 sm:p-8">
            <RegisterForm onError={setAuthError} />
          </div>
        </div>
      )}

      {authError ? (
        <p
          className="fixed bottom-20 left-1/2 z-50 max-w-md -translate-x-1/2 whitespace-pre-wrap rounded-lg border border-red-500/40 bg-[#120a21]/95 px-4 py-2 text-center text-xs text-red-300"
          role="alert"
        >
          {authError}
        </p>
      ) : null}

      <footer className="border-t border-emerald-900/30 bg-[#010a08]/80 py-6 text-center text-sm text-[#c9c4bc]">
        <Link to="/terms" className="text-emerald-400/80 underline underline-offset-2 hover:text-[#f5f0e8]">
          Terms &amp; Conditions
        </Link>
        {" · "}
        <Link to="/nda" className="text-emerald-400/80 underline underline-offset-2 hover:text-[#f5f0e8]">
          NDAs
        </Link>
        {" · "}
        <Link to="/vault-pact" className="text-emerald-400/80 underline underline-offset-2 hover:text-[#f5f0e8]">
          Vault Pact
        </Link>
        {" · "}
        <OperatorAdminLink className="text-violet-300/90 underline underline-offset-2 hover:text-violet-200" />
      </footer>
    </div>
  );
}
