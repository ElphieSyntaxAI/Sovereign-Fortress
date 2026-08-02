/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * This source code and associated documentation are the exclusive property of
 * Elphie Syntax LLC. Unauthorized copying, distribution, publication, or
 * reverse-engineering — including decompilation, disassembly, or derivative
 * works — is strictly prohibited without prior written consent.
 *
 * Distribution Build ID: MSGF-149f647f-20260728T230931Z-internal
 */
/** GCP region names are not valid Supabase pooler hosts (common mis-copy from GCP_LOCATION). */
const INVALID_POOLER_HOST_PATTERNS = [
  /aws-0-us-central1\.pooler\.supabase\.com/i,
  /aws-0-us-central2\.pooler\.supabase\.com/i,
];

const PLACEHOLDER_PASSWORD_MARKERS = ["[YOUR_DB_PASSWORD]", "[password]", "[YOUR-DB-PASSWORD]"];

const DEFAULT_POOLER_REGION = "us-west-2";
/** Newer projects use aws-1-* pooler hosts; older use aws-0-* (see Supabase Dashboard URI). */
const DEFAULT_POOLER_AWS_PREFIX = "aws-1";

export function trimEnv(value) {
  if (value == null) return "";
  const s = String(value).trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    return s.slice(1, -1);
  }
  return s;
}

/** Docs use [password] placeholders; users often paste brackets into .env by mistake. */
export function unwrapBracketPlaceholder(password) {
  if (!password) return password;
  if (
    password.length >= 2 &&
    password.startsWith("[") &&
    password.endsWith("]") &&
    !password.slice(1, -1).includes("[")
  ) {
    return password.slice(1, -1);
  }
  return password;
}

export function projectRefFromSupabaseUrl(url) {
  const trimmed = trimEnv(url);
  if (!trimmed) return "";
  try {
    const host = new URL(trimmed).hostname;
    const db = host.match(/^db\.([a-z0-9]+)\.supabase\.co$/i);
    if (db?.[1]) return db[1];
    const api = host.match(/^([a-z0-9]+)\.supabase\.co$/i);
    return api?.[1] ?? "";
  } catch {
    return "";
  }
}

export function poolerRegion(env) {
  return trimEnv(env.SUPABASE_POOLER_REGION) || DEFAULT_POOLER_REGION;
}

export function poolerAwsPrefix(env) {
  const raw =
    trimEnv(env.SUPABASE_POOLER_AWS_PREFIX) ||
    trimEnv(env.SUPABASE_POOLER_GENERATION) ||
    "";
  if (raw === "1" || /^aws-1$/i.test(raw)) return "aws-1";
  if (raw === "0" || /^aws-0$/i.test(raw)) return "aws-0";
  return DEFAULT_POOLER_AWS_PREFIX;
}

export function poolerPort(env) {
  const p = trimEnv(env.SUPABASE_POOLER_PORT);
  return p === "5432" ? "5432" : "6543";
}

/** Transaction pooler (6543) or session pooler (5432) — IPv4-friendly vs direct db host. */
export function buildPoolerDatabaseUrl(projectRef, env = {}) {
  const region = typeof env === "string" ? env : poolerRegion(env);
  const prefix = typeof env === "string" ? DEFAULT_POOLER_AWS_PREFIX : poolerAwsPrefix(env);
  const port = typeof env === "string" ? "6543" : poolerPort(env);
  return `postgresql://postgres.${projectRef}@${prefix}-${region}.pooler.supabase.com:${port}/postgres`;
}

export function buildDirectDatabaseUrl(projectRef) {
  return `postgresql://postgres@db.${projectRef}.supabase.co:5432/postgres`;
}

/** Direct `db.*` host is often IPv6-only; pooler avoids timeouts on Windows/home ISPs. */
export function shouldPreferPooler(env) {
  const mode = trimEnv(env.SUPABASE_DB_CONNECTION).toLowerCase();
  if (mode === "pooler") return true;
  if (mode === "direct") return false;
  const flag = trimEnv(env.SUPABASE_DB_USE_POOLER).toLowerCase();
  if (flag === "1" || flag === "true" || flag === "yes") return true;
  if (flag === "0" || flag === "false" || flag === "no") return false;
  return process.platform === "win32";
}

function ensurePoolerUsername(url, projectRef) {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("pooler.supabase.com")) return url;
    if (u.username === "postgres" && projectRef) {
      u.username = `postgres.${projectRef}`;
    }
    return u.toString();
  } catch {
    return url;
  }
}

/**
 * Prefer SUPABASE_DB_PASSWORD (avoids URL-encoding issues in .env).
 * Merges password into DATABASE_URL; can rewrite direct → pooler when configured.
 */
