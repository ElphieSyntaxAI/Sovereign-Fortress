/**
 * Host-aware routing for the Author Vite app.
 * The platform hub ("What are you looking for?") is only for apex marketing hosts.
 * Local dev and authorecosystem.* should land on sign-in / workspace routes.
 */

export function isLocalAuthorDevHost(hostname) {
  const h = (
    hostname ?? (typeof window !== "undefined" ? window.location.hostname : "")
  ).toLowerCase();
  return h === "localhost" || h === "127.0.0.1";
}

export function isAuthorProductHost(hostname) {
  const h = (
    hostname ?? (typeof window !== "undefined" ? window.location.hostname : "")
  ).toLowerCase();
  return h === "authorecosystem.elphiesyntax.com";
}

export function isApexHubHost(hostname) {
  const h = (
    hostname ?? (typeof window !== "undefined" ? window.location.hostname : "")
  ).toLowerCase();
  return h === "elphiesyntax.com" || h === "www.elphiesyntax.com";
}

/** `/` on this host should redirect to author sign-in, not the platform chooser. */
export function shouldUseAuthorSignInAtRoot(hostname) {
  return isAuthorProductHost(hostname) || isLocalAuthorDevHost(hostname);
}

function authorHostFromEnv(envAuthorUrl) {
  return (envAuthorUrl ?? import.meta.env.VITE_AUTHOR_APP_URL ?? "").trim();
}

/**
 * Primary CTA for "Open Author Ecosystem" on the hub page.
 * Avoids linking to `/` on the same origin (hub loop in local dev).
 */
export function getAuthorPrimaryTarget(envAuthorUrl) {
  if (typeof window === "undefined") {
    const configured = authorHostFromEnv(envAuthorUrl);
    return configured
      ? { to: configured, external: true }
      : { to: "/sign-in", external: false };
  }

  if (shouldUseAuthorSignInAtRoot()) {
    return { to: "/sign-in", external: false };
  }

  const configured = authorHostFromEnv(envAuthorUrl);
  if (configured) {
    try {
      const target = new URL(configured, window.location.origin);
      const sameOrigin = target.origin === window.location.origin;
      if (sameOrigin) {
        const path =
          target.pathname === "/" || target.pathname === "" ? "/sign-in" : target.pathname;
        return { to: path, external: false };
      }
      return { to: target.href, external: true };
    } catch {
      /* fall through */
    }
  }

  if (isApexHubHost()) {
    return { to: "https://authorecosystem.elphiesyntax.com", external: true };
  }

  return { to: "/sign-in", external: false };
}
