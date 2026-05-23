import { useEffect, useState } from "react";

/**
 * Supabase email-confirm / magic-link landing when the project Site URL is Author.
 * Forwards the PKCE `code` (and hash tokens) to MSGF `/auth/callback` so the session
 * is minted on elphiesgatedai.elphiesyntax.com (required for `/admin/sign-in`).
 */
function resolveMsgfOrigin() {
  const fromEnv = import.meta.env.VITE_MSGF_APP_URL?.trim()?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (typeof window !== "undefined") {
    const host = window.location.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1") {
      return "http://127.0.0.1:3001";
    }
  }
  return "https://elphiesgatedai.elphiesyntax.com";
}

function buildMsgfCallbackUrl() {
  const msgfOrigin = resolveMsgfOrigin();
  const params = new URLSearchParams(window.location.search);
  if (!params.has("next")) {
    const stored = sessionStorage.getItem("elphie_auth_callback_next");
    if (stored?.startsWith("/") && !stored.startsWith("//")) {
      params.set("next", stored);
    }
  }
  const qs = params.toString();
  const hash = window.location.hash || "";
  return `${msgfOrigin}/auth/callback${qs ? `?${qs}` : ""}${hash}`;
}

export default function AuthCallbackRedirectPage() {
  const [error, setError] = useState(/** @type {string | null} */ (null));

  useEffect(() => {
    try {
      const target = buildMsgfCallbackUrl();
      window.location.replace(target);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-zinc-950 p-8 text-zinc-100">
        <p className="text-sm text-red-300">Could not complete sign-in redirect: {error}</p>
        <a
          href="https://elphiesgatedai.elphiesyntax.com/admin/sign-in"
          className="text-sm text-emerald-400 underline"
        >
          Open MSGF admin sign-in
        </a>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center text-sm text-zinc-400"
      style={{ background: "#0a0612" }}
    >
      Completing sign-in on MSGF…
    </div>
  );
}
