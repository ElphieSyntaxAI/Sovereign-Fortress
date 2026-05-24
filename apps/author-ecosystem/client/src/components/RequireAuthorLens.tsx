import { useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { useAuthorWorkspaceLens } from "../context/AuthorWorkspaceLensContext";
import { AUTHOR_LENS_META, type AuthorWorkspaceLens } from "../lib/authorWorkspaceLens";

export function RequireAuthorLens({
  lens: required,
  children,
}: {
  lens: AuthorWorkspaceLens;
  children: ReactNode;
}) {
  const { lens, setLens } = useAuthorWorkspaceLens();
  const navigate = useNavigate();

  useEffect(() => {
    if (lens === required) return;
    setLens(required, { navigate: false });
    navigate(AUTHOR_LENS_META[required].defaultPath, { replace: true });
  }, [lens, required, setLens, navigate]);

  if (lens !== required) {
    return (
      <p className="text-sm text-zinc-500">
        Switching to {AUTHOR_LENS_META[required].label} view…
      </p>
    );
  }

  return children;
}
