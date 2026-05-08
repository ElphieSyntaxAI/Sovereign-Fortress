export { PillarBadge, type PillarBadgeProps } from "./components/PillarBadge";
export {
  ConsensusView,
  type ConsensusModelPanel,
  type ConsensusViewProps,
} from "./components/ConsensusView";
export {
  LoginModule,
  type LoginFormValues,
  type LoginModuleProps,
} from "./components/LoginModule";
export { cn } from "./lib/cn";
export { pillarFromLineageLabel, type PillarId } from "./lib/lineage";
export { BugReporter, type BugReporterProps } from "./components/BugReporter";
export {
  UniversalCalibrationUI,
  type UniversalCalibrationRole,
  type UniversalCalibrationUIProps,
} from "./components/UniversalCalibrationUI";
export {
  ForensicAuditReport,
  type ForensicAuditReportProps,
} from "./components/ForensicAuditReport";
export {
  LibrarianTerminal,
  type LibrarianLanguageCode,
  type LibrarianRetrievedChunk,
  type LibrarianTerminalProps,
} from "./components/LibrarianTerminal";
export { postHalSession, postLibrarianAsk } from "./lib/librarianClient";
export type {
  HalSessionBody,
  HalSessionSuccess,
  LibrarianAskBody,
  LibrarianAskSuccess,
} from "./lib/librarianApiTypes";
export {
  classifyLibrarianBulletLine,
  extractChunkIdFromLibrarianLine,
  stripLeadingBulletMarkers,
  type LibrarianBulletKind,
} from "./lib/librarianBulletKind";
export {
  UniversalForensicCalibration,
  deriveKeydownFlightLatenciesMs,
  type ForensicTenantType,
  type KeystrokeDna,
  type KeystrokeDnaEvent,
  type UniversalForensicCalibrationPayload,
  type UniversalForensicCalibrationProps,
} from "./components/UniversalForensicCalibration";
export {
  DashboardRouter,
  type DashboardMode,
  type DashboardRouterProps,
  type DashboardViewPayload,
} from "./components/DashboardRouter";
export { MarketingLogForm, type MarketingLogFormProps } from "./components/MarketingLogForm";
export {
  EditorForensicView,
  type ChapterHealth,
  type EditorForensicViewProps,
  type HalLatencyPoint,
  type LoreBreachMarker,
} from "./components/EditorForensicView";
