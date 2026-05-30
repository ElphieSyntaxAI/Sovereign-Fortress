import * as fs from "node:fs";
import * as path from "node:path";

import * as vscode from "vscode";

import { syncDevKitFromBundle } from "./devKitSync";

const MSGF_DIR = ".msgf";
const KEYS_DIR = "keys";
const GITIGNORE = ".gitignore";
const USER_GUIDE_FILE = "USER-GUIDE.md";
const DEV_KIT_BUNDLE_DIR = "dev-kit";

const PLACEHOLDER_KEY_CONTENT =
  "# Paste your provider API key on the line below (file is gitignored).\n";

/** Git / editor workspace folder (often the monorepo root). */
export function getRepoRoot(): string | null {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
}

/**
 * Active product silo for MSGF (.msgf/, shadow scan, dev kit).
 * When `msgf.productPath` is set, uses `{repoRoot}/{productPath}`.
 */
export function getEffectiveWorkspaceRoot(): string | null {
  const repo = getRepoRoot();
  if (!repo) return null;

  const productPath = vscode.workspace
    .getConfiguration("msgf")
    .get<string>("productPath", "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/\/$/, "");

  if (!productPath) return repo;

  const candidate = path.join(repo, productPath);
  if (fs.existsSync(candidate)) return candidate;
  return repo;
}

/** @deprecated Alias for {@link getEffectiveWorkspaceRoot}. */
export function getWorkspaceRoot(): string | null {
  return getEffectiveWorkspaceRoot();
}

export function getMsgfDir(workspaceRoot: string): string {
  return path.join(workspaceRoot, MSGF_DIR);
}

export function getMsgfKeysDir(workspaceRoot: string): string {
  return path.join(getMsgfDir(workspaceRoot), KEYS_DIR);
}

export function getDevKitDir(workspaceRoot: string): string {
  return path.join(getMsgfDir(workspaceRoot), "dev");
}

export function getLocalStateCachePath(workspaceRoot: string): string {
  return path.join(getMsgfDir(workspaceRoot), "local_state_cache.json");
}

export function getDevKitBundleRoot(extensionPath: string): string {
  return path.join(extensionPath, "resources", DEV_KIT_BUNDLE_DIR);
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
  const body = [
    "keys/",
    "*.key",
    "local_state_cache.json",
    "dev/env.local.json",
    "",
  ].join("\n");
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

export function getDevKitReadmePath(workspaceRoot: string): string {
  return path.join(getMsgfDir(workspaceRoot), "README.md");
}

/**
 * Sync integrator templates from extension `resources/dev-kit` into `.msgf/`.
 */
export function syncMsgfDevKit(
  extensionPath: string,
  workspaceRoot: string,
  options?: { force?: boolean }
): ReturnType<typeof syncDevKitFromBundle> {
  const bundleRoot = getDevKitBundleRoot(extensionPath);
  const msgfDir = getMsgfDir(workspaceRoot);
  ensureDir(msgfDir);
  return syncDevKitFromBundle(bundleRoot, msgfDir, options);
}

/**
 * Creates `.msgf/` with keys, user guide, and integrator dev kit.
 */
export async function initializeMsgfWorkspace(
  extensionPath?: string,
  options?: { forceDevKit?: boolean }
): Promise<string | null> {
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

  if (extensionPath) {
    syncMsgfDevKit(extensionPath, root, { force: options?.forceDevKit === true });
  }

  return root;
}
