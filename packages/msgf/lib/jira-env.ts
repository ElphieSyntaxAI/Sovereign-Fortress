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
 * Distribution Build ID: MSGF-a7aa881-20260620T084430Z-internal
 */
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
