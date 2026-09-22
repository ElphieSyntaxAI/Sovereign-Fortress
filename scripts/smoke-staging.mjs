#!/usr/bin/env node
/**
 * Hit the staging MSGF host and assert it is staging, not production.
 *
 *   npm run smoke:staging
 *   node scripts/smoke-staging.mjs https://msgf-api-staging-….run.app
 */
const argUrl = process.argv[2]?.trim();
const envUrl = process.env.MSGF_STAGING_URL?.trim();
const defaultUrl = "https://staging.elphiesgatedai.elphiesyntax.com";
const base = (argUrl || envUrl || defaultUrl).replace(/\/$/, "");

async function getJson(pathname) {
  const url = `${base}${pathname}`;
  const res = await fetch(url, { redirect: "follow" });
  const text = await res.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text.slice(0, 200) };
  }
  return { url, status: res.status, headers: res.headers, body };
}

const failures = [];
const notes = [];

console.log(`Smoke staging: ${base}`);

try {
  const health = await getJson("/health");
  console.log(`  GET /health → ${health.status}`);
  if (health.status !== 200) {
    failures.push(`/health HTTP ${health.status}`);
  } else if (health.body?.status && health.body.status !== "healthy") {
    failures.push(`/health status=${health.body.status} reason=${health.body.reason || "?"}`);
  }
  const deployEnv =
    health.body?.release?.deploy_env || health.body?.deploy_env || "";
  const sha = health.body?.release?.git_sha || health.body?.git_sha || null;
  console.log(`  deploy_env=${deployEnv || "(missing)"} git_sha=${sha || "(missing)"}`);
  if (deployEnv !== "staging") {
    failures.push(`Expected deploy_env=staging, got ${deployEnv || "empty"} — this host is not staging`);
  }

  const robotsTag = health.headers.get("x-robots-tag") || "";
  if (robotsTag && !/noindex/i.test(robotsTag)) {
    notes.push(`X-Robots-Tag is set but missing noindex: ${robotsTag}`);
  } else if (!robotsTag) {
    notes.push("No X-Robots-Tag yet (needs a staging image with DEPLOY_ENV=staging)");
  }

  const robots = await fetch(`${base}/robots.txt`);
  const robotsText = await robots.text();
  if (robots.status === 200 && !/disallow:\s*\//i.test(robotsText)) {
    failures.push("robots.txt should Disallow / on staging");
  }
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  failures.push(`Unreachable ${base} (${message}). Map DNS or pass the Cloud Run URL.`);
}

if (notes.length) {
  console.log("NOTE:");
  for (const n of notes) console.log(`  - ${n}`);
}
if (failures.length) {
  console.error("FAIL:");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log("OK — staging host answers as staging.");
