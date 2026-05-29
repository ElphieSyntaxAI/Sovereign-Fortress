/** Shell-safe path and verify-command guards (mirrors server allowlist). */

const SHELL_METACHAR_RE = /[;|&`$<>()\n\r]/;

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

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
