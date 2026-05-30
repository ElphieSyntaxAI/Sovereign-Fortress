/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * This source code and associated documentation are the exclusive property of
 * Elphie Syntax LLC. Unauthorized copying, distribution, publication, or
 * reverse-engineering — including decompilation, disassembly, or derivative
 * works — is strictly prohibited without prior written consent.
 *
 * Distribution Build ID: MSGF-48a02b8-20260530T050749Z-internal
 */
/**
 * Re-exports author-ecosystem **Sovereignty** and **Marketplace** modules for Next/msgf routes
 * (`externalDir` + `.js` → `.ts` resolution via `next.config.ts`).
 */

export {
  AuthorSovereigntyService,
  CooldownLockError,
  buildHumanAuthorshipCertificate,
  calculateCraftGrowth,
  craftGrowthSessionFromProfile,
  craftSessionFromStylometricSnapshot,
  exportHumanAuthorshipCertificateJson,
  exportHumanAuthorshipCertificatePdf,
  type CraftGrowthResult,
  type CraftGrowthSession,
  type HumanAuthorshipCertificate,
  type HumanAuthorshipCertificateSession,
  type P4HalLedgerCertificateRow,
  type RevisionCooldownLockRecord,
} from "../../../../apps/author-ecosystem/server/src/lib/AuthorSovereigntyService";

export {
  MarketplaceOrchestrator,
  type InterestMetrics,
  type MarketplaceHubVisibility,
  type MarketplaceInteractionType,
  type PublishingIntent,
} from "../../../../apps/author-ecosystem/server/src/lib/MarketplaceOrchestrator";

export type { P4ManuscriptRow } from "../../../../apps/author-ecosystem/server/src/lib/RevisionLockService";

export type { LibrarianLanguage } from "../../../../apps/author-ecosystem/server/src/lib/narrative/LibrarianChat";
