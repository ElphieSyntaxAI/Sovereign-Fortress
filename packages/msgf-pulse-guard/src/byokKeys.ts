import * as fs from "node:fs";
import * as path from "node:path";

import { MSGF_BYOK_CLAUDE_HEADER, MSGF_BYOK_GEMINI_HEADER } from "./constants";
import { getMsgfKeysDir } from "./workspace/msgfWorkspace";

export type WorkspaceByokKeys = {
  gemini: string | null;
  claude: string | null;
};

function readKeyFile(filePath: string): string | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      const candidate =
        eq > 0 && /^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed.slice(0, eq))
          ? trimmed.slice(eq + 1).trim()
          : trimmed;
      if (candidate.length >= 8) return candidate;
    }
    return null;
  } catch {
    return null;
  }
}

/** Read `.msgf/keys/gemini.key` and `.msgf/keys/claude.key` when populated. */
export function readWorkspaceByokKeys(workspaceRoot: string | null): WorkspaceByokKeys {
  if (!workspaceRoot) {
    return { gemini: null, claude: null };
  }

  const keysDir = getMsgfKeysDir(workspaceRoot);
  return {
    gemini: readKeyFile(path.join(keysDir, "gemini.key")),
    claude: readKeyFile(path.join(keysDir, "claude.key")),
  };
}

/** Attach BYOK headers for cloud dual-model consensus (no platform API cost). */
export function buildByokPulseHeaders(keys: WorkspaceByokKeys): Record<string, string> {
  const headers: Record<string, string> = {};
  if (keys.gemini) {
    headers[MSGF_BYOK_GEMINI_HEADER] = keys.gemini;
  }
  if (keys.claude) {
    headers[MSGF_BYOK_CLAUDE_HEADER] = keys.claude;
  }
  return headers;
}
