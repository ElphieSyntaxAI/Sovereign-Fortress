import { Navigate, Route, Routes } from "react-router-dom";

import VaultProtector from "./components/VaultProtector";
import DashboardPage from "./pages/DashboardPage";
import LoginHomePage from "./pages/LoginHomePage";
import NdaPage from "./pages/NdaPage";
import PlatformHubPage from "./pages/PlatformHubPage";
import TermsPage from "./pages/TermsPage";
import VaultPactPage from "./pages/VaultPactPage";

export default function App() {
  return (
    <Routes>
      {/* elphiesyntax.com home — "What are you looking for?" chooser hub */}
      <Route path="/" element={<PlatformHubPage />} />

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
