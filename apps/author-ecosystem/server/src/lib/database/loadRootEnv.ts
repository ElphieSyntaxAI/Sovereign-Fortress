import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

const thisDir = resolve(dirname(fileURLToPath(import.meta.url)));

/**
 * True when `dir/package.json` declares npm workspaces (monorepo root for this repo).
 */
function isNpmWorkspacesRoot(dir: string): boolean {
  const pkgPath = join(dir, "package.json");
  if (!existsSync(pkgPath)) return false;
  try {
    const raw = readFileSync(pkgPath, "utf8");
    const j = JSON.parse(raw) as { workspaces?: unknown };
    return Array.isArray(j.workspaces) && j.workspaces.length > 0;
  } catch {
    return false;
  }
}

/**
 * Walk upward from this file (`…/server/src/lib/database/`) until the npm workspaces root is found.
 * Falls back to a fixed climb so behavior stays predictable if the tree layout changes slightly.
 */
function resolveMonorepoRootDir(): string {
  let dir = thisDir;
  for (let i = 0; i < 30; i++) {
    if (isNpmWorkspacesRoot(dir)) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // `database/` → lib → src → server → author-ecosystem → apps → monorepo root (6 levels)
  return resolve(thisDir, "..", "..", "..", "..", "..", "..");
}

let cachedMonorepoRoot: string | null = null;

/**
 * Absolute monorepo root (`ElphieSyntaxLLC/`).
 * Cached so every caller agrees on the same path regardless of `process.cwd()`.
 */
export function getMonorepoRootDir(): string {
  if (!cachedMonorepoRoot) {
    cachedMonorepoRoot = resolveMonorepoRootDir();
  }
  return cachedMonorepoRoot;
}

let rootEnvLoaded = false;

/**
 * Loads root `.env` then `.env.local` (override) so `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
 * `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, etc. match MSGF / root workspace configuration.
 *
 * Paths are absolute (`resolve(getMonorepoRootDir(), …)`) so scripts work no matter the current working directory.
 */
export function loadMonorepoRootEnv(): void {
  if (rootEnvLoaded) return;
  rootEnvLoaded = true;
  const root = resolve(getMonorepoRootDir());
  dotenv.config({ path: join(root, ".env") });
  dotenv.config({ path: join(root, ".env.local"), override: true });
}
