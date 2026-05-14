import path from "node:path";
import { fileURLToPath } from "node:url";

/** Absolute path to `apps/author-ecosystem/nda` (sibling of `server/`). */
export const NDA_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../nda");