export function resolveDatabaseUrl(env) {
  const rawUrl =
    trimEnv(env.DATABASE_URL) ||
    trimEnv(env.SUPABASE_DATABASE_URL) ||
    trimEnv(env.POSTGRES_URL) ||
    "";

  const explicitPassword = unwrapBracketPlaceholder(trimEnv(env.SUPABASE_DB_PASSWORD));
  const projectRef =
    trimEnv(env.SUPABASE_PROJECT_REF) ||
    projectRefFromSupabaseUrl(trimEnv(env.NEXT_PUBLIC_SUPABASE_URL)) ||
    projectRefFromSupabaseUrl(trimEnv(env.SUPABASE_URL)) ||
    (rawUrl ? projectRefFromSupabaseUrl(rawUrl) : "");

  const preferPooler = shouldPreferPooler(env);
  const region = poolerRegion(env);
  const warnings = [];

  let url = rawUrl;

  if (!url && explicitPassword && projectRef) {
    url = preferPooler ? buildPoolerDatabaseUrl(projectRef, env) : buildDirectDatabaseUrl(projectRef);
  }

  if (!url) return { url: "", warnings };

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
      return { url: normalizeDatabaseUrl(url), warnings };
    }

    if (
      preferPooler &&
      projectRef &&
      parsed.hostname === `db.${projectRef}.supabase.co` &&
      (parsed.port === "5432" || parsed.port === "")
    ) {
      url = buildPoolerDatabaseUrl(projectRef, env);
      warnings.push(
        "Rewrote direct db.<ref>.supabase.co:5432 → pooler (IPv4-friendly). " +
          "Set SUPABASE_DB_CONNECTION=direct to keep the direct host."
      );
    }
  } catch {
    /* keep url */
  }

  url = ensurePoolerUsername(url, projectRef);

  try {
    const u = new URL(url);
    if (u.protocol !== "postgresql:" && u.protocol !== "postgres:") {
      return { url: normalizeDatabaseUrl(url), warnings };
    }

    if (explicitPassword) {
      u.password = explicitPassword;
    } else if (u.password) {
      const unwrapped = unwrapBracketPlaceholder(u.password);
      if (unwrapped !== u.password) {
        warnings.push(
          "DATABASE_URL password was wrapped in [brackets] — stripped. Use SUPABASE_DB_PASSWORD without brackets."
        );
        u.password = unwrapped;
      }
      for (const marker of PLACEHOLDER_PASSWORD_MARKERS) {
        if (u.password.includes(marker)) {
          warnings.push(
            `DATABASE_URL still contains ${marker}. Set SUPABASE_DB_PASSWORD from Supabase Dashboard → Database.`
          );
        }
      }
    } else {
      warnings.push(
        "DATABASE_URL has no password. Set SUPABASE_DB_PASSWORD (Supabase Dashboard → Database)."
      );
    }

    return { url: normalizeDatabaseUrl(u.toString()), warnings };
  } catch {
    return { url: normalizeDatabaseUrl(url), warnings };
  }
}

export function validateDatabaseHostname(connectionString) {
  const raw = trimEnv(connectionString);
  if (!raw) return null;
  try {
    const host = new URL(raw).hostname;
    for (const pattern of INVALID_POOLER_HOST_PATTERNS) {
      if (pattern.test(host)) {
        return (
          `Invalid pooler host "${host}". Use aws-0-<region>.pooler.supabase.com from your dashboard (e.g. us-west-2), ` +
          `not GCP region names like us-central1.`
        );
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** Percent-encode password segments so special characters survive URL parsers. */
export function normalizeDatabaseUrl(connectionString) {
  const raw = trimEnv(connectionString);
  if (!raw) return raw;

  try {
    const u = new URL(raw);
    if (u.protocol !== "postgresql:" && u.protocol !== "postgres:") return raw;
    if (!u.password) return raw;
    let decoded = u.password;
    try {
      decoded = decodeURIComponent(u.password);
    } catch {
      decoded = u.password;
    }
    u.password = encodeURIComponent(decoded);
    return u.toString();
  } catch {
    const m = raw.match(/^(postgres(?:ql)?:\/\/)([^/]+@)(.*)$/i);
    if (!m) return raw;
    const creds = m[2].slice(0, -1);
    const colon = creds.indexOf(":");
    if (colon === -1) return raw;
    const user = creds.slice(0, colon);
    const password = creds.slice(colon + 1);
    let decoded = password;
    try {
      decoded = decodeURIComponent(password);
    } catch {
      decoded = password;
    }
    return `${m[1]}${user}:${encodeURIComponent(decoded)}@${m[3]}`;
  }
}

export function authFailureHint() {
  return [
    "Postgres password authentication failed.",
    "",
    "1. Supabase Dashboard → Project Settings → Database → reset/copy the *database* password.",
    "2. In packages/msgf/.env.local:",
    "     SUPABASE_DB_PASSWORD=your_database_password",
    "",
    "Do not use SUPABASE_SERVICE_ROLE_KEY or anon keys as the database password.",
  ].join("\n");
}

export function connectionFailureHint() {
  return [
    "Could not reach Supabase Postgres.",
    "",
    "If you see IPv6 (2600:…) or i/o timeout:",
    "  • Use the transaction pooler (already default on Windows):",
    "      SUPABASE_DB_CONNECTION=pooler",
    "      DATABASE_URL=postgresql://postgres.<ref>@aws-1-us-west-2.pooler.supabase.com:6543/postgres",
    "   If tenant/user not found, try SUPABASE_POOLER_AWS_PREFIX=aws-0 or paste the dashboard URI verbatim.",
    "  • Or copy the full URI from Supabase Dashboard → Database → Connection string.",
    "",
    "Also check VPN/firewall and that the project is not paused in Supabase.",
  ].join("\n");
}
