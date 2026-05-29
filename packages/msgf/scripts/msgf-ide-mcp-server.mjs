#!/usr/bin/env node
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
 * Distribution Build ID: MSGF-3a4c1de-20260529T200349Z-internal
 */
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
 * Distribution Build ID: MSGF-3ea5d0e-20260529T033030Z-internal
 */
/**
 * MSGF IDE MCP server (stdio) — P3 agent handoff tools.
 * Requires: npm install @modelcontextprotocol/sdk (in packages/msgf or repo root)
 */
import { createHash } from "node:crypto";

const API = (process.env.MSGF_API_URL ?? "").replace(/\/$/, "");
const TOKEN = process.env.MSGF_AUTH_TOKEN?.trim() ?? "";
const TENANT_KEY = process.env.MSGF_TENANT_KEY?.trim() ?? "";

function tenantUuid(tenantKey) {
  const trimmed = tenantKey.trim();
  if (/^[0-9a-f-]{36}$/i.test(trimmed)) return trimmed.toLowerCase();
  const hash = createHash("sha256").update(`msgf-heal-queue:${trimmed}`, "utf8").digest("hex");
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    `4${hash.slice(13, 16)}`,
    hash.slice(16, 20),
    hash.slice(20, 32),
  ].join("-");
}

function authHeaders() {
  return {
    Authorization: `Bearer ${TOKEN}`,
    "X-MSGF-Tenant-Key": TENANT_KEY,
    "x-msgf-tenant-id": TENANT_KEY,
    "x-msgf-ide-pulse": "1",
    "Content-Type": "application/json",
  };
}

async function msgfFetch(path, init = {}) {
  if (!API || !TOKEN || !TENANT_KEY) {
    throw new Error("Set MSGF_API_URL, MSGF_AUTH_TOKEN, MSGF_TENANT_KEY");
  }
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init.headers ?? {}) },
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    throw new Error(typeof json.error === "string" ? json.error : `HTTP ${res.status}`);
  }
  return json;
}

let Server;
let StdioServerTransport;
try {
  const sdk = await import("@modelcontextprotocol/sdk/server/index.js");
  const stdio = await import("@modelcontextprotocol/sdk/server/stdio.js");
  Server = sdk.Server;
  StdioServerTransport = stdio.StdioServerTransport;
} catch {
  console.error(
    "[msgf-mcp] Install @modelcontextprotocol/sdk: npm install @modelcontextprotocol/sdk -w msgf"
  );
  process.exit(1);
}

const server = new Server(
  { name: "msgf-ide", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler({ method: "tools/list" }, async () => ({
  tools: [
    {
      name: "testConnection",
      description: "Probe MSGF IDE connectivity",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "getContextPack",
      description: "Fetch guided 0-token agent context markdown",
      inputSchema: {
        type: "object",
        properties: {
          mode: { type: "string", enum: ["guided", "auto"] },
          file_paths: { type: "array", items: { type: "string" } },
        },
      },
    },
    {
      name: "startDevHealCycle",
      description: "Start dev heal cycle (DEV_CYCLE_START)",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "submitVerifyResult",
      description: "Log verify pass/fail to MSGF audit",
      inputSchema: {
        type: "object",
        properties: {
          passed: { type: "boolean" },
          command: { type: "string" },
        },
        required: ["passed"],
      },
    },
  ],
}));

server.setRequestHandler({ method: "tools/call" }, async (req) => {
  const name = req.params.name;
  const args = req.params.arguments ?? {};
  const tid = tenantUuid(TENANT_KEY);

  if (name === "testConnection") {
    const data = await msgfFetch("/api/msgf/ide/connectivity-check", { method: "GET" });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }

  if (name === "getContextPack") {
    const mode = args.mode === "auto" ? "auto" : "guided";
    const qp = new URLSearchParams({ tenant_id: tid, mode });
    if (args.file_paths?.length) qp.set("file_paths", args.file_paths.join(","));
    const data = await msgfFetch(`/api/msgf/agent-context?${qp}`, { method: "GET" });
    return { content: [{ type: "text", text: data.markdown ?? JSON.stringify(data) }] };
  }

  if (name === "startDevHealCycle") {
    const data = await msgfFetch("/api/msgf/heal-queue", {
      method: "POST",
      body: JSON.stringify({ tenant_id: tid, action_type: "DEV_CYCLE_START" }),
    });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }

  if (name === "submitVerifyResult") {
    const data = await msgfFetch("/api/msgf/verify-result", {
      method: "POST",
      body: JSON.stringify({
        tenant_id: tid,
        passed: Boolean(args.passed),
        command: args.command,
        product_surface: "ide",
      }),
    });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }

  throw new Error(`Unknown tool: ${name}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
