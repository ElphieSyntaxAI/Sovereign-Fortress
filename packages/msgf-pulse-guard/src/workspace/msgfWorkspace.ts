import * as fs from "node:fs";
import * as path from "node:path";

import * as vscode from "vscode";

const MSGF_DIR = ".msgf";
const KEYS_DIR = "keys";
const GITIGNORE = ".gitignore";
const USER_GUIDE_FILE = "USER-GUIDE.md";

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

function ensureUserGuide(msgfDir: string, extensionPath: string | undefined): void {
  const target = path.join(msgfDir, USER_GUIDE_FILE);
  if (fs.existsSync(target)) return;

  const bundled = extensionPath
    ? path.join(extensionPath, "resources", "msgf-user-guide.md")
    : "";
  if (bundled && fs.existsSync(bundled)) {
    fs.copyFileSync(bundled, target);
    return;
  }

  fs.writeFileSync(
    target,
    [
      "# MSGF quick reference",
      "",
      "See the MSGF Pulse Guard extension README, or run **MSGF: Open quick reference** from the Command Palette.",
      "",
    ].join("\n"),
    "utf8"
  );
}

export function getUserGuidePath(workspaceRoot: string): string {
  return path.join(getMsgfDir(workspaceRoot), USER_GUIDE_FILE);
}

/**
 * Creates `.msgf/` with keys placeholders and `USER-GUIDE.md` (commands + setup — user-facing only).
 */
export async function initializeMsgfWorkspace(extensionPath?: string): Promise<string | null> {
  const root = getWorkspaceRoot();
  if (!root) return null;

  const msgfDir = getMsgfDir(root);
  const keysDir = getMsgfKeysDir(root);

  ensureDir(msgfDir);
  ensureDir(keysDir);
  ensureMsgfGitignore(msgfDir);
  ensurePlaceholderKey(path.join(keysDir, "gemini.key"));
  ensurePlaceholderKey(path.join(keysDir, "claude.key"));
  ensureUserGuide(msgfDir, extensionPath);

  return root;
}
