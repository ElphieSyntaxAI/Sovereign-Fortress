import cors from "cors";
import express from "express";

import { halController } from "./controllers/hal.controller.js";
import { librarianController } from "./controllers/librarian.controller.js";
import { recalibrationController } from "./controllers/recalibration.controller.js";
import { rootController } from "./controllers/root.controller.js";

const app = express();
const port = Number(process.env.PORT) || 3002;

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(rootController);
app.use(halController);
app.use(librarianController);
app.use(recalibrationController);

app.listen(port, "127.0.0.1", () => {
  console.log(`author-ecosystem server listening on http://127.0.0.1:${port}`);
});
