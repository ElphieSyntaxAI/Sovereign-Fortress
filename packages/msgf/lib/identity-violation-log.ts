import { appendFile, mkdir } from "fs/promises";
import path from "path";

const LOG_REL = [".msgf", "identity-violations.ndjson"] as const;

function logPath(): string {
  return path.join(process.cwd(), ...LOG_REL);
}

export type IdentityViolationPayload = Record<string, unknown>;

/**
 * Append one NDJSON line to MSGF local ledger (packages/msgf/.msgf/… when cwd is msgf app).
 */
export async function logIdentityViolation(
  payload: IdentityViolationPayload
): Promise<void> {
  const dir = path.join(process.cwd(), ".msgf");
  await mkdir(dir, { recursive: true });
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    kind: "IDENTITY_VIOLATION",
    ...payload,
  });
  await appendFile(logPath(), `${line}\n`, "utf8");
}
