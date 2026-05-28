import * as fs from "node:fs";
import * as path from "node:path";

/** Bump when bundled templates change; workspace kit upgrades when source is newer. */
export const DEV_KIT_VERSION = "1.0.0";

/** Paths relative to `.msgf/` that must exist after a successful sync. */
export const REQUIRED_DEV_KIT_PATHS = [
  "README.md",
  "KIT_VERSION.json",
  "dev/api-cookbook.md",
  "dev/env.example.json",
  "dev/requests/report-issue.json",
  "dev/requests/agent-context.json",
  "dev/requests/verify-result.json",
  "dev/scripts/test-connection.ps1",
  "dev/scripts/test-connection.sh",
  "dev/scripts/smoke-integrator.mjs",
  "dev/tasks/msgf-tasks.json",
] as const;

const ALWAYS_REFRESH_PREFIXES = ["dev/scripts/", "dev/requests/", "dev/tasks/"];

function shouldOverwrite(relativePath: string, force: boolean): boolean {
  if (force) return true;
  if (relativePath === "KIT_VERSION.json") return true;
  if (ALWAYS_REFRESH_PREFIXES.some((p) => relativePath.startsWith(p))) return true;
  return false;
}

function listFilesRecursive(dir: string, base = dir): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = path.relative(base, full).replace(/\\/g, "/");
    if (fs.statSync(full).isDirectory()) {
      out.push(...listFilesRecursive(full, base));
    } else {
      out.push(rel);
    }
  }
  return out;
}

export type SyncDevKitResult = {
  copied: number;
  skipped: number;
  bundleRoot: string;
  targetDir: string;
};

/**
 * Copy `resources/dev-kit` from the extension into the workspace `.msgf/` folder.
 */
export function syncDevKitFromBundle(
  bundleRoot: string,
  targetMsgfDir: string,
  options?: { force?: boolean }
): SyncDevKitResult {
  const force = options?.force === true;
  if (!fs.existsSync(bundleRoot)) {
    throw new Error(`MSGF dev kit bundle not found: ${bundleRoot}`);
  }

  fs.mkdirSync(targetMsgfDir, { recursive: true });

  const files = listFilesRecursive(bundleRoot);
  let copied = 0;
  let skipped = 0;

  for (const rel of files) {
    const src = path.join(bundleRoot, rel);
    const dest = path.join(targetMsgfDir, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });

    if (fs.existsSync(dest) && !shouldOverwrite(rel, force)) {
      skipped += 1;
      continue;
    }

    fs.copyFileSync(src, dest);
    copied += 1;
  }

  return { copied, skipped, bundleRoot, targetDir: targetMsgfDir };
}

export function validateDevKit(targetMsgfDir: string): string[] {
  const missing: string[] = [];
  for (const rel of REQUIRED_DEV_KIT_PATHS) {
    if (!fs.existsSync(path.join(targetMsgfDir, rel))) {
      missing.push(rel);
    }
  }
  return missing;
}

export function readDevKitVersion(targetMsgfDir: string): string | null {
  const p = path.join(targetMsgfDir, "KIT_VERSION.json");
  if (!fs.existsSync(p)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(p, "utf8")) as { version?: string };
    return typeof raw.version === "string" ? raw.version : null;
  } catch {
    return null;
  }
}
