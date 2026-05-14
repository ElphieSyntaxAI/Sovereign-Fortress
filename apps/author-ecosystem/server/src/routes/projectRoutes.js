const express = require("express");
const db = require("../lib/databaseUrlPool.cjs");
const { verifyToken } = require("../middleware/verifyTokens");

const router = express.Router();

// GET /api/projects
router.get("/", verifyToken, async (req, res, next) => {
  try {
    const authorUserId = req.user.user_id;
    const rows = (
      await db.query(
        `SELECT project_id, title, description, status, is_public, target_word_count, created_at
           FROM msgf_legacy_projects
          WHERE author_user_id = $1
          ORDER BY created_at DESC`,
        [authorUserId]
      )
    ).rows;
    res.json({ success: true, projects: rows });
  } catch (e) {
    next(e);
  }
});

// POST /api/projects
// Body: { title, description?, target_word_count?, is_public? }
router.post("/", verifyToken, async (req, res, next) => {
  try {
    const authorUserId = req.user.user_id;
    const { title, description = null, target_word_count = null, is_public = false } = req.body || {};
    if (!title) return res.status(400).json({ error: "title is required" });

    const row = (
      await db.query(
        `INSERT INTO msgf_legacy_projects (author_user_id, title, description, target_word_count, is_public)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING project_id, title, description, status, is_public, target_word_count, created_at`,
        [authorUserId, title, description, target_word_count, Boolean(is_public)]
      )
    ).rows[0];

    res.status(201).json({ success: true, project: row });
  } catch (e) {
    next(e);
  }
});

module.exports = router;

