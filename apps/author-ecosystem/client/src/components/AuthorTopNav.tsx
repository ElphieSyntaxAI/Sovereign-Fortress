import { useCallback, useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";

import { ActiveManuscriptChip } from "./ActiveManuscriptChip";
import { BusinessCreativeToggle } from "./BusinessCreativeToggle";
import {
  AUTHOR_ROLE_OPTIONS,
  type AuthorRoleId,
  useAuthorRole,
} from "../context/AuthorRoleContext";
import { useAuthorWorkspaceLens } from "../context/AuthorWorkspaceLensContext";
import { navItemsForLens } from "../lib/authorNavConfig";
import { bffCredentials, bffUrl } from "../lib/bffFetch";

function useNavLinkClass() {
  const { lens } = useAuthorWorkspaceLens();
  return ({ isActive }: { isActive: boolean }) =>
    [
      "whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition",
      isActive && lens === "creative"
        ? "bg-violet-500/25 text-violet-100 ring-1 ring-violet-400/40"
        : "",
      isActive && lens === "business"
        ? "bg-amber-500/25 text-amber-100 ring-1 ring-amber-400/40"
        : "",
      !isActive ? "text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-100" : "",
    ].join(" ");
}

function isNavActive(pathname: string, to: string, matchPrefix?: string): boolean {
  if (pathname === to) return true;
  const prefix = matchPrefix ?? to;
  return prefix !== "/home" && pathname.startsWith(prefix);
}

export function AuthorTopNav() {
  const { user, loading, switchPersona } = useAuthorRole();
  const { lens, meta: lensMeta } = useAuthorWorkspaceLens();
  const location = useLocation();
  const navLinkClass = useNavLinkClass();
  const visibleNav = navItemsForLens(lens);
  const [roleOpen, setRoleOpen] = useState(false);
  const [roleMsg, setRoleMsg] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);
  const roleRef = useRef<HTMLDivElement>(null);

  const activePersona = (user?.persona ?? "author") as AuthorRoleId;
  const activeLabel =
    AUTHOR_ROLE_OPTIONS.find((r) => r.id === activePersona)?.label ?? "Author";

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (roleRef.current && !roleRef.current.contains(e.target as Node)) {
        setRoleOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const onPickRole = useCallback(
    async (id: AuthorRoleId) => {
      if (id === activePersona) {
        setRoleOpen(false);
        return;
      }
      setSwitching(true);
      setRoleMsg(null);
      const result = await switchPersona(id);
      setSwitching(false);
      if (!result.ok) {
        setRoleMsg(result.message ?? "Could not switch role.");
      } else {
        setRoleMsg(null);
        setRoleOpen(false);
      }
    },
    [activePersona, switchPersona]
  );

  const logout = async () => {
    try {
      const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
      const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
      if (url?.trim() && key?.trim()) {
        const { getSupabaseBrowserClient } = await import("../lib/supabaseBrowser");
        await getSupabaseBrowserClient().auth.signOut();
      }
    } catch {
      /* non-blocking */
    }
    await fetch(bffUrl("/api/auth/logout"), { method: "POST", ...bffCredentials });
    window.location.assign("/sign-in");
  };

  const roleButtonClass =
    lens === "business"
      ? "border-amber-500/35 bg-amber-950/40 text-amber-100 hover:border-amber-400/50"
      : "border-violet-500/35 bg-violet-950/40 text-violet-100 hover:border-violet-400/50";

  const brandClass =
    lens === "business"
      ? "text-amber-100 hover:text-amber-50"
      : "text-violet-100 hover:text-white";

  const headerBorder =
    lens === "business" ? "border-amber-500/15" : "border-violet-500/15";

  return (
    <header
      className={`sticky top-0 z-40 border-b bg-zinc-950/90 backdrop-blur-md ${headerBorder}`}
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
          <Link to="/home" className={`shrink-0 text-sm font-semibold tracking-tight ${brandClass}`}>
            Author
          </Link>

          <BusinessCreativeToggle />

          <ActiveManuscriptChip />

          <div className="relative" ref={roleRef}>
            <button
              type="button"
              disabled={loading || switching}
              onClick={() => setRoleOpen((o) => !o)}
              className={`inline-flex max-w-[11rem] items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${roleButtonClass}`}
              aria-expanded={roleOpen}
              aria-haspopup="listbox"
            >
              <span
                className={`text-[10px] uppercase tracking-wider ${lens === "business" ? "text-amber-300/80" : "text-violet-300/80"}`}
              >
                Role
              </span>
              <span className="truncate">{loading ? "…" : activeLabel}</span>
              <span aria-hidden>▾</span>
            </button>
            {roleOpen ? (
              <ul
                role="listbox"
                className="absolute left-0 top-full z-50 mt-1 min-w-[12rem] rounded-lg border border-zinc-700 bg-zinc-950 py-1 shadow-xl"
              >
                {AUTHOR_ROLE_OPTIONS.map((opt) => {
                  const activated =
                    user?.activated_personas?.includes(opt.id) ?? opt.id === activePersona;
                  const isActive = opt.id === activePersona;
                  return (
                    <li key={opt.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        disabled={switching || (opt.id !== "fan" && !activated)}
                        className={[
                          "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs",
                          isActive
                            ? lens === "business"
                              ? "bg-amber-500/20 text-amber-100"
                              : "bg-violet-500/20 text-violet-100"
                            : "text-zinc-200 hover:bg-zinc-900",
                          !activated && opt.id !== "fan" ? "cursor-not-allowed opacity-40" : "",
                        ].join(" ")}
                        onClick={() => void onPickRole(opt.id)}
                      >
                        <span>{opt.label}</span>
                        {isActive ? <span>✓</span> : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>

          {roleMsg ? (
            <p className="text-[10px] text-amber-300/90 sm:max-w-[10rem]">{roleMsg}</p>
          ) : null}
        </div>

        <nav
          className="flex items-center gap-1 overflow-x-auto pb-0.5"
          aria-label={`Author — ${lensMeta.label} lens`}
        >
          {visibleNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={() =>
                navLinkClass({ isActive: isNavActive(location.pathname, item.to, item.matchPrefix) })
              }
            >
              {item.label}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => void logout()}
            className="ml-1 whitespace-nowrap rounded-full border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
          >
            Sign out
          </button>
        </nav>
      </div>
    </header>
  );
}
