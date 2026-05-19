import { useState } from "react";
import { Link } from "react-router-dom";
import { PlatformLoginMatrix } from "@elphie-syntax/ui";
import "@elphie-syntax/ui/platform-login.css";

import { bffCredentials } from "../lib/bffFetch";

export default function LoginHomePage() {
  const [authError, setAuthError] = useState(/** @type {string | null} */ (null));

  return (
    <div className="dark min-h-screen">
      <PlatformLoginMatrix
        title="Elphie Syntax"
        subtitle="Sovereign ethical AI across Author, Education, and Gated AI"
        onSubmit={async (payload) => {
          setAuthError(null);
          const res = await fetch("/api/auth/login", {
            method: "POST",
            ...bffCredentials,
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
          const redirect = typeof json.redirectUrl === "string" ? json.redirectUrl : null;
          if (redirect) {
            if (redirect.startsWith("http")) {
              window.location.assign(redirect);
            } else {
              window.location.assign(redirect);
            }
            return;
          }
          window.location.assign("/dashboard");
        }}
      />

      {authError ? (
        <p
          className="fixed bottom-6 left-1/2 z-50 max-w-sm -translate-x-1/2 rounded-lg border border-red-500/40 bg-[#120a21]/95 px-4 py-2 text-center text-sm text-red-300"
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
      </footer>
    </div>
  );
}
