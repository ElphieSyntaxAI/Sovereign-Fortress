import { Navigate, Route, Routes } from "react-router-dom";

import VaultProtector from "./components/VaultProtector";
import DashboardPage from "./pages/DashboardPage";
import LoginHomePage from "./pages/LoginHomePage";
import NdaPage from "./pages/NdaPage";
import TermsPage from "./pages/TermsPage";
import VaultPactPage from "./pages/VaultPactPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginHomePage />} />
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
