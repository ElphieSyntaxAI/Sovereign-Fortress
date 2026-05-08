chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "HAL_SESSION_UPDATE") {
    fetch("http://localhost:3001/api/hal/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Auth header will go here in Phase 2
      },
      body: JSON.stringify({
        content_hash: "sha256_placeholder_hash",
        session_start: new Date(Date.now() - 30000).toISOString(),
        session_end: new Date().toISOString(),
        // Matches the destructuring in your halRoutes.js
        typing_stats: {
          pastes: message.data.pasteCount,
          backspaces: 0,
          rhythm_data: message.data.keystrokes,
          words_added: 0,
        },
        text_sample: "Sample text from extension...",
      }),
    })
      .then((response) => response.json())
      .then((data) => console.log("HAL Ledger Success:", data))
      .catch((err) => console.error("HAL Ledger Error:", err));
  }
});
