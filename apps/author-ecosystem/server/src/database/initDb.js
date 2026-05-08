const fs = require("fs");
const path = require("path");
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

function readSql(relPath) {
  const p = path.join(__dirname, relPath);
  return fs.readFileSync(p, "utf8").toString();
}

function splitSqlStatements(sql) {
  const out = [];
  let cur = "";
  let i = 0;
  let inSingle = false;
  let inDouble = false;
  let inDollar = false;

  while (i < sql.length) {
    const ch = sql[i];
    const next2 = sql.slice(i, i + 2);

    // Line comments
    if (!inSingle && !inDouble && !inDollar && next2 === "--") {
      const nl = sql.indexOf("\n", i + 2);
      if (nl === -1) break;
      cur += sql.slice(i, nl + 1);
      i = nl + 1;
      continue;
    }

    // Dollar-quoted blocks (we use $$ ... $$ in this repo)
    if (!inSingle && !inDouble && sql.slice(i, i + 2) === "$$") {
      inDollar = !inDollar;
      cur += "$$";
      i += 2;
      continue;
    }

    if (!inDouble && !inDollar && ch === "'" && sql[i - 1] !== "\\") {
      inSingle = !inSingle;
      cur += ch;
      i += 1;
      continue;
    }

    if (!inSingle && !inDollar && ch === '"' && sql[i - 1] !== "\\") {
      inDouble = !inDouble;
      cur += ch;
      i += 1;
      continue;
    }

    if (!inSingle && !inDouble && !inDollar && ch === ";") {
      const stmt = cur.trim();
      if (stmt) out.push(stmt);
      cur = "";
      i += 1;
      continue;
    }

    cur += ch;
    i += 1;
  }

  const tail = cur.trim();
  if (tail) out.push(tail);
  return out;
}

async function execSql(client, sql, label) {
  const statements = splitSqlStatements(sql);
  for (let idx = 0; idx < statements.length; idx++) {
    const stmt = statements[idx];
    try {
      await client.query(stmt);
    } catch (e) {
      e.message = `${label} failed at statement ${idx + 1}/${statements.length}: ${e.message}`;
      throw e;
    }
  }
}

async function main() {
  const reset = String(process.env.DB_RESET || "").toLowerCase() === "true";
  if (!reset) {
    console.error(
      "Refusing to initialize database because DB_RESET is not 'true'.\n" +
        "This project schema.sql begins with DROP statements.\n" +
        "To run a destructive init in Docker/dev, set DB_RESET=true."
    );
    process.exit(2);
  }

  const pool = new Pool(buildPoolConfig());

  try {
    console.log("DB init: connecting...");
    const client = await pool.connect();
    try {
      await client.query("SELECT 1");

      const schemaSql = readSql("schema.sql");
      const seedSql = readSql(path.join("seed_data", "seed_data.sql"));

      console.log("DB init: applying schema...");
      await execSql(client, schemaSql, "schema.sql");
      console.log("DB init: schema applied.");

      console.log("DB init: applying seed data...");
      await execSql(client, seedSql, "seed_data.sql");
      console.log("DB init: seed applied.");

      console.log("✅ DB init complete.");
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("❌ DB init failed:", err.message);
  process.exit(1);
});

