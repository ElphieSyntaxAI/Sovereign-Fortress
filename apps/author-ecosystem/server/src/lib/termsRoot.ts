import path from "node:path";
import { fileURLToPath } from "node:url";

/** Absolute path to `apps/author-ecosystem/terms` (sibling of `server/`). */
export const TERMS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../terms");
