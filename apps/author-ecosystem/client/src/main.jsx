import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import "./index.css";
import App from "./App.jsx";
import { ClientErrorBoundary } from "./components/ClientErrorBoundary.tsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ClientErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ClientErrorBoundary>
  </StrictMode>
);
