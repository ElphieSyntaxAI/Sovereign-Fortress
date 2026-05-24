import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  AUTHOR_LENS_META,
  lensForPath,
  parseAuthorWorkspaceLens,
  readStoredAuthorLens,
  storeAuthorLens,
  type AuthorWorkspaceLens,
} from "../lib/authorWorkspaceLens";

type AuthorWorkspaceLensContextValue = {
  lens: AuthorWorkspaceLens;
  setLens: (next: AuthorWorkspaceLens, options?: { navigate?: boolean }) => void;
  toggleLens: () => void;
  meta: (typeof AUTHOR_LENS_META)[AuthorWorkspaceLens];
};

const AuthorWorkspaceLensContext = createContext<AuthorWorkspaceLensContextValue | null>(null);

export function AuthorWorkspaceLensProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [lens, setLensState] = useState<AuthorWorkspaceLens>(() => readStoredAuthorLens());

  useEffect(() => {
    const fromPath = lensForPath(location.pathname);
    if (fromPath && fromPath !== lens) {
      setLensState(fromPath);
      storeAuthorLens(fromPath);
    }
  }, [location.pathname, lens]);

  const setLens = useCallback(
    (next: AuthorWorkspaceLens, options?: { navigate?: boolean }) => {
      const parsed = parseAuthorWorkspaceLens(next);
      setLensState(parsed);
      storeAuthorLens(parsed);
      if (options?.navigate !== false) {
        const pathLens = lensForPath(location.pathname);
        if (pathLens && pathLens !== parsed) {
          navigate(AUTHOR_LENS_META[parsed].defaultPath, { replace: true });
        }
      }
    },
    [location.pathname, navigate]
  );

  const toggleLens = useCallback(() => {
    setLens(lens === "creative" ? "business" : "creative");
  }, [lens, setLens]);

  const value = useMemo(
    () => ({
      lens,
      setLens,
      toggleLens,
      meta: AUTHOR_LENS_META[lens],
    }),
    [lens, setLens, toggleLens]
  );

  return (
    <AuthorWorkspaceLensContext.Provider value={value}>{children}</AuthorWorkspaceLensContext.Provider>
  );
}

export function useAuthorWorkspaceLens() {
  const ctx = useContext(AuthorWorkspaceLensContext);
  if (!ctx) {
    throw new Error("useAuthorWorkspaceLens must be used within AuthorWorkspaceLensProvider");
  }
  return ctx;
}
