const express = require("express");
const db = require("../lib/databaseUrlPool.cjs");
const { verifyToken } = require("../middleware/verifyTokens");
const { provisionAuthor } = require("../services/authorProvisioner");

const router = express.Router();

async function requireAdmin(req, res, next) {
  try {
    if (!req.user?.user_id) {
      return res.status(401).json({ message: "Access denied. No user context." });
    }

    const result = await db.query("SELECT user_role FROM msgf_legacy_users WHERE user_id = $1", [
      req.user.user_id,
    ]);
    const role = result.rows[0]?.user_role;
    if (role !== "admin") {
      return res.status(403).json({ message: "Admin access required." });
    }

    next();
  } catch (e) {
    next(e);
  }
}

// POST /api/admin/provision-author
// Body: same shape as author-template.example.json
router.post("/provision-author", verifyToken, requireAdmin, async (req, res, next) => {
  const cfg = req.body;
  let client;
  try {
    client = await db.getClient();
    await client.query("BEGIN");
    const result = await provisionAuthor({ client, cfg });
    await client.query("COMMIT");
    return res.status(201).json({ success: true, author: result });
  } catch (err) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (_) {
        // ignore
      }
    }
    if (err.code === "23505") {
      return res
        .status(409)
        .json({ error: "Conflict", message: "Username/email/domain already exists." });
    }
    next(err);
  } finally {
    if (client) client.release();
  }
});

module.exports = router;

