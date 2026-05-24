const express = require("express");
const router = express.Router();
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const tenantResolver = require("./src/middleware/tenantResolver");

const path = require("path");
const dotenv = require("dotenv");
/** Same root `.env` as the TS BFF (`loadMonorepoRootEnv`) so `JWT_SECRET` matches `jwt.verify` on :3002. */
const monorepoRoot = path.join(__dirname, "..", "..", "..");
dotenv.config({ path: path.join(monorepoRoot, ".env") });
dotenv.config({ path: path.join(monorepoRoot, ".env.local"), override: true });
dotenv.config({ path: path.join(__dirname, ".env") });

const db = require("./src/lib/databaseUrlPool.cjs"); // Supabase Postgres via DATABASE_URL

const app = express(); // Initialize the app object

// --- START: Security and Global Middleware (MUST COME FIRST) ---

// 1. Rate Limiting: Protects against denial-of-service/brute-force attacks.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});
// Tenant resolution middleware

// Security Headers: Set various HTTP headers for security.
app.use(helmet());

// CORS: Allows cross-origin requests from your frontend.
app.use(cors());

// Body Parser: Parses incoming JSON requests.
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// --- END: Security and Global Middleware ---
const ragRoutes = require("./src/routes/ragRoutes");
app.use("/api/rag", ragRoutes);
const loreGitRoutes = require("./src/routes/loreGitRoutes");
app.use("/api/lore-git", loreGitRoutes);
const adminRoutes = require("./src/routes/adminRoutes");
app.use("/api/admin", adminRoutes);
// --- 1. ROUTE IMPORTS ---
const authRoutes = require("./src/routes/authRoutes");
const testRoutes = require("./src/routes/testRoutes");
// Import the Human Authorship Ledger routes

// --- 2. ROUTE USAGE ---
//app.use(limiter);
//app.use(tenantResolver);

app.use("/api/auth", authRoutes);
app.use("/api/test", testRoutes);
// Mount the HAL routes at /api/hal

// --- 3. SYSTEM ENDPOINTS ---

// Health check endpoint
app.get("/api/status", async (req, res) => {
  try {
    await db.query("SELECT 1"); // simple query to check DB connection
    res.status(200).json({ status: "ok", message: "Database connected" });
  } catch (err) {
    res.status(500).json({ status: "error", message: "Database unreachable" });
  }
});

module.exports = app;

app.use((err, req, res, next) => {
  console.error("DEBUGGER - Internal Error:", err);

  res.status(err.status || 500).json({
    error: "Server Error",
    message: err.message, // This will tell us the EXACT problem
    detail: err.detail, // Specific Postgres hints
    code: err.code, // Postgres error codes (like 23503)
    stack: err.stack, // The line number in your code
  });
});

// --- Server Start (Moved to a separate index.js file) ---
