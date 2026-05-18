import * as fs from "node:fs";
import * as path from "node:path";

import * as vscode from "vscode";

const MSGF_DIR = ".msgf";
const KEYS_DIR = "keys";
const GITIGNORE = ".gitignore";

const PLACEHOLDER_KEY_CONTENT =
  "# Paste your provider API key on the line below (file is gitignored).\n";

export function getWorkspaceRoot(): string | null {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
}

export function getMsgfDir(workspaceRoot: string): string {
  return path.join(workspaceRoot, MSGF_DIR);
}

export function getMsgfKeysDir(workspaceRoot: string): string {
  return path.join(getMsgfDir(workspaceRoot), KEYS_DIR);
}

export function getLocalStateCachePath(workspaceRoot: string): string {
  return path.join(getMsgfDir(workspaceRoot), "local_state_cache.json");
}

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function ensurePlaceholderKey(filePath: string): void {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, PLACEHOLDER_KEY_CONTENT, "utf8");
  }
}

function ensureMsgfGitignore(msgfDir: string): void {
  const gitignorePath = path.join(msgfDir, GITIGNORE);
  const body = ["keys/", "*.key", "local_state_cache.json", ""].join("\n");
  if (!fs.existsSync(gitignorePath)) {
    fs.writeFileSync(gitignorePath, body, "utf8");
  }
}

/**
 * Creates hidden `.msgf/`, `.msgf/keys/` with `gemini.key` / `claude.key` placeholders.
 */
export async function initializeMsgfWorkspace(): Promise<string | null> {
  const root = getWorkspaceRoot();
  if (!root) return null;

  const msgfDir = getMsgfDir(root);
  const keysDir = getMsgfKeysDir(root);

  ensureDir(msgfDir);
  ensureDir(keysDir);
  ensureMsgfGitignore(msgfDir);
  ensurePlaceholderKey(path.join(keysDir, "gemini.key"));
  ensurePlaceholderKey(path.join(keysDir, "claude.key"));

  return root;
}
