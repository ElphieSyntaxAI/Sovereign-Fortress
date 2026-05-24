import { useEffect, useState } from "react";

import { LoginModule, PillarBadge } from "@elphie-syntax/ui";

import { AdminPortalRedirectPage } from "./pages/AdminPortalRedirectPage";
import { AdminSignInRedirectPage } from "./pages/AdminSignInRedirectPage";
import { AuthCallbackRedirectPage } from "./pages/AuthCallbackRedirectPage";
import { SandboxPage } from "./pages/SandboxPage";
import { TeacherDashboardPage } from "./pages/TeacherDashboardPage";

type View =
  | "login"
  | "sandbox"
  | "teacher"
  | "admin-sign-in"
  | "admin-portal"
  | "auth-callback";

/**
 * Resolves the SPA view from the current URL path so the LTI launch controller can
 * redirect to `{EDUCATION_APP_URL}/sandbox` or `{EDUCATION_APP_URL}/teacher` and land
 * users in the correct view.
 *
 * @see packages/msgf/lib/services/education-lti-controller.ts
 */
function viewFromPath(pathname: string): View {
  const segment = pathname.replace(/^\/+/, "").split("/")[0]?.toLowerCase() ?? "";
  if (segment === "teacher") return "teacher";
  if (segment === "sandbox") return "sandbox";
  if (segment === "login") return "login";
  if (segment === "auth") {
    const sub = pathname.replace(/^\/+/, "").split("/")[1]?.toLowerCase();
    if (sub === "callback") return "auth-callback";
  }
  if (segment === "admin") {
    const sub = pathname.replace(/^\/+/, "").split("/")[1]?.toLowerCase();
    if (sub === "portal") return "admin-portal";
    return "admin-sign-in";
  }
  return "sandbox";
}

function pathForView(view: View): string {
  switch (view) {
    case "teacher":
      return "/teacher";
    case "login":
      return "/login";
    case "admin-sign-in":
      return "/admin/sign-in";
    case "admin-portal":
      return "/admin/portal";
    case "auth-callback":
      return "/auth/callback";
    default:
      return "/sandbox";
  }
}

export default function App() {
  const [view, setView] = useState<View>(() =>
    typeof window === "undefined" ? "sandbox" : viewFromPath(window.location.pathname)
  );

  useEffect(() => {
    function onPopState() {
      setView(viewFromPath(window.location.pathname));
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function navigate(next: View) {
    setView(next);
    const path = pathForView(next);
    if (typeof window !== "undefined" && window.location.pathname !== path) {
      window.history.pushState({}, "", path);
    }
  }

  const isFullBleed =
    view === "admin-sign-in" || view === "admin-portal" || view === "auth-callback";

  return (
    <div className="dark min-h-screen bg-zinc-950 text-zinc-100">
      {!isFullBleed ? (
        <nav className="flex flex-wrap gap-4 border-b border-zinc-800 px-6 py-3 text-sm">
          <button
            type="button"
            className={view === "login" ? "text-emerald-400" : "text-zinc-500"}
            onClick={() => navigate("login")}
          >
            Login
          </button>
          <button
            type="button"
            className={view === "sandbox" ? "text-emerald-400" : "text-zinc-500"}
            onClick={() => navigate("sandbox")}
          >
            Sandbox
          </button>
          <button
            type="button"
            className={view === "teacher" ? "text-emerald-400" : "text-zinc-500"}
            onClick={() => navigate("teacher")}
          >
            Teacher
          </button>
          <button
            type="button"
            className={
              view === "admin-sign-in" || view === "admin-portal"
                ? "text-amber-400"
                : "text-zinc-500"
            }
            onClick={() => navigate("admin-sign-in")}
          >
            Operator admin
          </button>
        </nav>
      ) : null}

      {view === "sandbox" && <SandboxPage />}
      {view === "teacher" && <TeacherDashboardPage />}
      {view === "login" && (
        <div className="p-8">
          <h1 className="mb-6 text-xl font-semibold">Syntax Educates</h1>
          <PillarBadge lineageLabel="P4" pillar="P4" />
          <div className="mt-8 flex justify-center">
            <LoginModule
              title="Educator login"
              onSubmit={(v) => console.log("login", v.email)}
            />
          </div>
          <p className="mt-8 text-center text-xs text-zinc-500">
            Platform operators:{" "}
            <button
              type="button"
              className="text-amber-300/90 underline hover:text-amber-200"
              onClick={() => navigate("admin-sign-in")}
            >
              sign in via MSGF
            </button>
          </p>
        </div>
      )}
      {view === "admin-sign-in" && <AdminSignInRedirectPage />}
      {view === "admin-portal" && <AdminPortalRedirectPage />}
      {view === "auth-callback" && <AuthCallbackRedirectPage />}
    </div>
  );
}
