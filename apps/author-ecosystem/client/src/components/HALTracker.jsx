import React, { useState, useRef, useEffect } from "react";
import axios from "axios";

import { registerEditorStateProvider } from "../lib/editorSnapshotRegistry";
import { pushKeystrokeEvent } from "../lib/keystrokeRingBuffer";

const HALTracker = () => {
  // --- 1. STATE & REFS ---
  const [text, setText] = useState("");
  const [keystrokes, setKeystrokes] = useState([]);
  const [isReference, setIsReference] = useState(false);
  const lastKeyTime = useRef(performance.now());
  const keyDepths = useRef({}); // Buffer for Dwell Time calculation

  // --- 2. LIFECYCLE ---
  useEffect(() => {
    lastKeyTime.current = performance.now();
  }, []);

  useEffect(() => {
    return registerEditorStateProvider(() => ({
      editor_text_excerpt: text.slice(0, 12000),
    }));
  }, [text]);

  // --- 3. EVENT HANDLERS ---

  // Captures the start of a press and calculates "Flight Time" (gap between keys)
  const handleKeyDown = (e) => {
    const now = performance.now();

    // Start tracking physical press duration
    if (!keyDepths.current[e.key]) {
      keyDepths.current[e.key] = now;
    }

    const flightTime = Math.round(now - lastKeyTime.current);

    const newEntry = {
      key: e.key,
      timestamp: new Date().toISOString(),
      flightTime,
      dwellTime: 0, // Updated on KeyUp
      isBackspace: e.key === "Backspace",
      isSystemEvent: false,
    };

    setKeystrokes((prev) => [...prev, newEntry]);
    pushKeystrokeEvent(newEntry);
    lastKeyTime.current = now;
  };

  // Captures the end of a press to calculate "Dwell Time" (physical hold duration)
  const handleKeyUp = (e) => {
    const upTime = performance.now();
    const downTime = keyDepths.current[e.key];

    if (downTime) {
      const dwell = Math.round(upTime - downTime);

      setKeystrokes((prev) => {
        const newState = [...prev];
        // Efficiently update the matching Down event
        for (let i = newState.length - 1; i >= 0; i--) {
          if (newState[i].key === e.key && newState[i].dwellTime === 0) {
            newState[i].dwellTime = dwell;
            break;
          }
        }
        return newState;
      });

      delete keyDepths.current[e.key];
    }
  };

  // Tracks paste events as special "System Events" to detect AI/External input
  const handlePaste = (e) => {
    const pastedText = e.clipboardData.getData("text");
    const words = pastedText
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0).length;

    const pasteEntry = {
      key: "PASTE_EVENT",
      timestamp: new Date().toISOString(),
      wordsPasted: words,
      isSystemEvent: true,
    };

    setKeystrokes((prev) => [...prev, pasteEntry]);
    pushKeystrokeEvent(pasteEntry);
  };

  // --- 4. API ACTIONS ---

  const saveToLedger = async () => {
    if (!text.trim()) return alert("Please enter text before saving.");

    try {
      await axios.post(
        "/api/hal/session",
        {
          content: text,
          keystroke_data: keystrokes,
          is_reference: isReference,
        },
        { headers: { "x-tenant-id": "author-ecosystem-main" } }
      );

      alert("Authorship Verified & Ledgered!");
      setText("");
      setKeystrokes([]);
    } catch (err) {
      console.error("Ledger Save Error:", err.response?.data || err.message);
      alert("Failed to sync with the Ledger.");
    }
  };

  // --- 5. RENDER ---
  return (
    <div style={styles.container}>
      <h2 style={styles.title}>HAL Authorship Tracker</h2>
      <p style={styles.hint}>
        Live pillar stoplights and logic-drift charts update in the Planning command center above. Keystrokes you
        type here feed the same glass-box diagnostic used by Report issue.
      </p>

      <textarea
        rows="10"
        style={styles.textArea}
        placeholder="Begin writing to capture your unique rhythm..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onPaste={handlePaste}
      />

      <div style={styles.controls}>
        <button onClick={saveToLedger} style={styles.button}>
          Sign & Push to Ledger
        </button>
        <div style={styles.stats}>{keystrokes.length} events logged</div>
        <label style={{ fontSize: "14px", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={isReference}
            onChange={(e) => setIsReference(e.target.checked)}
          />
          Record as Master Baseline
        </label>

        <div style={styles.stats}>{keystrokes.length} events logged</div>
      </div>

      <div style={styles.monitorContainer}>
        <p style={styles.monitorLabel}>Live Rhythm Monitor (Dwell / Flight):</p>
        <div style={styles.monitorScroll}>
          {keystrokes.slice(-12).map((k, i) => (
            <div
              key={i}
              style={{
                ...styles.eventBox,
                background: k.isSystemEvent
                  ? "#ff7675"
                  : k.isBackspace
                  ? "#f1c40f"
                  : "#ecf0f1",
                color: k.isSystemEvent ? "white" : "black",
              }}
            >
              {k.isSystemEvent
                ? `Paste: ${k.wordsPasted}w`
                : `${k.dwellTime}ms / ${k.flightTime}ms`}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// --- 6. STYLES (Kept outside component for performance) ---
const styles = {
  container: {
    maxWidth: "800px",
    margin: "20px auto",
    background: "#fff",
    padding: "30px",
    borderRadius: "12px",
    boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
    fontFamily: "'Inter', sans-serif",
  },
  title: { fontSize: "1.2rem", color: "#2d3436", marginBottom: "20px" },
  hint: {
    fontSize: "13px",
    color: "#636e72",
    marginBottom: "16px",
    lineHeight: 1.5,
  },
  textArea: {
    width: "100%",
    padding: "15px",
    borderRadius: "8px",
    border: "1px solid #dfe6e9",
    fontSize: "16px",
    lineHeight: "1.6",
    outline: "none",
    boxSizing: "border-box",
  },
  controls: {
    marginTop: "20px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  button: {
    backgroundColor: "#2c3e50",
    color: "#fff",
    padding: "12px 24px",
    border: "none",
    borderRadius: "6px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "background 0.2s",
  },
  stats: { fontSize: "14px", color: "#636e72" },
  monitorContainer: {
    marginTop: "25px",
    paddingTop: "15px",
    borderTop: "1px solid #f1f2f6",
  },
  monitorLabel: {
    fontSize: "11px",
    fontWeight: "bold",
    color: "#b2bec3",
    textTransform: "uppercase",
  },
  monitorScroll: {
    display: "flex",
    gap: "8px",
    overflowX: "auto",
    padding: "10px 0",
  },
  eventBox: {
    minWidth: "80px",
    padding: "8px",
    borderRadius: "6px",
    fontSize: "10px",
    textAlign: "center",
    transition: "all 0.1s",
  },
};

export default HALTracker;
