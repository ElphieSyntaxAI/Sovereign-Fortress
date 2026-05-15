import {
  MsgfSentinel,
  type MsgfSentinelReportSuccess,
  type MsgfSentinelTenantConfig,
} from "msgf/ui";
import { useCallback } from "react";

import { useNarrative } from "../context/NarrativeContext";
import { getAuthorMsgfBridge } from "../lib/authorMsgfBridge";
import { buildDiagnosticSnapshot } from "../lib/buildDiagnosticSnapshot";
import { getPreferredBffBearer } from "../lib/authAccessToken";
import { bffAuthHeaders } from "../lib/bffFetch";

const AUTHOR_SENTINEL_TENANT: MsgfSentinelTenantConfig = {
  productLabel: "Author",
  accentButtonClass: "bg-violet-600 hover:bg-violet-500",
  accentRingClass: "ring-violet-500/40 focus:border-violet-600 focus:ring-2",
  accentTextClass: "text-violet-300/90",
  fabIconClass: "text-violet-300 hover:text-violet-200",
  fabBorderHoverClass: "hover:border-violet-500/60",
};

/**
 * Author-themed Sentinel FAB — {@link MsgfBridge.reportSystemIssue} via BFF → MSGF self-heal.
 */
export function AuthorSentinelBugButton() {
  const { selection } = useNarrative();

  const collectDiagnosticSnapshot = useCallback(async () => {
    const token = await getPreferredBffBearer();
    const base = await buildDiagnosticSnapshot({
      selection,
      getAccessToken: () => token,
    });
    const bridge = getAuthorMsgfBridge();
    const telemetry = bridge.bundleSentinelTelemetry(base.keystrokes_last_10);
    return {
      ...base,
      local_storage: telemetry.local_storage,
      biometric_telemetry: telemetry.biometric_telemetry,
      keystrokes_last_10: telemetry.biometric_telemetry.keystrokes_last_10,
    };
  }, [selection]);

  const submitReport = useCallback(
    async (operatorNote: string): Promise<MsgfSentinelReportSuccess> => {
      const token = await getPreferredBffBearer();
      const snapshot = await collectDiagnosticSnapshot();
      const bridge = getAuthorMsgfBridge();

      const result = await bridge.reportSystemIssue({
        operatorNote,
        snapshot,
        reportEndpointUrl: "/api/msgf/self-heal/report",
        getAuthHeaders: () => bffAuthHeaders(token),
      });

      return {
        userMessage: result.userMessage,
        resumePrompt: result.resumePrompt,
        healedPillars: result.healedPillars,
        reasoningSummary: result.reasoningSummary,
        escalatedToArbitrate: result.escalatedToArbitrate,
        logicDrift: result.logicDrift,
      };
    },
    [collectDiagnosticSnapshot]
  );

  const getAuthHeaders = useCallback(async () => {
    const token = await getPreferredBffBearer();
    return bffAuthHeaders(token);
  }, []);

  return (
    <MsgfSentinel
      tenantConfig={AUTHOR_SENTINEL_TENANT}
      reportEndpointUrl="/api/msgf/self-heal/report"
      collectDiagnosticSnapshot={collectDiagnosticSnapshot}
      getAuthHeaders={getAuthHeaders}
      submitReport={submitReport}
    />
  );
}

/** @deprecated Use {@link AuthorSentinelBugButton} or {@link MsgfSentinel} with tenantConfig. */
export const SentinelAuthorButton = AuthorSentinelBugButton;
