let keystrokes = [];
let pasteCount = 0;

// Listen for typing
document.addEventListener("keydown", (e) => {
  keystrokes.push({
    key: e.key,
    time: Date.now(),
  });
});

// Listen for cheating (Pastes)
document.addEventListener("paste", (e) => {
  pasteCount++;
  console.log("HAL Alert: Paste detected.");
});

// Periodically send data to the background script
setInterval(() => {
  if (keystrokes.length > 0) {
    chrome.runtime.sendMessage({
      type: "HAL_SESSION_UPDATE",
      data: { keystrokes, pasteCount },
    });
    keystrokes = []; // Clear local buffer after sending
  }
}, 30000); // Every 30 seconds
