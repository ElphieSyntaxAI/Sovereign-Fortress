import { Navigate, Route, Routes } from "react-router-dom";

import VaultProtector from "./components/VaultProtector";
import DashboardPage from "./pages/DashboardPage";
import LoginHomePage from "./pages/LoginHomePage";
import NdaPage from "./pages/NdaPage";
import PlatformHubPage from "./pages/PlatformHubPage";
import TermsPage from "./pages/TermsPage";
import VaultPactPage from "./pages/VaultPactPage";

function isAuthorProductHost() {
  if (typeof window === "undefined") return false;
  return window.location.hostname.toLowerCase() === "authorecosystem.elphiesyntax.com";
}

function HomeRoute() {
  // The same bundle can be used for the apex/global hub during transition and
  // for the Author product subdomain once DNS is live. Keep Cloud Run/default
  // test URLs on the hub; make the product subdomain app-first.
  if (isAuthorProductHost()) {
    return <Navigate to="/sign-in" replace />;
  }
  return <PlatformHubPage />;
}

export default function App() {
  return (
    <Routes>
      {/* elphiesyntax.com/global test URLs — chooser hub; authorecosystem subdomain — app sign-in. */}
      <Route path="/" element={<HomeRoute />} />

      {/* Author sign-in / register (formerly hosted at /) */}
      <Route path="/sign-in" element={<LoginHomePage />} />
      <Route path="/login" element={<Navigate to="/sign-in" replace />} />

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
  );
}
