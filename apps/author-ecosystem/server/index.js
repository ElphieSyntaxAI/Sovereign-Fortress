const express = require("express");
const cors = require("cors");
const app = require("./server");
/** Default 3003 so `tsx src/main.ts` (PORT 3002) can proxy RAG/Lore-Git here without collision. */
const PORT = process.env.LEGACY_EXPRESS_PORT || process.env.PORT || 3003;
// Only listen if this file is executed directly (the main entry point)
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

app.get("/api/ping", (req, res) => {
  res.json({ message: "Server is reachable!" });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
