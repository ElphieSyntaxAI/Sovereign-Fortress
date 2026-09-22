import { createHash } from "node:crypto";

/** SHA-256 of the keystroke payload already posted. Does not add a new body field. */
export function hashPulsePayload(keystrokes: unknown): string {
  return createHash("sha256").update(JSON.stringify(keystrokes), "utf8").digest("hex");
}
