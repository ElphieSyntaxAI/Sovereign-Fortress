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
 * Distribution Build ID: MSGF-463028d-20260519T150411Z-internal
 */
/**
 * Jira connectivity: validates credentials (project GET or JQL search), then optional Epic check.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
require("dotenv").config({ path: path.join(root, ".env") });
require("dotenv").config({ path: path.join(root, ".msgf", ".env") });

const EPIC_SUMMARY = "[APP] Author Ecosystem";

const JIRA_BRIDGE_HOST_IDENTITY = "elphiesgatedai.elphiesyntax.com";
const JIRA_BRIDGE_IDENTITY_HEADER = "x-msgf-jira-bridge-identity";

function authHeaders(domain, email, token) {
  const auth = Buffer.from(`${email}:${token}`, "utf8").toString("base64");
  return {
    Authorization: `Basic ${auth}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    [JIRA_BRIDGE_IDENTITY_HEADER]: JIRA_BRIDGE_HOST_IDENTITY,
  };
}

async function main() {
  const domain = process.env.JIRA_DOMAIN?.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_API_TOKEN;
  const projectKey = process.env.JIRA_PROJECT_KEY;

  if (!domain || !email || !token) {
    const envFile = path.join(root, ".env");
    let hint = "ENV_INCOMPLETE";
    try {
      if (fs.existsSync(envFile) && fs.statSync(envFile).size === 0) {
        hint =
          "ENV_INCOMPLETE (root .env is 0 bytes — paste credentials or fix OneDrive “online-only”)";
      }
    } catch {
      /* ignore */
    }
    console.log(hint);
    process.exit(1);
  }

  const base = `https://${domain}`;
  const headers = authHeaders(domain, email, token);

  let effectiveProjectKey = projectKey || null;

  if (projectKey) {
    let pr;
    try {
      pr = await fetch(`${base}/rest/api/3/project/${encodeURIComponent(projectKey)}`, {
        method: "GET",
        headers: {
          Authorization: headers.Authorization,
          Accept: "application/json",
          [JIRA_BRIDGE_IDENTITY_HEADER]: JIRA_BRIDGE_HOST_IDENTITY,
        },
      });
    } catch (err) {
      const code = err.code ?? err.cause?.code ?? err.name ?? "FETCH_ERROR";
      console.log(String(code));
      process.exit(1);
    }
    if (pr.status === 401) {
      console.log("AUTH_401 Check JIRA_EMAIL + JIRA_API_TOKEN (Atlassian API token).");
      process.exit(1);
    }
    if (pr.status === 404) {
      console.log(
        `WARN_PROJECT_KEY Unknown Jira project key "${projectKey}" — JQL will run without project scope. Fix JIRA_PROJECT_KEY in .env when you know the real key.`
      );
      effectiveProjectKey = null;
    } else if (!pr.ok) {
      console.log(`PROJECT_${pr.status} ${(await pr.text()).slice(0, 200)}`);
      process.exit(1);
    } else {
      let proj;
      try {
        proj = await pr.json();
      } catch {
        console.log("INVALID_JSON_PROJECT");
        process.exit(1);
      }
      console.log(`JIRA_CONNECTED project=${proj.key} name=${proj.name}`);
    }
  }

  if (!projectKey || !effectiveProjectKey) {
    let si;
    try {
      si = await fetch(`${base}/rest/api/3/serverInfo`, {
        method: "GET",
        headers: {
          Authorization: headers.Authorization,
          Accept: "application/json",
          [JIRA_BRIDGE_IDENTITY_HEADER]: JIRA_BRIDGE_HOST_IDENTITY,
        },
      });
    } catch (err) {
      const code = err.code ?? err.cause?.code ?? err.name ?? "FETCH_ERROR";
      console.log(String(code));
      process.exit(1);
    }
    if (!si.ok) {
      console.log(`SERVERINFO_${si.status} ${(await si.text()).slice(0, 200)}`);
      process.exit(1);
    }
    let meta;
    try {
      meta = await si.json();
    } catch {
      console.log("INVALID_JSON_SERVERINFO");
      process.exit(1);
    }
    console.log(
      `JIRA_CONNECTED_ATLAS ${meta.serverTitle ?? "Jira"} (${meta.version ?? "?"}) — no scoped project; set JIRA_PROJECT_KEY for project-specific checks.`
    );
  }

  const projectClause = effectiveProjectKey ? `project = ${effectiveProjectKey} AND ` : "";
  const jql = `${projectClause}issuetype = Epic AND summary ~ "Author Ecosystem"`;

  let res;
  try {
    res = await fetch(`${base}/rest/api/3/search/jql`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jql,
        maxResults: 10,
        fields: ["summary", "issuetype"],
      }),
    });
  } catch (err) {
    const code = err.code ?? err.cause?.code ?? err.name ?? "FETCH_ERROR";
    console.log(String(code));
    process.exit(1);
  }

  if (!res.ok) {
    let body = "";
    try {
      body = await res.text();
    } catch {
      /* ignore */
    }
    console.log(`EPIC_SEARCH_${res.status} ${body.slice(0, 200)}`);
    process.exit(0);
  }

  let data;
  try {
    data = await res.json();
  } catch {
    console.log("INVALID_JSON_SEARCH");
    process.exit(0);
  }

  const issues = data.issues ?? [];
  const found = issues.some((issue) => {
    const s = issue.fields?.summary ?? "";
    return s === EPIC_SUMMARY || s.includes("Author Ecosystem");
  });

  if (found) {
    console.log("BRIDGE_ONLINE_EPIC");
  } else {
    console.log("JIRA_SEARCH_OK_NO_MATCHING_EPIC (optional epic not in results)");
  }
  process.exit(0);
}

main();
