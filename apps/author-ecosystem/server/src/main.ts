import { loadMonorepoRootEnv } from "./lib/database/loadRootEnv.js";

loadMonorepoRootEnv();

import cors from "cors";
import express from "express";
import type { Request } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";

import { authSessionBridgeController } from "./controllers/authSessionBridge.controller.js";
import { dashboardController } from "./controllers/dashboard.controller.js";
import { halController } from "./controllers/hal.controller.js";
import { legalNdaController } from "./controllers/legalNda.controller.js";
import { legalTermsController } from "./controllers/legalTerms.controller.js";
import { ingestUploadController } from "./controllers/ingestUpload.controller.js";
import { librarianController } from "./controllers/librarian.controller.js";
import { manuscriptController } from "./controllers/manuscript.controller.js";
import { manuscriptsController } from "./controllers/manuscripts.controller.js";
import { plotSandboxController } from "./controllers/plotSandbox.controller.js";
import { projectSyncController } from "./controllers/projectSync.controller.js";
import { recalibrationController } from "./controllers/recalibration.controller.js";
import { pactGuard } from "./middleware/pactGuard.js";
import { revisionGateRouter } from "./middleware/RevisionGateMiddleware.js";
import { rootController } from "./controllers/root.controller.js";
import { buildBffCorsOptions } from "./lib/corsConfig.js";
import { getJwtFromRequest } from "./lib/bffAuthCookies.js";
import { resolveLegacyExpressBaseUrl } from "./lib/legacyInternalUrl.js";

const app = express();
const port = Number(process.env.PORT) || 3002;

app.use(cors(buildBffCorsOptions()));
app.use((req, res, next) => {
  if (req.path.startsWith("/api/rag") || req.path.startsWith("/api/lore-git")) {
    return next();
  }
  return express.json({ limit: "2mb" })(req, res, next);
});

app.use(pactGuard);

/**
 * Auth: BFF bridges to legacy **internal** `/api/auth/*` (loopback), sets httpOnly `author_bff_jwt`,
 * and omits `token` from JSON so clients are not encouraged to store JWT in localStorage.
 */
app.use("/api/auth", authSessionBridgeController);
app.use(legalTermsController);
app.use(legalNdaController);
app.use(manuscriptsController);
app.use(manuscriptController);

const legacyBaseUrl = resolveLegacyExpressBaseUrl();
if (process.env.DISABLE_LEGACY_RAG_PROXY !== "true") {
  const legacyProxy = createProxyMiddleware({
    target: legacyBaseUrl,
    changeOrigin: true,
    on: {
      proxyReq(proxyReq, req) {
        const token = getJwtFromRequest(req as Request);
        if (token) {
          proxyReq.setHeader("Authorization", `Bearer ${token}`);
        }
      },
    },
  });
  app.use("/api/rag", legacyProxy);
  app.use("/api/lore-git", legacyProxy);
  console.log(`[bff] internal proxy /api/rag, /api/lore-git -> ${legacyBaseUrl} (server-to-server; do not expose legacy port publicly)`);
}

app.use(rootController);
app.use(dashboardController);
app.use(halController);
app.use(librarianController);
app.use(ingestUploadController);
app.use(revisionGateRouter);
app.use(recalibrationController);

app.use(projectSyncController);
app.use(plotSandboxController);
app.listen(port, "127.0.0.1", () => {
  console.log(`author-ecosystem server listening on http://127.0.0.1:${port}`);
});
