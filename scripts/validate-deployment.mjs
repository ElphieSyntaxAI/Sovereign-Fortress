#!/usr/bin/env node
/**
 * Local deployment gate (Windows / macOS / Linux).
 * Runs what Cloud Build/Docker runs before deploy — surfaces **project code** errors only.
 *
 * Skips: gcloud deploy, interactive ESLint wizard, env/db checks (optional flags).
 *
 * Usage (repo root):
 *   node scripts/validate-deployment.mjs
 *   node scripts/validate-deployment.mjs --with-env
 *   node scripts/validate-deployment.mjs --verbose
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MSGF = path.join(ROOT, "packages", "msgf");

const args = new Set(process.argv.slice(2));
const verbose = args.has("--verbose");
const withEnv = args.has("--with-env");

/** Lines to hide unless --verbose (noise, not app code defects). */
const IGNORE_LINE =
  /^(npm warn|npm notice)|\bdeprecated\b|Serializing big strings|webpack\.cache|PackFileCacheStrategy|Next\.js telemetry|license-header\]|\[obfuscate-dist\]|\[verify-sdk-dist\]|\[generate-server-dts\]|CLI Building entry|ESM dist\\|ESM ⚡|DTS Build|How would you like to configure ESLint|next lint` is deprecated|⚠ If you set up ESLint|❯\s+Strict|Experiments \(use with caution\)|Environments: \.env|Creating an optimized production build/i;

/** Lines that always count as code failures. */
const CODE_FAIL =
  /Failed to compile|Type error:|error TS\d+|Module not found|Cannot find module|UnhandledSchemeError|SyntaxError:|Build failed because of webpack|ELIFECYCLE Command failed|not handled by plugins|Import trace for requested module/i;

/** Our source roots in output. */
const OUR_PATH =
  /(?:packages\/msgf|apps\/|lib\/|app\/|src\/)[^\s:]+\.(?:ts|tsx|js|jsx)/i;

function resolveTsx() {
  for (const base of [MSGF, ROOT]) {
    const p = path.join(base, "node_modules", "tsx", "dist", "cli.mjs");
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function runStep(label, fn) {
  console.log(`\n========== ${label} ==========\n`);
  const { code, stdout, stderr } = fn();
  const combined = `${stdout}\n${stderr}`;
  const filtered = filterOutput(combined);
  if (filtered.critical.length) {
    console.log("--- Code issues ---\n");
    console.log(filtered.critical.join("\n"));
  }
  if (verbose && filtered.other.length) {
    console.log("\n--- Other output ---\n");
    console.log(filtered.other.join("\n"));
  }
  if (filtered.suppressed > 0 && !verbose) {
    console.log(`(${filtered.suppressed} non-critical line(s) hidden — use --verbose)`);
  }
  const ok = code === 0 && filtered.critical.length === 0;
  console.log(ok ? `\n✓ ${label} passed` : `\n✗ ${label} failed (exit ${code})`);
  return { ok, code, critical: filtered.critical };
}

function filterOutput(text) {
  const critical = [];
  const other = [];
  let suppressed = 0;
  let inTrace = false;

  for (const line of text.split(/\r?\n/)) {
    const t = line.trimEnd();
    if (!t) continue;

    if (/Import trace for requested module/i.test(t)) {
      inTrace = true;
      critical.push(t);
      continue;
    }
    if (inTrace) {
      if (/^\s{2,}/.test(line) || OUR_PATH.test(t) || /^\.\//.test(t.trim())) {
        critical.push(t);
        continue;
      }
      inTrace = false;
    }

    if (CODE_FAIL.test(t) || (/\berror\b/i.test(t) && OUR_PATH.test(t))) {
      critical.push(t);
      continue;
    }

    if (IGNORE_LINE.test(t)) {
      suppressed++;
      continue;
    }

    if (/\bwarn\b/i.test(t) && !OUR_PATH.test(t)) {
      suppressed++;
      continue;
    }

    other.push(t);
  }

  return { critical: dedupeLines(critical), other, suppressed };
}

function dedupeLines(lines) {
  const seen = new Set();
  return lines.filter((l) => {
    if (seen.has(l)) return false;
    seen.add(l);
    return true;
  });
}

function npmRun(cwd, script) {
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  return () => {
    const r = spawnSync(npm, ["run", script], {
      cwd,
      encoding: "utf8",
      env: process.env,
      shell: process.platform === "win32",
      maxBuffer: 20 * 1024 * 1024,
    });
    return {
      code: r.status ?? 1,
      stdout: r.stdout ?? "",
      stderr: r.stderr ?? "",
    };
  };
}

function nodeRun(cwd, relScript, extraArgs = []) {
  return () => {
    const r = spawnSync(process.execPath, [path.join(cwd, relScript), ...extraArgs], {
      cwd,
      encoding: "utf8",
      env: process.env,
      maxBuffer: 20 * 1024 * 1024,
    });
    return {
      code: r.status ?? 1,
      stdout: r.stdout ?? "",
      stderr: r.stderr ?? "",
    };
  };
}

function main() {
  console.log(`[validate-deployment] ${process.platform} — ${ROOT}`);
  console.log("Surfaces compile/test failures in MSGF app code; hides license stamps, webpack cache warnings, npm noise.\n");

  const steps = [
    ["MSGF unit tests", npmRun(MSGF, "test:unit")],
    ["MSGF production build (Docker/Cloud Build gate)", npmRun(MSGF, "build")],
  ];

  if (withEnv) {
    steps.splice(1, 0, ["MSGF env verify", npmRun(MSGF, "verify:msgf-env")]);
  }

  const failures = [];

  for (const [label, fn] of steps) {
    const result = runStep(label, fn);
    if (!result.ok) failures.push({ label, code: result.code, lines: result.critical });
  }

  console.log("\n========== Summary ==========\n");
  if (!failures.length) {
    console.log("All deployment gates passed. Safe to run ./deploy.sh or setup-cloud.sh when gcloud is configured.");
    process.exit(0);
  }

  console.log("Failed steps:");
  for (const f of failures) {
    console.log(`  • ${f.label} (exit ${f.code})`);
    for (const line of f.lines.slice(0, 12)) {
      console.log(`      ${line}`);
    }
    if (f.lines.length > 12) console.log(`      … +${f.lines.length -  12} more`);
  }
  console.log("\nCloud deploy (not run here): ./deploy.sh  — requires gcloud + PROJECT_ID");
  process.exit(1);
}

main();
