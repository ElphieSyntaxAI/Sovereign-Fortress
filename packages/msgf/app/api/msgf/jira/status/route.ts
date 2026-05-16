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
 * Distribution Build ID: MSGF-51d39b5-20260516T031044Z-internal
 */
import { NextResponse } from "next/server";

import {
  jiraGetMyself,
  jiraGetProject,
  jiraGetServerInfo,
  jiraSearchByJql,
  requireJiraEnv,
} from "@/lib/jira-client";

/**
 * GET — verifies `packages/msgf/.env` Jira credentials (Basic + bridge header).
 * Does not return tokens or raw API tokens.
 */
export async function GET() {
  try {
    const env = requireJiraEnv();
    const serverMeta = await jiraGetServerInfo(env);
    const me = await jiraGetMyself(env);

    let projectName: string | null = null;
    let projectKeyWarning: string | null = null;
    let effectiveProjectKey = env.projectKey ?? null;

    if (env.projectKey) {
      try {
        const p = await jiraGetProject(env, env.projectKey);
        projectName = p.name;
      } catch {
        projectKeyWarning = `Jira project key "${env.projectKey}" was not found; credentials still work for other APIs.`;
        effectiveProjectKey = null;
      }
    }

    let projectIssueSample: { key: string; summary?: string } | null = null;
    if (effectiveProjectKey) {
      const search = await jiraSearchByJql(
        env,
        `project = ${effectiveProjectKey} ORDER BY updated DESC`,
        1,
        ["summary"]
      );
      const first = search.issues[0];
      if (first) {
        projectIssueSample = {
          key: first.key,
          summary: first.fields?.summary,
        };
      }
    }

    return NextResponse.json({
      ok: true,
      jira: {
        domain: env.domain,
        site: {
          title: serverMeta.serverTitle ?? null,
          version: serverMeta.version ?? null,
        },
        projectKey: env.projectKey ?? null,
        projectName,
        projectKeyWarning,
        connectedAs: me
          ? {
              accountId: me.accountId,
              displayName: me.displayName ?? null,
              emailAddress: me.emailAddress ?? null,
            }
          : null,
        projectIssueSample,
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Jira status failed";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
