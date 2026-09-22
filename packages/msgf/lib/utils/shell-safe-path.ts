/**
 * @msgf-license-header
 * Proprietary and Confidential
 * Copyright (c) Elphie Syntax LLC. All Rights Reserved.
 *
 * This source code and associated documentation are the exclusive property of
 * Elphie Syntax LLC. Unauthorized copying, distribution, publication, or
 * reverse-engineering — including decompilation, disassembly, or derivative
 * works — is strictly prohibited without prior written consent.
 *
 * Distribution Build ID: MSGF-b4dfaf97-20260922T171835Z-internal
 */
/**
 * Shell-safe path and verify-command guards for IDE execution surfaces.
 */

const SHELL_METACHAR_RE = /[;|&`$<>()\n\r]/;

/** Workspace-relative path safe to embed in allowlisted verify commands. */
export function isSafeRepoRelativePath(raw: string): boolean {
  const norm = raw.replace(/\\/g, "/").replace(/^\.\/+/, "").trim();
  if (!norm || norm.startsWith("/") || /^[a-zA-Z]:/.test(norm)) return false;
  if (norm.includes("..") || norm.includes("://")) return false;
  if (SHELL_METACHAR_RE.test(norm)) return false;
  if (!/^[\w./@\-]+$/.test(norm)) return false;
  return norm.includes("/") || /^(Gemfile|Rakefile|Dockerfile|package\.json)$/i.test(norm);
}

const ALLOWED_COMMAND_PATTERNS: readonly RegExp[] = [
  /^npm run build$/,
  /^npm test$/,
  /^npm test -- [\w./@\-]+$/,
  /^bundle exec rails test$/,
  /^bundle exec rails test [\w./@\-]+$/,
];

export function assertAllowedVerifyCommand(command: string): string {
  const trimmed = command.trim();
  if (!trimmed) {
    throw new Error("Empty verify command.");
  }
  if (SHELL_METACHAR_RE.test(trimmed)) {
    throw new Error("Verify command contains disallowed shell metacharacters.");
  }
  if (!ALLOWED_COMMAND_PATTERNS.some((re) => re.test(trimmed))) {
    throw new Error(`Verify command not allowlisted: ${trimmed.slice(0, 120)}`);
  }
  return trimmed;
}

/** Redact likely secrets from terminal snippets before cloud upload. */
export function redactTerminalSnippet(text: string, maxChars = 2000): string {
  const redacted = text
    .replace(
      /(?:api[_-]?key|auth[_-]?token|access[_-]?token|secret|password|bearer)\s*[:=]\s*\S+/gi,
      "[REDACTED]"
    )
    .replace(/msgf_ide_[A-Za-z0-9._-]+/g, "[REDACTED_IDE_TOKEN]")
    .replace(/sk-[A-Za-z0-9]{8,}/g, "[REDACTED_KEY]");
  const t = redacted.trim();
  if (t.length <= maxChars) return t;
  return t.slice(-maxChars);
}
