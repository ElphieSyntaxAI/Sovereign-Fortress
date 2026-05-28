/**
 * Maps MSGF API failures to actionable codes for IDE UI (aligns with server ide-error-codes).
 */
export type MsgfHttpErrorCode =
  | "AUTH_MISSING"
  | "AUTH_EXPIRED"
  | "AUTH_INVALID"
  | "TENANT_MISMATCH"
  | "ENTITLEMENT_DENIED"
  | "CREDITS_402"
  | "GATEWAY_TIMEOUT"
  | "GATEWAY_504"
  | "DNS_UNREACHABLE"
  | "NETWORK_ERROR"
  | "SERVER_ERROR"
  | "UNKNOWN";

export type ClassifiedHttpError = {
  code: MsgfHttpErrorCode;
  message: string;
  fixSteps: string[];
};

const FIX = {
  authMissing: [
    "Open MSGF: Open IDE token setup (browser) and sign in.",
    "Run MSGF: Apply workspace settings or paste msgf.authToken into .vscode/settings.json.",
    "Reload the VS Code window.",
  ],
  authExpired: [
    "In the browser: Workspace → IDE setup → Refresh token.",
    "Update msgf.authToken in workspace settings (remove stray quotes).",
    "Reload the window and run MSGF: Test connection.",
  ],
  authInvalid: [
    "Remove surrounding quotes from msgf.authToken and msgf.tenantKey.",
    "Ensure settings are in Workspace (.vscode/settings.json), not only User settings.",
    "Copy a fresh token from Workspace → IDE setup.",
  ],
  tenant: [
    "Map the project at Gated AI → Setup projects (e.g. deckhostwmsgf/deck_host).",
    "Set msgf.tenantKey to the mapped project_origin exactly.",
  ],
  gateway504: [
    "Wait 30s and run MSGF: Test connection again (Cloud Run cold start).",
    "Confirm msgf.apiUrl is https://elphiesgatedai.elphiesyntax.com (or your deployed host).",
    "Check https://elphiesgatedai.elphiesyntax.com/status",
  ],
  dns: [
    "Check network connectivity and msgf.apiUrl spelling.",
    "If using localhost, ensure packages/msgf dev server is running.",
  ],
} as const;

function bodyCode(body: Record<string, unknown> | undefined): string | null {
  const raw =
    body?.code ??
    body?.error_code ??
    (typeof body?.error === "object" && body.error !== null
      ? (body.error as Record<string, unknown>).code
      : null);
  return typeof raw === "string" ? raw : null;
}

function bodyMessage(body: Record<string, unknown> | undefined, fallback: string): string {
  if (typeof body?.error === "string") return body.error;
  if (typeof body?.message === "string") return body.message;
  return fallback;
}

export function classifyHttpError(input: {
  status?: number;
  body?: Record<string, unknown>;
  networkMessage?: string;
}): ClassifiedHttpError {
  const status = input.status;
  const body = input.body;
  const net = input.networkMessage?.trim() ?? "";

  if (net) {
    const lower = net.toLowerCase();
    if (lower.includes("fetch failed") || lower.includes("enotfound") || lower.includes("getaddrinfo")) {
      return {
        code: "DNS_UNREACHABLE",
        message: net,
        fixSteps: [...FIX.dns],
      };
    }
    if (lower.includes("abort") || lower.includes("timeout")) {
      return {
        code: "GATEWAY_TIMEOUT",
        message: net,
        fixSteps: [...FIX.gateway504],
      };
    }
    return {
      code: "NETWORK_ERROR",
      message: net,
      fixSteps: [...FIX.dns],
    };
  }

  const headerCode = bodyCode(body);
  if (headerCode === "ERR_LICENSE_MISSING" || status === 401) {
    const expired =
      net.toLowerCase().includes("jwt") ||
      bodyMessage(body, "").toLowerCase().includes("expired") ||
      bodyMessage(body, "").toLowerCase().includes("invalid");
    return {
      code: expired ? "AUTH_EXPIRED" : status === 401 ? "AUTH_INVALID" : "AUTH_MISSING",
      message: bodyMessage(body, status === 401 ? "Unauthorized" : "Authentication required"),
      fixSteps: expired ? [...FIX.authExpired] : [...FIX.authInvalid],
    };
  }

  if (status === 402) {
    return {
      code: "CREDITS_402",
      message: bodyMessage(body, "Insufficient credits"),
      fixSteps: ["Check tenant wallet / credits on the MSGF dashboard."],
    };
  }

  if (status === 403) {
    return {
      code: headerCode?.includes("TENANT") ? "TENANT_MISMATCH" : "ENTITLEMENT_DENIED",
      message: bodyMessage(body, "Forbidden"),
      fixSteps: headerCode?.includes("TENANT") ? [...FIX.tenant] : [...FIX.authInvalid],
    };
  }

  if (status === 504 || status === 502 || status === 503) {
    return {
      code: status === 504 ? "GATEWAY_504" : "GATEWAY_TIMEOUT",
      message: bodyMessage(body, `Gateway error (${status})`),
      fixSteps: [...FIX.gateway504],
    };
  }

  if (status != null && status >= 500) {
    return {
      code: "SERVER_ERROR",
      message: bodyMessage(body, `Server error (${status})`),
      fixSteps: [...FIX.gateway504],
    };
  }

  return {
    code: "UNKNOWN",
    message: bodyMessage(body, status != null ? `Request failed (${status})` : "Request failed"),
    fixSteps: [...FIX.authMissing],
  };
}

export function formatClassifiedErrorForTooltip(c: ClassifiedHttpError): string {
  const steps = c.fixSteps.map((s, i) => `${i + 1}. ${s}`).join("\n");
  return `${c.message}\n\n[${c.code}]\n${steps}`;
}
