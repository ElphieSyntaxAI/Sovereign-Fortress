const express = require("express");
const router = express.Router();
const db = require("../config/dbConfig");
const { verifyToken } = require("../middleware/verifyTokens");

router.post("/session", verifyToken, async (req, res) => {
  const { content, keystroke_data, is_reference } = req.body;

  try {
    if (!Array.isArray(keystroke_data)) {
      return res.status(400).json({ error: "keystroke_data must be an array" });
    }

    // --- 1. BIOMETRIC ANALYSIS ---
    const backspaceEvents = keystroke_data.filter((k) => k.isBackspace);
    const pasteEvents = keystroke_data.filter((k) => k.isSystemEvent);

    // Calculate Backspace Rhythm (FlightTime between deletions)
    let totalBackspaceGap = 0;
    for (let i = 1; i < backspaceEvents.length; i++) {
      totalBackspaceGap += backspaceEvents[i].flightTime;
    }
    const avgBackspaceRhythm =
      backspaceEvents.length > 1
        ? Math.round(totalBackspaceGap / backspaceEvents.length)
        : 0;

    // Calculate Average Dwell Time (Physical key hold duration)
    const totalDwell = keystroke_data.reduce(
      (acc, k) => acc + (k.dwellTime || 0),
      0
    );
    const avgDwell =
      keystroke_data.length > 0
        ? Math.round(totalDwell / keystroke_data.length)
        : 0;

    // --- 2. PREPARE LEDGER OBJECT ---
    const ledgerData = {
      metrics: {
        total_backspaces: backspaceEvents.length,
        total_pastes: pasteEvents.length,
        avg_dwell_ms: avgDwell,
        backspace_rhythm: avgBackspaceRhythm,
      },
      raw_rhythm: keystroke_data,
      sample_preview: content ? content.substring(0, 200) : "",
      metadata: {
        event_count: keystroke_data.length,
        client_timestamp: new Date().toISOString(),
      },
    };

    // --- 3. DATABASE PERSISTENCE ---
    const userId = req.user.user_id || req.user.id;

    const sql = `
      INSERT INTO hal_ledger (author_id, content_hash, keystroke_data, is_reference, session_start, session_end)
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      RETURNING hal_id;
    `;

    const result = await db.query(sql, [
      userId,
      "temp_hash_" + Date.now(),
      JSON.stringify(ledgerData),
      is_reference || false,
    ]);

    // --- 4. SUCCESS RESPONSE ---
    res.status(201).json({
      success: true,
      message: "Authorship Verified & Ledgered",
      hal_id: result.rows[0].hal_id,
      analysis: ledgerData.metrics, // Send back the analysis for UI feedback
    });
  } catch (err) {
    console.error("HAL Ledger Error:", err);

    if (err.code === "23503") {
      return res
        .status(404)
        .json({ error: "Author not found. Please log in." });
    }

    res.status(500).json({ error: "Audit failed. Server error." });
  }
});

module.exports = router;
