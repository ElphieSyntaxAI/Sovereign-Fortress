const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");
const { Pool } = require("pg");

function buildPoolConfig() {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined,
    };
  }

  const required = ["DB_HOST", "DB_PORT", "DB_DATABASE", "DB_USER", "DB_PASSWORD"];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(`Missing DB env vars: ${missing.join(", ")} (or set DATABASE_URL)`);
  }

  return {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_DATABASE,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  };
}

function readJson(p) {
  const full = path.isAbsolute(p) ? p : path.join(process.cwd(), p);
  return JSON.parse(fs.readFileSync(full, "utf8"));
}

function required(obj, key) {
  if (!obj[key]) throw new Error(`Missing required field '${key}' in config`);
  return obj[key];
}

async function main() {
  const configPath = process.argv[2];
  if (!configPath) {
    console.error("Usage: node src/scripts/provisionAuthor.js path/to/author.json");
    process.exit(2);
  }

  const cfg = readJson(configPath);

  const username = required(cfg, "username");
  const email = required(cfg, "email");
  const password = required(cfg, "password");
  const displayName = required(cfg, "display_name");
  const domainName = required(cfg, "domain_name");
  const schemaName = cfg.schema_name || "public";
  const preferredTheme = cfg.preferred_theme || "Pleasure";
  const themeConfig = cfg.theme_config || {};
  const personaConfig = cfg.persona_config || {};

  const pool = new Pool(buildPoolConfig());

  try {
    await pool.query("SELECT 1");

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Pick default author tier (Tier 2) if present, otherwise fall back to Tier 1.
      const tierRes = await client.query(
        "SELECT tier_id FROM tiers WHERE name = $1",
        ["Tier 2: Core Author"]
      );
      const tierId = tierRes.rows[0]?.tier_id;
      if (!tierId) {
        throw new Error("Missing tier 'Tier 2: Core Author' in tiers table. Run db:init first.");
      }

      const passwordHash = await bcrypt.hash(password, 10);

      const userRes = await client.query(
        `INSERT INTO users (username, email, tier_id, password_hash, user_role, preferred_theme)
         VALUES ($1, $2, $3, $4, 'author', $5)
         RETURNING user_id`,
        [username, email, tierId, passwordHash, preferredTheme]
      );
      const userId = userRes.rows[0].user_id;

      await client.query(
        `INSERT INTO custom_domains (author_user_id, domain_name, is_verified)
         VALUES ($1, $2, FALSE)`,
        [userId, domainName]
      );

      // Used by tenantResolver lookup (domain -> schema)
      await client.query(
        `INSERT INTO tenants (domain_name, author_name, schema_name)
         VALUES ($1, $2, $3)
         ON CONFLICT (domain_name) DO NOTHING`,
        [domainName, displayName, schemaName]
      );

      await client.query(
        `INSERT INTO author_profiles (author_user_id, domain_name, display_name, theme_config, persona_config)
         VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)`,
        [userId, domainName, displayName, JSON.stringify(themeConfig), JSON.stringify(personaConfig)]
      );

      await client.query("COMMIT");

      console.log("✅ Author provisioned");
      console.log(JSON.stringify({ user_id: userId, domain_name: domainName }, null, 2));
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("❌ Provision failed:", err.message);
  process.exit(1);
});

