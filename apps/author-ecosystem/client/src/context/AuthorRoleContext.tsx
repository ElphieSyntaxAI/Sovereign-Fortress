import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { bffAuthHeaders, bffCredentials, bffFetch, bffUrl } from "../lib/bffFetch";
import { getPreferredBffBearer } from "../lib/authAccessToken";
import { isAuthorFanHubEnabled, isAuthorHelperEnabled } from "../lib/postMvpGates";

/** Author-platform personas (BFF-switchable). Fan is UI-only until backend adds the slug. */
export const AUTHOR_ROLE_OPTIONS = [
  { id: "author", label: "Author" },
  { id: "editor", label: "Editor" },
  { id: "helper", label: "Helper" },
  { id: "publisher", label: "Publisher" },
  { id: "fan", label: "Fan & Chronicler" },
] as const;

export type AuthorRoleId = (typeof AUTHOR_ROLE_OPTIONS)[number]["id"];

export function visibleAuthorRoleOptions() {
  return AUTHOR_ROLE_OPTIONS.filter((r) => {
    if (r.id === "helper" && !isAuthorHelperEnabled()) return false;
    if (r.id === "fan" && !isAuthorFanHubEnabled()) return false;
    return true;
  });
}

export type AuthorSessionUser = {
  id: string;
  email?: string | null;
  persona: string;
  role: string;
  activated_personas: string[];
  is_platform_operator?: boolean;
};

type AuthorRoleContextValue = {
  user: AuthorSessionUser | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  switchPersona: (persona: AuthorRoleId) => Promise<{ ok: boolean; message?: string }>;
};

const AuthorRoleContext = createContext<AuthorRoleContextValue | null>(null);

export function AuthorRoleProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthorSessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const token = await getPreferredBffBearer();
      const res = await fetch(bffUrl("/api/auth/me"), {
        ...bffCredentials,
        headers: bffAuthHeaders(token),
      });
      const json = (await res.json().catch(() => ({}))) as {
        authenticated?: boolean;
        user?: {
          id?: string;
          email?: string;
          role?: string;
          persona?: string;
          activated_personas?: string[];
          is_platform_operator?: boolean;
        };
      };
      if (!res.ok || !json.authenticated || !json.user?.id) {
        setUser(null);
        return;
      }
      const persona = String(json.user.persona ?? json.user.role ?? "author").toLowerCase();
      const activated = Array.isArray(json.user.activated_personas)
        ? json.user.activated_personas.map((p) => String(p).toLowerCase())
        : [persona];
      setUser({
        id: json.user.id,
        email: json.user.email ?? null,
        persona,
        role: String(json.user.role ?? persona),
        activated_personas: activated.length ? activated : [persona],
        is_platform_operator: Boolean(json.user.is_platform_operator),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load session.");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const switchPersona = useCallback(
    async (persona: AuthorRoleId) => {
      if (persona === "fan") {
        return {
          ok: false,
          message: "Fan & Chronicler is not switchable yet — read the community terms at /terms/fan.",
        };
      }
      try {
        const res = await bffFetch("/api/auth/switch-persona", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ persona }),
        });
        const json = (await res.json().catch(() => ({}))) as {
          message?: string;
          user?: AuthorSessionUser;
        };
        if (!res.ok) {
          return { ok: false, message: json.message ?? res.statusText };
        }
        if (json.user) {
          setUser(json.user);
        } else {
          await refresh();
        }
        return { ok: true };
      } catch (e) {
        return {
          ok: false,
          message: e instanceof Error ? e.message : "Role switch failed.",
        };
      }
    },
    [refresh]
  );

  const value = useMemo(
    () => ({ user, loading, error, refresh, switchPersona }),
    [user, loading, error, refresh, switchPersona]
  );

  return <AuthorRoleContext.Provider value={value}>{children}</AuthorRoleContext.Provider>;
}

export function useAuthorRole() {
  const ctx = useContext(AuthorRoleContext);
  if (!ctx) {
    throw new Error("useAuthorRole must be used within AuthorRoleProvider");
  }
  return ctx;
}
