/**
 * Server-side Jira credentials from `packages/msgf/.env` (or `.env.local`).
 * Next loads these automatically; scripts should use dotenv on `path.join(cwd, ".env")`.
 */
export type JiraEnv = {
  domain: string;
  email: string;
  apiToken: string;
  projectKey: string | undefined;
};

export function getJiraEnv(): JiraEnv | null {
  const rawDomain = process.env.JIRA_DOMAIN?.trim();
  const email = process.env.JIRA_EMAIL?.trim();
  const apiToken = process.env.JIRA_API_TOKEN?.trim();
  const projectKey = process.env.JIRA_PROJECT_KEY?.trim() || undefined;

  if (!rawDomain || !email || !apiToken) return null;

  const domain = rawDomain
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");

  return { domain, email, apiToken, projectKey };
}

export function jiraBasicAuthHeader(env: JiraEnv): string {
  const raw = `${env.email}:${env.apiToken}`;
  return `Basic ${Buffer.from(raw, "utf8").toString("base64")}`;
}
