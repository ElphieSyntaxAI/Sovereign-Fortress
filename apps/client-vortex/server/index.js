/**
 * Client Vortex API — minimal health surface for Master Admin / tenant probes.
 *
 * CORS: always allows `https://elphiesgatedai.elphiesyntax.com`. Add more origins
 * (e.g. Master Admin dashboard) via comma-separated `VORTEX_CORS_ORIGINS`.
 */
const express = require("express");
const cors = require("cors");

const PORT = Number(process.env.PORT) || 3010;
const GATED_AI_ORIGIN = "https://elphiesgatedai.elphiesyntax.com";

const app = express();

const allowedOrigins = new Set(
  (process.env.VORTEX_CORS_ORIGINS || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean)
);

/** Required for HITL / Gated AI to run browser health checks against Client Vortex. */
allowedOrigins.add(GATED_AI_ORIGIN);

const corsHealth = cors({
  origin(origin, callback) {
    if (!origin) {
      callback(null, false);
      return;
    }
    if (allowedOrigins.has(origin)) {
      callback(null, origin);
      return;
    }
    callback(null, false);
  },
  methods: ["GET", "OPTIONS"],
  credentials: false,
});

app.options("/api/health", corsHealth);
app.get("/api/health", corsHealth, (_req, res) => {
  res.json({ status: "ok", version: "1.0.0" });
});

app.listen(PORT, () => {
  console.log(`@elphie-syntax/vortex-server listening on ${PORT}`);
});
