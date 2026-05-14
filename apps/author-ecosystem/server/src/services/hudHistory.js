const { getClient, query } = require("../lib/databaseUrlPool.cjs");

/**
 * Persist HUD chat answer; keeps the newest 5 rows per author_user_id.
 * @param {{ authorUserId: string, projectId: string | null, question: string, answer: string, hudPayload?: Record<string, unknown> }} row
 */
async function recordHudHistory({ authorUserId, projectId, question, answer, hudPayload = {} }) {
  const client = await getClient();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO msgf_legacy_hud_history (author_user_id, project_id, question, answer, hud_payload)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5::jsonb)`,
      [authorUserId, projectId || null, String(question || ""), String(answer || ""), JSON.stringify(hudPayload || {})]
    );
    await client.query(
      `DELETE FROM msgf_legacy_hud_history h
        WHERE h.author_user_id = $1::uuid
          AND h.id NOT IN (
            SELECT id FROM msgf_legacy_hud_history
             WHERE author_user_id = $1::uuid
             ORDER BY created_at DESC, id DESC
             LIMIT 5
          )`,
      [authorUserId]
    );
    await client.query("COMMIT");
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {
      /* ignore */
    }
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Latest HUD answer for this author + project (NULL project_id matches NULL-only rows).
 * @param {string} authorUserId
 * @param {string | null} projectId
 */
async function fetchLatestHudAnswerForProject(authorUserId, projectId) {
  const { rows } = await query(
    `SELECT answer, question, hud_payload, created_at, id
       FROM msgf_legacy_hud_history
      WHERE author_user_id = $1::uuid
        AND (project_id IS NOT DISTINCT FROM $2::uuid)
      ORDER BY created_at DESC, id DESC
      LIMIT 1`,
    [authorUserId, projectId || null]
  );
  return rows[0] || null;
}

module.exports = { recordHudHistory, fetchLatestHudAnswerForProject };
