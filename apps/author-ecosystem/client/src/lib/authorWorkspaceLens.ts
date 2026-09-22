/** Creative Integrity Flywheel — protect/perfect the work vs grow the business. */
export type AuthorWorkspaceLens = "creative" | "business";

export const AUTHOR_LENS_STORAGE_KEY = "elphie_author_workspace_lens";

export const AUTHOR_LENS_META: Record<
  AuthorWorkspaceLens,
  { label: string; short: string; description: string; defaultPath: string }
> = {
  creative: {
    label: "Creative",
    short: "Create",
    description: "Manuscripts, outline, drafting, revision passes, and editor collaboration.",
    defaultPath: "/manuscripts",
  },
  business: {
    label: "Business",
    short: "Grow",
    description: "Publishing requests agents and publishers browse.",
    defaultPath: "/publishing-requests",
  },
};

const CREATIVE_PREFIXES = [
  "/wiki",
  "/outline",
  "/drafting",
  "/revision",
  "/editor-suggestions",
  "/dashboard",
] as const;

const BUSINESS_PREFIXES = ["/guild", "/fan-management", "/publishing-requests", "/analytics"] as const;

export const LENS_ONLY_ROUTES: Record<AuthorWorkspaceLens, readonly string[]> = {
  creative: [...CREATIVE_PREFIXES],
  business: [...BUSINESS_PREFIXES],
};

export function parseAuthorWorkspaceLens(raw: unknown): AuthorWorkspaceLens {
  return raw === "business" ? "business" : "creative";
}

export function readStoredAuthorLens(): AuthorWorkspaceLens {
  if (typeof window === "undefined") return "creative";
  try {
    return parseAuthorWorkspaceLens(localStorage.getItem(AUTHOR_LENS_STORAGE_KEY));
  } catch {
    return "creative";
  }
}

export function storeAuthorLens(lens: AuthorWorkspaceLens): void {
  try {
    localStorage.setItem(AUTHOR_LENS_STORAGE_KEY, lens);
  } catch {
    /* private mode */
  }
}

export function lensForPath(pathname: string): AuthorWorkspaceLens | null {
  if (BUSINESS_PREFIXES.some((p) => pathname.startsWith(p))) return "business";
  if (CREATIVE_PREFIXES.some((p) => pathname.startsWith(p))) return "creative";
  if (pathname.startsWith("/manuscripts")) return "creative";
  if (pathname.startsWith("/notifications")) return "creative";
  if (pathname.startsWith("/settings")) return "creative";
  return null;
}
