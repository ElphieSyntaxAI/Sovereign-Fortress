import { loadMonorepoRootEnv } from "./lib/database/loadRootEnv.js";
import { assertBffRequiredEnv } from "./lib/assertBffRequiredEnv.js";
import cors from "cors";
import express from "express";

import { authSessionBridgeController } from "./controllers/authSessionBridge.controller.js";
import { dashboardController } from "./controllers/dashboard.controller.js";
import { halController } from "./controllers/hal.controller.js";
import { legalNdaController } from "./controllers/legalNda.controller.js";
import { legalTermsController } from "./controllers/legalTerms.controller.js";
import { ingestUploadController } from "./controllers/ingestUpload.controller.js";
import { librarianController } from "./controllers/librarian.controller.js";
import { manuscriptController } from "./controllers/manuscript.controller.js";
import { fanHubController } from "./controllers/fanHub.controller.js";
import { fanManagementController } from "./controllers/fanManagement.controller.js";
import { googleOAuthController } from "./controllers/googleOAuth.controller.js";
import { linkSessionController } from "./controllers/linkSession.controller.js";
import { manuscriptsController } from "./controllers/manuscripts.controller.js";
import { wikiController } from "./controllers/wiki.controller.js";
import { wikiEntriesController } from "./controllers/wikiEntries.controller.js";
import { p4LoreRagController } from "./controllers/p4LoreRag.controller.js";
import { plotSandboxController } from "./controllers/plotSandbox.controller.js";
import { onboardingController } from "./controllers/onboarding.controller.js";
import { chapterFactsController } from "./controllers/chapterFacts.controller.js";
import { wikiLoreMergesController } from "./controllers/wikiLoreMerges.controller.js";
import { platformAdminController } from "./controllers/platformAdmin.controller.js";
import { projectSyncController } from "./controllers/projectSync.controller.js";
import { narrativeChunksController } from "./controllers/narrativeChunks.controller.js";
import { chunksController } from "./controllers/chunks.controller.js";
import { recalibrationController } from "./controllers/recalibration.controller.js";
import { pactGuard } from "./middleware/pactGuard.js";
import { revisionGateRouter } from "./middleware/RevisionGateMiddleware.js";
import { msgfHealthController } from "./controllers/msgfHealth.controller.js";
import { msgfPulseController } from "./controllers/msgfPulse.controller.js";
import { msgfSelfHealController } from "./controllers/msgfSelfHeal.controller.js";
import { msgfGovernanceController } from "./controllers/msgfGovernance.controller.js";
import { rootController } from "./controllers/root.controller.js";
import { buildBffCorsOptions } from "./lib/corsConfig.js";
import { bffAuthMiddleware } from "./lib/resolveBffAuthUser.js";

loadMonorepoRootEnv();
assertBffRequiredEnv();

const app = express();
const port = Number(process.env.PORT) || 3002;

app.use(cors(buildBffCorsOptions()));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

app.use((req, res, next) => {
  void bffAuthMiddleware(req, res, next);
});

app.use(pactGuard);

/**
 * Auth: Supabase `@supabase/ssr` session cookies (+ optional `author_bff_jwt` mirror for API JWT checks).
 */
app.use("/api/auth", authSessionBridgeController);
app.use(legalTermsController);
app.use(legalNdaController);
app.use(manuscriptsController);
app.use(narrativeChunksController);
app.use(chunksController);
app.use(linkSessionController);
app.use(googleOAuthController);
app.use(wikiController);
app.use(wikiEntriesController);
app.use(wikiLoreMergesController);
app.use(chapterFactsController);
app.use(fanHubController);
app.use(fanManagementController);
app.use(manuscriptController);

app.use(p4LoreRagController);

app.use(rootController);
app.use(msgfHealthController);
app.use(msgfPulseController);
app.use(msgfSelfHealController);
app.use(msgfGovernanceController);
app.use(dashboardController);
app.use(halController);
app.use(librarianController);
app.use(ingestUploadController);
app.use(revisionGateRouter);
app.use(recalibrationController);

app.use(onboardingController);
app.use(platformAdminController);
app.use(projectSyncController);
app.use(plotSandboxController);
app.listen(port, "0.0.0.0", () => {
  console.log(`author-ecosystem server listening on http://0.0.0.0:${port}`);
});
