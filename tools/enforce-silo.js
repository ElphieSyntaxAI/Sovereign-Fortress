#!/usr/bin/env node
/**
 * Developer silo: paths touched must match `WHITELISTED_PATHS` for `MSGF_TENANT_ID`
 * (see packages/msgf/config/tenant-manifest.json).
 *
 * - npm install: root `package.json` `prepare` runs `node tools/enforce-silo.js install`
 * - git push: chain in `.git/hooks/pre-push` after brain check, e.g.:
 *     #!/bin/sh
 *     exec node "$(git rev-parse --show-toplevel)/tools/check-brain-violation.js" --from-git-hook || exit 1
 *     exec node "$(git rev-parse --show-toplevel)/tools/enforce-silo.js" push --from-git-hook || exit 1
 *
 * If `MSGF_TENANT_ID` is unset, this script exits 0 (open-repo / admin dev).
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const MANIFEST_PATH = path.join(
  ROOT,
  "packages",
  "msgf",
  "config",
  "tenant-manifest.json"
);
const MSGF_PKG = path.join(ROOT, "packages", "msgf");
const VIOLATION_LOG = path.join(MSGF_PKG, ".msgf", "identity-violations.ndjson");

function norm(p) {
  return p.replace(/\\/g, "/").trim();
}

function escRe(s) {
  return s.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
}

function pathMatchesOne(file, pattern) {
  const pat = pattern.replace(/\\/g, "/");
  if (pat.endsWith("/**")) {
    const root = pat.slice(0, -3);
    return file === root || file.startsWith(`${root}/`);
  }
  if (pat.endsWith("/*")) {
    const root = pat.slice(0, -2);
    if (file === root) return true;
    if (!file.startsWith(`${root}/`)) return false;
    const rest = file.slice(root.length + 1);
    return !rest.includes("/");
  }
  if (pat.includes("**")) {
    const idx = pat.indexOf("**");
    const left = pat.slice(0, idx);
    const right = pat.slice(idx + 2);
    if (!file.startsWith(left)) return false;
    if (right.length > 0 && !file.endsWith(right)) return false;
    return true;
  }
  if (pat.includes("*")) {
    const re = new RegExp(`^${pat.split("*").map(escRe).join("[^/]*")}$`);
    return re.test(file);
  }
  return file === pat;
}

function pathMatchesWhitelist(filePath, patterns) {
  const p = norm(filePath).replace(/^\.\/+/, "");
  return patterns.some((pat) => pathMatchesOne(p, pat));
}

function loadManifest() {
  const raw = fs.readFileSync(MANIFEST_PATH, "utf8");
  return JSON.parse(raw);
}

function logIdentityViolation(entry) {
  const dir = path.dirname(VIOLATION_LOG);
  fs.mkdirSync(dir, { recursive: true });
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    kind: "IDENTITY_VIOLATION",
    ...entry,
  });
  fs.appendFileSync(VIOLATION_LOG, `${line}\n`, "utf8");
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
  const candidates = ["origin/main", "origin/master", "main", "master"];
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
  return execSync(`git diff --name-only ${range}`, {
    cwd: ROOT,
    encoding: "utf8",
  })
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
      return execSync(
        `git diff-tree --no-commit-id --name-only -r ${localSha}`,
        { cwd: ROOT, encoding: "utf8" }
      )
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

function getDirtyFiles() {
  const staged = execSync("git diff --cached --name-only", {
    cwd: ROOT,
    encoding: "utf8",
  })
    .split("\n")
    .map(norm)
    .filter(Boolean);
  const unstaged = execSync("git diff --name-only", {
    cwd: ROOT,
    encoding: "utf8",
  })
    .split("\n")
    .map(norm)
    .filter(Boolean);
  let untracked = [];
  try {
    untracked = execSync("git ls-files --others --exclude-standard", {
      cwd: ROOT,
      encoding: "utf8",
    })
      .split("\n")
      .map(norm)
      .filter(Boolean);
  } catch {
    untracked = [];
  }
  return [...new Set([...staged, ...unstaged, ...untracked])];
}

function validatePaths(tenantId, files, mode) {
  const manifest = loadManifest();
  const entry = manifest.tenants?.[tenantId];
  if (!entry || !Array.isArray(entry.WHITELISTED_PATHS)) {
    console.error(
      `enforce-silo: unknown tenant_id "${tenantId}" (set MSGF_TENANT_ID to a key in tenant-manifest.json).`
    );
    process.exit(1);
  }
  const violations = files.filter(
    (f) => !pathMatchesWhitelist(f, entry.WHITELISTED_PATHS)
  );
  if (violations.length === 0) return;

  logIdentityViolation({
    source: "enforce-silo",
    mode,
    tenant_id: tenantId,
    violations,
  });
  console.error(
    "IDENTITY_VIOLATION: paths outside tenant silo:\n  " +
      violations.join("\n  ")
  );
  process.exit(1);
}

function main() {
  const tenantId = (process.env.MSGF_TENANT_ID || process.env.TENANT_ID || "")
    .trim();
  if (!tenantId) {
    process.exit(0);
  }

  const modeArg = process.argv[2];
  let files = [];
  let mode = "unknown";

  if (modeArg === "install") {
    mode = "npm_install_prepare";
    try {
      files = getDirtyFiles();
    } catch (e) {
      console.warn("enforce-silo install: not a git repo or git failed; skip.");
      process.exit(0);
    }
  } else if (modeArg === "push") {
    mode = "git_pre_push";
    files = collectPushedFiles();
    if (files.length === 0) {
      process.exit(0);
    }
  } else {
    console.error("Usage: node tools/enforce-silo.js install|push [--from-git-hook]");
    process.exit(2);
  }

  validatePaths(tenantId, files, mode);
  process.exit(0);
}

main();
