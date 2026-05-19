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
 * Distribution Build ID: MSGF-ee924ab-20260518T235305Z-internal
 */
import { getJiraEnv, jiraBasicAuthHeader, type JiraEnv } from "@/lib/jira-env";
import { jiraBridgeRequestHeaders } from "@/lib/jira-bridge";

const JSON_HEADERS = {
  Accept: "application/json",
  "Content-Type": "application/json",
} as const;

function baseUrl(env: JiraEnv): string {
  return `https://${env.domain}`;
}

function authHeaders(env: JiraEnv): HeadersInit {
  return {
    Authorization: jiraBasicAuthHeader(env),
    ...jiraBridgeRequestHeaders(),
    ...JSON_HEADERS,
  };
}

export type JiraMyself = {
  accountId: string;
  displayName?: string;
  emailAddress?: string;
};

/** Some sites return 401 on /myself even when Basic + token works for issue APIs — optional. */
export async function jiraGetMyself(env: JiraEnv): Promise<JiraMyself | null> {
  const res = await fetch(`${baseUrl(env)}/rest/api/3/myself`, {
    method: "GET",
    headers: authHeaders(env),
  });
  if (!res.ok) return null;
  return (await res.json()) as JiraMyself;
}

export type JiraServerInfo = { serverTitle?: string; version?: string };

export async function jiraGetServerInfo(env: JiraEnv): Promise<JiraServerInfo> {
  const res = await fetch(`${baseUrl(env)}/rest/api/3/serverInfo`, {
    method: "GET",
    headers: {
      Authorization: jiraBasicAuthHeader(env),
      Accept: "application/json",
      ...jiraBridgeRequestHeaders(),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Jira serverInfo: ${res.status} ${text.slice(0, 200)}`);
  }
  return (await res.json()) as JiraServerInfo;
}

export type JiraProject = { id: string; key: string; name: string };

export async function jiraGetProject(env: JiraEnv, projectKey: string): Promise<JiraProject> {
  const res = await fetch(`${baseUrl(env)}/rest/api/3/project/${encodeURIComponent(projectKey)}`, {
    method: "GET",
    headers: authHeaders(env),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Jira project ${projectKey}: ${res.status} ${text.slice(0, 200)}`);
  }
  return (await res.json()) as JiraProject;
}

export type JiraSearchIssue = {
  id: string;
  key: string;
  fields?: { summary?: string; issuetype?: { name?: string } };
};

export type JiraSearchResult = {
  issues: JiraSearchIssue[];
};

/**
 * Jira Cloud enhanced JQL search (POST /rest/api/3/search/jql).
 */
export async function jiraSearchByJql(
  env: JiraEnv,
  jql: string,
  maxResults = 25,
  fields: string[] = ["summary", "issuetype"]
): Promise<JiraSearchResult> {
  const res = await fetch(`${baseUrl(env)}/rest/api/3/search/jql`, {
    method: "POST",
    headers: authHeaders(env),
    body: JSON.stringify({ jql, maxResults, fields }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Jira search failed: ${res.status} ${text.slice(0, 300)}`);
  }
  const data = (await res.json()) as { issues?: JiraSearchIssue[] };
  return { issues: data.issues ?? [] };
}

export function requireJiraEnv(): JiraEnv {
  const env = getJiraEnv();
  if (!env) {
    throw new Error("Missing JIRA_DOMAIN, JIRA_EMAIL, or JIRA_API_TOKEN");
  }
  return env;
}
