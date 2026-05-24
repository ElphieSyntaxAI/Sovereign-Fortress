import { useState } from "react";
import { Link } from "react-router-dom";

import { BusinessCreativeToggle } from "../components/BusinessCreativeToggle";
import {
  AUTHOR_ROLE_OPTIONS,
  type AuthorRoleId,
  useAuthorRole,
} from "../context/AuthorRoleContext";
import { useAuthorWorkspaceLens } from "../context/AuthorWorkspaceLensContext";
import { bffFetch } from "../lib/bffFetch";
import { AUTHOR_LENS_META } from "../lib/authorWorkspaceLens";

export default function SettingsPage() {
  const { user, refresh } = useAuthorRole();
  const { lens, meta } = useAuthorWorkspaceLens();
  const [msg, setMsg] = useState<string | null>(null);

  const activated = new Set(user?.activated_personas ?? []);

  const activate = async (persona: AuthorRoleId) => {
    if (persona === "fan") {
      setMsg("Fan & Chronicler activation opens with community terms — see /terms/fan.");
      return;
    }
    try {
      const res = await bffFetch("/api/auth/activate-persona", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persona }),
      });
      const json = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        setMsg(json.message ?? "Activation failed.");
        return;
      }
      setMsg(`Activated ${persona} for this email.`);
      await refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Activation failed.");
    }
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-zinc-400">Account, roles, legal schedules, and session.</p>
      </header>

      {msg ? (
        <p className="rounded-lg border border-violet-500/30 bg-violet-950/30 px-3 py-2 text-sm text-violet-100">
          {msg}
        </p>
      ) : null}

      <section className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
        <h2 className="text-sm font-semibold text-zinc-100">Creative / Business lens</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Default workspace mode — {meta.description}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <BusinessCreativeToggle />
          <span className="text-xs text-zinc-500">
            Active: <span className="font-medium text-zinc-300">{meta.label}</span>
          </span>
        </div>
        <p className="mt-2 text-[10px] text-zinc-600">
          Creative → {AUTHOR_LENS_META.creative.defaultPath} · Business →{" "}
          {AUTHOR_LENS_META.business.defaultPath}
        </p>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
        <h2 className="text-sm font-semibold text-zinc-100">Roles on this email</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Activate schedules you have signed (author, editor, helper, publisher). Switch active role from the top
          nav.
        </p>
        <ul className="mt-4 space-y-2">
          {AUTHOR_ROLE_OPTIONS.filter((r) => r.id !== "fan").map((opt) => {
            const on = activated.has(opt.id);
            return (
              <li
                key={opt.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800/80 px-3 py-2"
              >
                <span className="text-sm text-zinc-200">{opt.label}</span>
                {on ? (
                  <span className="text-xs text-emerald-400">Active on account</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => void activate(opt.id)}
                    className="rounded-full border border-violet-500/40 px-3 py-1 text-xs text-violet-200 hover:bg-violet-950/40"
                  >
                    Activate role
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-xs text-zinc-600">
          New role?{" "}
          <Link to="/sign-in" className="text-violet-300 underline">
            Register
          </Link>{" "}
          with a different schedule or contact support to merge entitlements.
        </p>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
        <h2 className="text-sm font-semibold text-zinc-100">Legal & vault</h2>
        <ul className="mt-2 flex flex-wrap gap-3 text-sm">
          <Link to="/vault-pact" className="text-violet-300 underline underline-offset-2">
            Vault Pact
          </Link>
          <Link to="/terms" className="text-violet-300 underline underline-offset-2">
            Terms
          </Link>
          <Link to="/nda" className="text-violet-300 underline underline-offset-2">
            NDAs
          </Link>
        </ul>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
        <h2 className="text-sm font-semibold text-zinc-100">Session</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Signed in as {user?.email ?? user?.id ?? "—"} · current role{" "}
          <span className="font-mono text-zinc-300">{user?.persona}</span>
        </p>
      </section>
    </div>
  );
}
