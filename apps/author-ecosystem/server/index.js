const express = require("express");
const cors = require("cors");
const app = require("./server");
/** Listen on `LEGACY_EXPRESS_PORT` (default **3003**). Do not fall back to `PORT` — that is reserved for the TS BFF (default 3002). */
const rawPort = (process.env.LEGACY_EXPRESS_PORT ?? "3003").trim();
const PORT = Number(rawPort) || 3003;
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
