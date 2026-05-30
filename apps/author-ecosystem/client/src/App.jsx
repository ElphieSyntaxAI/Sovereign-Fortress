import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import VaultProtector from "./components/VaultProtector";
import { RequireAuthorLens } from "./components/RequireAuthorLens";
import AuthorAppLayout from "./layouts/AuthorAppLayout";
import { isApexHubHost, shouldUseAuthorSignInAtRoot } from "./lib/authorHostRouting";

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
const AuthorHomePage = lazyPage(() => import("./pages/AuthorHomePage.tsx"), "home");
const ManuscriptsPage = lazyPage(() => import("./pages/ManuscriptsPage.tsx"), "manuscripts");
const WikiPage = lazyPage(() => import("./pages/WikiPage.tsx"), "wiki");
const OutlinePage = lazyPage(() => import("./pages/OutlinePage.tsx"), "outline");
const DraftingPage = lazyPage(() => import("./pages/DraftingPage.tsx"), "drafting");
const RevisionPage = lazyPage(() => import("./pages/RevisionPage.tsx"), "revision");
const EditorSuggestionsPage = lazyPage(
  () => import("./pages/EditorSuggestionsPage.tsx"),
  "editor-suggestions"
);
const CreativeGuildPage = lazyPage(() => import("./pages/CreativeGuildPage.tsx"), "guild");
const PublishingRequestsPage = lazyPage(
  () => import("./pages/PublishingRequestsPage.tsx"),
  "publishing-requests"
);
const FanManagementPage = lazyPage(
  () => import("./pages/FanManagementPage.tsx"),
  "fan-management"
);
const NotificationsPage = lazyPage(() => import("./pages/NotificationsPage.tsx"), "notifications");
const SettingsPage = lazyPage(() => import("./pages/SettingsPage.tsx"), "settings");
const AuthorAdminOverviewPage = lazyPage(
  () => import("./pages/admin/AuthorAdminOverviewPage.tsx"),
  "admin-overview"
);
const RoleWorkspaceHubPage = lazyPage(
  () => import("./pages/admin/RoleWorkspaceHubPage.tsx"),
  "role-workspace"
);
const GlobalAdminSettingsPage = lazyPage(
  () => import("./pages/admin/GlobalAdminSettingsPage.tsx"),
  "admin-settings"
);
const AuthorAdminOpsPage = lazyPage(
  () => import("./pages/admin/AuthorAdminOpsPage.tsx"),
  "admin-ops"
);
const TermsPage = lazyPage(() => import("./pages/TermsPage"), "terms");
const NdaPage = lazyPage(() => import("./pages/NdaPage"), "nda");
const VaultPactPage = lazyPage(() => import("./pages/VaultPactPage"), "vault-pact");
const AdminSignInRedirectPage = lazyPage(
  () => import("./pages/AdminSignInRedirectPage.jsx"),
  "admin-sign-in"
);
const AdminPortalRedirectPage = lazyPage(
  () => import("./pages/AdminPortalRedirectPage.jsx"),
  "admin-portal"
);

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

function HomeRoute() {
  if (shouldUseAuthorSignInAtRoot()) {
    return <Navigate to="/sign-in" replace />;
  }
  if (isApexHubHost()) {
    return <PlatformHubPage />;
  }
  return <Navigate to="/sign-in" replace />;
}

export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/" element={<HomeRoute />} />
        <Route path="/sign-in" element={<LoginHomePage />} />
        <Route path="/login" element={<Navigate to="/sign-in" replace />} />
        <Route path="/auth/callback" element={<AuthCallbackRedirectPage />} />
        <Route path="/admin/sign-in" element={<AdminSignInRedirectPage />} />
        <Route path="/admin/portal" element={<AdminPortalRedirectPage />} />
        <Route path="/admin" element={<Navigate to="/admin/sign-in" replace />} />
        <Route
          element={
            <VaultProtector>
              <AuthorAppLayout />
            </VaultProtector>
          }
        >
          <Route path="/home" element={<AuthorHomePage />} />
          <Route path="/admin" element={<AuthorAdminOverviewPage />} />
          <Route path="/admin/ops" element={<AuthorAdminOpsPage />} />
          <Route path="/admin/workspace/:roleId" element={<RoleWorkspaceHubPage />} />
          <Route path="/admin/settings" element={<GlobalAdminSettingsPage />} />
          <Route
            path="/admin/notifications"
            element={
              <RequireAuthorLens lens="creative">
                <NotificationsPage />
              </RequireAuthorLens>
            }
          />
          <Route path="/manuscripts" element={<ManuscriptsPage />} />
          <Route
            path="/wiki"
            element={
              <RequireAuthorLens lens="creative">
                <WikiPage />
              </RequireAuthorLens>
            }
          />
          <Route
            path="/outline"
            element={
              <RequireAuthorLens lens="creative">
                <OutlinePage />
              </RequireAuthorLens>
            }
          />
          <Route
            path="/drafting"
            element={
              <RequireAuthorLens lens="creative">
                <DraftingPage />
              </RequireAuthorLens>
            }
          />
          <Route
            path="/revision"
            element={
              <RequireAuthorLens lens="creative">
                <RevisionPage />
              </RequireAuthorLens>
            }
          />
          <Route
            path="/editor-suggestions"
            element={
              <RequireAuthorLens lens="creative">
                <EditorSuggestionsPage />
              </RequireAuthorLens>
            }
          />
          <Route
            path="/notifications"
            element={
              <RequireAuthorLens lens="creative">
                <NotificationsPage />
              </RequireAuthorLens>
            }
          />
          <Route
            path="/settings"
            element={
              <RequireAuthorLens lens="creative">
                <SettingsPage />
              </RequireAuthorLens>
            }
          />
          <Route
            path="/guild"
            element={
              <RequireAuthorLens lens="business">
                <CreativeGuildPage />
              </RequireAuthorLens>
            }
          />
          <Route
            path="/fan-management"
            element={
              <RequireAuthorLens lens="business">
                <FanManagementPage />
              </RequireAuthorLens>
            }
          />
          <Route
            path="/publishing-requests"
            element={
              <RequireAuthorLens lens="business">
                <PublishingRequestsPage />
              </RequireAuthorLens>
            }
          />
          <Route path="/dashboard" element={<Navigate to="/home" replace />} />
          <Route path="/analytics" element={<Navigate to="/publishing-requests" replace />} />
        </Route>
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
