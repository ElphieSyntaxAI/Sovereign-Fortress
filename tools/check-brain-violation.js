#!/usr/bin/env node
/**
 * Pre-push guard for the "Large Brain" (shared packages/core and packages/ui).
 *
 * Install as Git pre-push hook (from repo root):
 *   node tools/check-brain-violation.js   # dry-run with no stdin → exits 0
 *   printf '%s\n' "$local_ref $local_sha $remote_ref $remote_sha" | node tools/check-brain-violation.js
 *
 * Typical hook (.git/hooks/pre-push) — chain tenant silo after this script:
 *   #!/bin/sh
 *   ROOT="$(git rev-parse --show-toplevel)"
 *   node "$ROOT/tools/check-brain-violation.js" --from-git-hook || exit 1
 *   exec node "$ROOT/tools/enforce-silo.js" push --from-git-hook
 *
 * Or with Husky: husky set .husky/pre-push "node tools/check-brain-violation.js --from-git-hook && node tools/enforce-silo.js push --from-git-hook"
 */

const { execSync } = require("child_process");
const fs = require("fs");

const MASTER_ADMIN = "Master Admin";
const BRAIN_PREFIXES = ["packages/core", "packages/ui"];
const ALERT =
  "ALERT: You are attempting to modify the Large Brain. Please submit a Logic Proposal via the HITL Dashboard instead.";

function norm(p) {
  return p.replace(/\\/g, "/").trim();
}

function onlyUnderApps(files) {
  if (files.length === 0) return true;
  return files.every((f) => norm(f).startsWith("apps/"));
}

function touchesLargeBrain(files) {
  return files.some((f) => {
    const n = norm(f);
    return BRAIN_PREFIXES.some(
      (prefix) => n === prefix || n.startsWith(`${prefix}/`)
    );
  });
}

function gitUserName() {
  try {
    return execSync("git config user.name", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    return "";
  }
}

function revExists(ref) {
  try {
    execSync(`git rev-parse -q --verify ${ref}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function mergeBaseWithRemote(localSha) {
  const candidates = [
    "origin/main",
    "origin/master",
    "main",
    "master",
  ];
  for (const c of candidates) {
    if (!revExists(c)) continue;
    try {
      return execSync(`git merge-base ${c} ${localSha}`, {
        encoding: "utf8",
      }).trim();
    } catch {
      /* continue */
    }
  }
  return null;
}

function diffNameOnly(range) {
  return execSync(`git diff --name-only ${range}`, { encoding: "utf8" })
    .split("\n")
    .map(norm)
    .filter(Boolean);
}

function filesForPushLine(localSha, remoteSha) {
  const zero = /^0{40}$/;
  if (zero.test(remoteSha)) {
    const mb = mergeBaseWithRemote(localSha);
    if (mb) return diffNameOnly(`${mb}..${localSha}`);
    try {
      return execSync(`git diff-tree --no-commit-id --name-only -r ${localSha}`, {
        encoding: "utf8",
      })
        .split("\n")
        .map(norm)
        .filter(Boolean);
    } catch {
      return [];
    }
  }
  return diffNameOnly(`${remoteSha}..${localSha}`);
}

function collectPushedFiles() {
  /**
   * Only read hook stdin when Git invoked this script (GIT_DIR is set) or when
   * `--from-git-hook` was passed (e.g. from .git/hooks/pre-push). Avoids hanging
   * on `npm run check-brain-violation` with an open TTY and no stdin payload.
   */
  const hookMode =
    Boolean(process.env.GIT_DIR) || process.argv.includes("--from-git-hook");
  if (!hookMode) {
    return [];
  }
  let stdin = "";
  try {
    stdin = fs.readFileSync(0, "utf8");
  } catch {
    stdin = "";
  }
  const lines = stdin.split(/\r?\n/).filter((l) => l.trim());
  const all = new Set();
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 4) continue;
    const localSha = parts[1];
    const remoteSha = parts[3];
    for (const f of filesForPushLine(localSha, remoteSha)) all.add(f);
  }
  return [...all];
}

function main() {
  const files = collectPushedFiles();

  if (files.length === 0) {
    process.exit(0);
  }

  if (onlyUnderApps(files)) {
    process.exit(0);
  }

  if (!touchesLargeBrain(files)) {
    process.exit(0);
  }

  const user = gitUserName();
  if (user === MASTER_ADMIN) {
    process.exit(0);
  }

  console.error(ALERT);
  process.exit(1);
}

main();
