import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import VaultProtector from "./components/VaultProtector";

/** Route-level code split — avoid loading dashboard/msgf on the hub and sign-in pages. */
function lazyPage(importer, label) {
  return lazy(() =>
    importer().catch((err) => {
      console.error(`[author-client] failed to load ${label}`, err);
      return {
        default: function PageLoadError() {
          return (
            <div className="min-h-screen bg-zinc-950 p-8 text-zinc-100">
              <h1 className="text-lg font-semibold text-red-300">Failed to load {label}</h1>
              <p className="mt-2 max-w-lg text-sm text-zinc-400">
                {err instanceof Error ? err.message : String(err)}
              </p>
              <p className="mt-4 text-xs text-zinc-500">
                Restart <code className="text-emerald-300">npm run dev:author-client</code> after pulling
                latest <code className="text-emerald-300">vite.config.js</code>.
              </p>
            </div>
          );
        },
      };
    })
  );
}

const PlatformHubPage = lazyPage(
  () => import("./pages/PlatformHubPage.jsx"),
  "home"
);
const LoginHomePage = lazyPage(() => import("./pages/LoginHomePage.jsx"), "sign-in");
const AuthCallbackRedirectPage = lazyPage(
  () => import("./pages/AuthCallbackRedirectPage.jsx"),
  "auth-callback"
);
const DashboardPage = lazyPage(() => import("./pages/DashboardPage.tsx"), "dashboard");
const TermsPage = lazyPage(() => import("./pages/TermsPage"), "terms");
const NdaPage = lazyPage(() => import("./pages/NdaPage"), "nda");
const VaultPactPage = lazyPage(() => import("./pages/VaultPactPage"), "vault-pact");

function PageFallback() {
  return (
    <div
      className="flex min-h-screen items-center justify-center text-sm text-zinc-400"
      style={{ background: "#0a0612" }}
    >
      Loading…
    </div>
  );
}

function isAuthorProductHost() {
  if (typeof window === "undefined") return false;
  return window.location.hostname.toLowerCase() === "authorecosystem.elphiesyntax.com";
}

function HomeRoute() {
  if (isAuthorProductHost()) {
    return <Navigate to="/sign-in" replace />;
  }
  return <PlatformHubPage />;
}

export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/" element={<HomeRoute />} />
        <Route path="/sign-in" element={<LoginHomePage />} />
        <Route path="/login" element={<Navigate to="/sign-in" replace />} />
        <Route path="/auth/callback" element={<AuthCallbackRedirectPage />} />
        <Route
          path="/dashboard"
          element={
            <VaultProtector>
              <DashboardPage />
            </VaultProtector>
          }
        />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/terms/:slug" element={<TermsPage />} />
        <Route path="/nda" element={<NdaPage />} />
        <Route path="/nda/:slug" element={<NdaPage />} />
        <Route path="/vault-pact" element={<VaultPactPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
