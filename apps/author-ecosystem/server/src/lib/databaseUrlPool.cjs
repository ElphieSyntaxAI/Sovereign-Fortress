/**
 * Single Supabase Postgres connection string (direct / pooler).
 * Legacy Docker `DB_HOST` / `DB_PORT` / `dbConfig.js` was removed so missing config fails fast.
 */
const path = require("path");
const { Pool } = require("pg");
const dotenv = require("dotenv");

const repoRoot = path.join(__dirname, "..", "..", "..", "..", "..");
dotenv.config({ path: path.join(repoRoot, ".env") });
dotenv.config({ path: path.join(repoRoot, ".env.local"), override: true });

const connectionString =
  (process.env.DATABASE_URL && String(process.env.DATABASE_URL).trim()) ||
  (process.env.SUPABASE_DATABASE_URL && String(process.env.SUPABASE_DATABASE_URL).trim()) ||
  "";

if (!connectionString) {
  throw new Error(
    "[databaseUrlPool] Set DATABASE_URL or SUPABASE_DATABASE_URL (Supabase Postgres connection string). " +
      "Local DB_* configuration was removed."
  );
}

const pool = new Pool({
  connectionString,
  ssl: String(process.env.DB_SSL || "").toLowerCase() === "true" ? { rejectUnauthorized: false } : undefined,
});

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
  end: () => pool.end(),
};
