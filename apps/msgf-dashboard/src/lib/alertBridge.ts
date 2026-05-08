import {
  JIRA_BRIDGE_HOST_IDENTITY,
  JIRA_BRIDGE_IDENTITY_HEADER,
} from "@msgf/lib/jira-bridge";

export { JIRA_BRIDGE_HOST_IDENTITY, JIRA_BRIDGE_IDENTITY_HEADER };

/** Parse `[MSGF Jira Bridge @ … | source: …]` from Jira description / webhook payload. */
export function parseBridgeAndSourceFromDescription(text: string): {
  bridgeHost: string | null;
  sourceHost: string | null;
} {
  const m = text.match(
    /\[MSGF Jira Bridge @\s*([^\s|]+)[^\]]*\|\s*source:\s*([^\]]+?)\s*\]/i
  );
  if (!m) return { bridgeHost: null, sourceHost: null };
  return {
    bridgeHost: m[1]?.trim() ?? null,
    sourceHost: m[2]?.trim() ?? null,
  };
}

/** Keep alerts that were filed through the canonical elphiesgatedai bridge identity. */
export function alertUsesCanonicalBridge(
  description: string,
  headerValue?: string | null
): boolean {
  if (headerValue?.trim() === JIRA_BRIDGE_HOST_IDENTITY) return true;
  const { bridgeHost } = parseBridgeAndSourceFromDescription(description);
  return bridgeHost === JIRA_BRIDGE_HOST_IDENTITY;
}

export function sourceDomainFromAlert(
  description: string,
  fallback?: string | null
): string | null {
  const { sourceHost } = parseBridgeAndSourceFromDescription(description);
  return sourceHost ?? fallback ?? null;
}
