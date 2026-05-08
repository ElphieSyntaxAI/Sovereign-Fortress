const bcrypt = require("bcrypt");

function required(obj, key) {
  if (!obj || obj[key] === undefined || obj[key] === null || obj[key] === "") {
    const err = new Error(`Missing required field '${key}'`);
    err.status = 400;
    throw err;
  }
  return obj[key];
}

async function provisionAuthor({ client, cfg }) {
  const username = required(cfg, "username");
  const email = required(cfg, "email");
  const password = required(cfg, "password");
  const displayName = required(cfg, "display_name");
  const domainName = required(cfg, "domain_name");

  const projectId = cfg.project_id || null;
  const schemaName = cfg.schema_name || "public";
  const preferredTheme = cfg.preferred_theme || "Pleasure";
  const themeConfig = cfg.theme_config || {};
  const personaConfig = cfg.persona_config || {};

  // Pick default author tier (Tier 2).
  const tierRes = await client.query("SELECT tier_id FROM tiers WHERE name = $1", [
    "Tier 2: Core Author",
  ]);
  const tierId = tierRes.rows[0]?.tier_id;
  if (!tierId) {
    const err = new Error("Missing tier 'Tier 2: Core Author' in tiers table. Run db:init first.");
    err.status = 500;
    throw err;
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

  return { user_id: userId, domain_name: domainName, project_id: projectId };
}

module.exports = { provisionAuthor };

