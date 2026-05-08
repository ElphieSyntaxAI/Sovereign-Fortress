require("dotenv").config({ path: "../.env" });
const fs = require("fs");
const path = require("path"); //
const db = require("../config/dbConfig");

// Define paths to schema and seed files
const SCHEMA_PATH = path.join(__dirname, "schema.sql");
const SEED_PATH = path.join(__dirname, "seed_data", "seed_data.sql");

const runSchema = async () => {
  try {
    console.log("Starting database setup...");
    console.log("Reading schema file...");

    let schema = fs.readFileSync(SCHEMA_PATH, "utf8").toString();
    await db.query(schema);
    console.log("✅ Database schema created successfully.");

    // RUN SEED DATA (POPULATE TIERS)
    console.log("Reading seed data file...");

    let seed = fs.readFileSync(SEED_PATH, "utf8").toString();
    await db.query(seed);
    console.log("✅ Database seeded successfully (Tiers defined).");
  } catch (err) {
    console.error("❌ Database setup failed:", err.message);
  } finally {
    if (db.end) {
      db.end();
    }
    process.exit();
  }
};

runSchema();
