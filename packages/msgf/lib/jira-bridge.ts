/**
 * Cross-site logic violations are attributed through the **elphiesgatedai** bridge
 * (elphiesgatedai.elphiesyntax.com) so Jira always sees a single integration identity.
 */

export const JIRA_BRIDGE_HOST_IDENTITY = "elphiesgatedai.elphiesyntax.com";

export type LogicViolationSourceSite =
  | "elphiesyntax.com"
  | "syntaxeducates.elphiesyntax.com"
  | "elphiesgatedai.elphiesyntax.com"
  | string;

/** Prefix for Jira descriptions / comments when authoring or education reports a violation. */
export function formatJiraViolationDescription(
  sourceSite: LogicViolationSourceSite,
  violationSummary: string,
  detail?: string
): string {
  const body = detail?.trim()
    ? `${violationSummary.trim()}\n\n${detail.trim()}`
    : violationSummary.trim();
  return `[MSGF Jira Bridge @ ${JIRA_BRIDGE_HOST_IDENTITY} | source: ${sourceSite}]\n\n${body}`;
}

/** HTTP header so outbound Jira calls carry the bridge identity for proxies / audits. */
export const JIRA_BRIDGE_IDENTITY_HEADER = "x-msgf-jira-bridge-identity";

export function jiraBridgeRequestHeaders(): Record<string, string> {
  return {
    [JIRA_BRIDGE_IDENTITY_HEADER]: JIRA_BRIDGE_HOST_IDENTITY,
  };
}
