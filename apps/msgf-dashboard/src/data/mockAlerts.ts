import { formatJiraViolationDescription } from "@msgf/lib/jira-bridge";

export type LogicAlert = {
  id: string;
  summary: string;
  description: string;
  reportedAt: string;
  /** Echo of inbound `x-msgf-jira-bridge-identity` when the webhook stored it */
  bridgeIdentityHeader?: string;
};

function desc(source: string, body: string) {
  return formatJiraViolationDescription(source, "Logic conflict", body);
}

export const MOCK_LOGIC_ALERTS: LogicAlert[] = [
  {
    id: "AL-1001",
    summary: "HAL tie — education stream",
    description: desc(
      "syntaxeducates.elphiesyntax.com",
      "Gemini vs Claude disagree on chunk 3; HAL 62."
    ),
    reportedAt: new Date(Date.now() - 3600_000).toISOString(),
    bridgeIdentityHeader: "elphiesgatedai.elphiesyntax.com",
  },
  {
    id: "AL-1002",
    summary: "Shadow RED — authoring",
    description: desc(
      "elphiesyntax.com",
      "Preflight matched Hall lineage label hall.test_forced."
    ),
    reportedAt: new Date(Date.now() - 7200_000).toISOString(),
    bridgeIdentityHeader: "elphiesgatedai.elphiesyntax.com",
  },
  {
    id: "AL-1003",
    summary: "Legacy client (no bridge header)",
    description:
      "Old integration without bridge prefix — should be hidden when bridge-only filter is on.",
    reportedAt: new Date(Date.now() - 86_400_000).toISOString(),
  },
];
