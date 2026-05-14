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
