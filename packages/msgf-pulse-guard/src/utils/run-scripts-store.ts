import * as fs from "node:fs";
import * as path from "node:path";

import { assertAllowedVerifyCommand } from "./shell-safe-path";
import { getMsgfDir, getWorkspaceRoot } from "../workspace/msgfWorkspace";

export type RunScriptEntry = {
  id: string;
  label: string;
  command: string;
  packId?: string;
  userIntent?: string;
  createdAt: string;
};

type RunScriptsFile = {
  version: 1;
  scripts: RunScriptEntry[];
};

const RUN_SCRIPTS_FILE = "run-scripts.json";
const VERIFY_SH = "verify-feature.sh";
const VERIFY_PS1 = "verify-feature.ps1";
const MAX_SCRIPTS = 12;

function runScriptsPath(workspaceRoot: string): string {
  return path.join(getMsgfDir(workspaceRoot), RUN_SCRIPTS_FILE);
}

function readStore(workspaceRoot: string): RunScriptsFile {
  const filePath = runScriptsPath(workspaceRoot);
  if (!fs.existsSync(filePath)) {
    return { version: 1, scripts: [] };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as RunScriptsFile;
    if (raw?.version !== 1 || !Array.isArray(raw.scripts)) {
      return { version: 1, scripts: [] };
    }
    return raw;
  } catch {
    return { version: 1, scripts: [] };
  }
}

function writeStore(workspaceRoot: string, store: RunScriptsFile): void {
  const msgfDir = getMsgfDir(workspaceRoot);
  if (!fs.existsSync(msgfDir)) {
    fs.mkdirSync(msgfDir, { recursive: true });
  }
  fs.writeFileSync(runScriptsPath(workspaceRoot), `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

function writeVerifyScriptFiles(workspaceRoot: string, commands: readonly string[]): void {
  const msgfDir = getMsgfDir(workspaceRoot);
  if (!fs.existsSync(msgfDir)) {
    fs.mkdirSync(msgfDir, { recursive: true });
  }

  const body = commands.filter(Boolean);
  const sh = [
    "#!/usr/bin/env bash",
    "set -euo pipefail",
    "# MSGF auto-verify — Run Scripts (prompt optimizer)",
    "",
    ...body,
    "",
  ].join("\n");

  const ps1 = [
    "# MSGF auto-verify — Run Scripts (prompt optimizer)",
    "$ErrorActionPreference = 'Stop'",
    "",
    ...(body.length ? body : ["npm test"]),
    "",
  ].join("\n");

  fs.writeFileSync(path.join(msgfDir, VERIFY_SH), sh, "utf8");
  fs.writeFileSync(path.join(msgfDir, VERIFY_PS1), ps1, "utf8");
}

/** Load registered verify scripts for the active workspace. */
export function loadRunScripts(workspaceRoot?: string | null): RunScriptEntry[] {
  const root = workspaceRoot ?? getWorkspaceRoot();
  if (!root) return [];
  return readStore(root).scripts;
}

/** Append optimizer-generated scripts (latest first, dedupe by command). */
export function registerRunScripts(
  scripts: Array<{
    id: string;
    label: string;
    command: string;
    packId?: string;
    userIntent?: string;
  }>,
  meta?: { packId?: string; userIntent?: string }
): RunScriptEntry[] {
  const root = getWorkspaceRoot();
  if (!root || !scripts.length) return [];

  const store = readStore(root);
  const now = new Date().toISOString();
  const incoming: RunScriptEntry[] = [];
  for (const s of scripts) {
    try {
      incoming.push({
        id: s.id,
        label: s.label,
        command: assertAllowedVerifyCommand(s.command.trim()),
        packId: s.packId ?? meta?.packId,
        userIntent: meta?.userIntent ?? s.userIntent,
        createdAt: now,
      });
    } catch {
      /* drop disallowed commands from tampered or stale payloads */
    }
  }
  if (!incoming.length) return store.scripts;

  const merged: RunScriptEntry[] = [];
  const seen = new Set<string>();
  for (const entry of [...incoming, ...store.scripts]) {
    const key = entry.command;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(entry);
    if (merged.length >= MAX_SCRIPTS) break;
  }

  writeStore(root, { version: 1, scripts: merged });
  writeVerifyScriptFiles(
    root,
    merged.map((s) => s.command)
  );

  return merged;
}

/** Client-side fallback when API has not deployed verifyScripts yet. */
export function inferLocalVerifyScripts(
  userIntent: string,
  paths: readonly string[],
  packId?: string
): RunScriptEntry[] {
  const prefix = (packId ?? "local").slice(0, 8);
  const normalized = paths.map((p) => p.replace(/\\/g, "/"));
  const joined = normalized.join(" ").toLowerCase();
  const now = new Date().toISOString();
  const scripts: RunScriptEntry[] = [];

  if (joined.includes(".rb") || joined.includes("test/")) {
    const testFile = normalized.find((p) => /test\/.*_test\.rb$/i.test(p));
    if (testFile) {
      scripts.push({
        id: `${prefix}-rails-file`,
        label: `Verify · ${testFile}`,
        command: `bundle exec rails test ${testFile}`,
        packId,
        userIntent,
        createdAt: now,
      });
    }
    scripts.push({
      id: `${prefix}-rails`,
      label: "Rails test suite",
      command: "bundle exec rails test",
      packId,
      userIntent,
      createdAt: now,
    });
  } else {
    scripts.push({
      id: `${prefix}-npm-test`,
      label: "npm test",
      command: "npm test",
      packId,
      userIntent,
      createdAt: now,
    });
  }

  return registerRunScripts(scripts, { packId, userIntent });
}
