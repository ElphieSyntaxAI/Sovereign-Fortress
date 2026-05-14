import { useCallback, useEffect, useRef, useState } from "react";
import type { ClipboardEvent, MouseEvent } from "react";

import { bffAuthHeaders, bffCredentials } from "../lib/bffFetch";

export const EDITOR_SOVEREIGN_COPY_BLOCK_MESSAGE =
  "Sovereign Security: Copying is disabled for Editors to protect Author IP.";

export type UseEditorSecurityOptions = {
  manuscriptId: string;
  getAccessToken?: () => string | null | Promise<string | null>;
  /**
   * When set, skips `GET /api/auth/me` and uses this value for RBAC (e.g. parent already knows `user.role`).
   */
  roleOverride?: string | null;
  /** Single paste at or above this length (chars) flags Potential AI Injection (default 2500). */
  largePasteCharThreshold?: number;
  /** Pastes at or above this length count toward rapid-paste detection (default 120). */
  rapidPasteMinChars?: number;
  /** Number of qualifying pastes inside the window that triggers a rapid-paste flag (default 3). */
  rapidPasteCount?: number;
  /** Rolling window for rapid-paste detection in ms (default 4000). */
  rapidPasteWindowMs?: number;
  /** Minimum ms between ledger security-flag POSTs to avoid spam (default 12000). */
  flagCooldownMs?: number;
};

export type EditorSecurityHandlers = {
  onCopyCapture: (e: ClipboardEvent<HTMLElement>) => void;
  onCutCapture: (e: ClipboardEvent<HTMLElement>) => void;
  onContextMenuCapture: (e: MouseEvent<HTMLElement>) => void;
  onPasteCapture: (e: ClipboardEvent<HTMLElement>) => void;
};

function meUrl(): string {
  if (typeof window === "undefined" || !window.location?.origin) return "/api/auth/me";
  return `${window.location.origin}/api/auth/me`;
}

function securityFlagUrl(manuscriptId: string): string {
  const id = encodeURIComponent(manuscriptId.trim());
  const path = `/api/manuscripts/${id}/editor-ledger/security-flag`;
  if (typeof window === "undefined" || !window.location?.origin) return path;
  return `${window.location.origin}${path}`;
}

/**
 * Editor-only sovereign controls: clipboard hard-lock, paste anomaly logging to `p4_editor_ledger`
 * (`POTENTIAL_AI_INJECTION` via BFF). Role from `GET /api/auth/me` unless `roleOverride` is passed.
 */
export function useEditorSecurity(options: UseEditorSecurityOptions): {
  isEditor: boolean;
  roleLoaded: boolean;
  sovereignSecurityMessage: string | null;
  clearSovereignSecurityMessage: () => void;
  /** Spread onto the manuscript / editor surface (use **Capture** handlers). */
  editorSecurityHandlers: EditorSecurityHandlers;
} {
  const {
    manuscriptId,
    getAccessToken,
    roleOverride,
    largePasteCharThreshold = 2500,
    rapidPasteMinChars = 120,
    rapidPasteCount = 3,
    rapidPasteWindowMs = 4000,
    flagCooldownMs = 12_000,
  } = options;

  const [isEditor, setIsEditor] = useState(false);
  const [roleLoaded, setRoleLoaded] = useState(false);
  const [sovereignSecurityMessage, setSovereignSecurityMessage] = useState<string | null>(null);

  const pasteTimestampsRef = useRef<number[]>([]);
  const lastFlagPostRef = useRef(0);
  const postingRef = useRef(false);

  useEffect(() => {
    if (roleOverride !== undefined) {
      setIsEditor(String(roleOverride ?? "").trim().toUpperCase() === "EDITOR");
      setRoleLoaded(true);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const token = getAccessToken ? await getAccessToken() : null;
        const res = await fetch(meUrl(), {
          ...bffCredentials,
          headers: { ...bffAuthHeaders(token) },
        });
        const json = (await res.json().catch(() => ({}))) as {
          user?: { id?: string; role?: string };
        };
        if (cancelled) return;
        const r = json.user?.role;
        setIsEditor(typeof r === "string" && r.trim().toUpperCase() === "EDITOR");
      } catch {
        if (!cancelled) setIsEditor(false);
      } finally {
        if (!cancelled) setRoleLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getAccessToken, roleOverride]);

  const clearSovereignSecurityMessage = useCallback(() => {
    setSovereignSecurityMessage(null);
  }, []);

  const postPotentialAiInjection = useCallback(
    async (reason: string, detail: Record<string, unknown>) => {
      const mid = manuscriptId.trim();
      if (!mid) return;
      const now = Date.now();
      if (now - lastFlagPostRef.current < flagCooldownMs || postingRef.current) return;
      postingRef.current = true;
      try {
        const token = getAccessToken ? await getAccessToken() : null;
        const res = await fetch(securityFlagUrl(mid), {
          method: "POST",
          ...bffCredentials,
          headers: { "Content-Type": "application/json", ...bffAuthHeaders(token) },
          body: JSON.stringify({ reason, detail }),
        });
        if (res.ok) {
          lastFlagPostRef.current = Date.now();
        }
      } catch {
        // Non-blocking: security telemetry must not brick the editor shell.
      } finally {
        postingRef.current = false;
      }
    },
    [manuscriptId, getAccessToken, flagCooldownMs]
  );

  const blockClipboard = useCallback(
    (e: ClipboardEvent<HTMLElement>) => {
      if (!isEditor) return;
      e.preventDefault();
      e.stopPropagation();
      setSovereignSecurityMessage(EDITOR_SOVEREIGN_COPY_BLOCK_MESSAGE);
    },
    [isEditor]
  );

  const blockContextMenu = useCallback(
    (e: MouseEvent<HTMLElement>) => {
      if (!isEditor) return;
      e.preventDefault();
      e.stopPropagation();
      setSovereignSecurityMessage(EDITOR_SOVEREIGN_COPY_BLOCK_MESSAGE);
    },
    [isEditor]
  );

  const onPasteCapture = useCallback(
    (e: ClipboardEvent<HTMLElement>) => {
      if (!isEditor) return;
      const text = e.clipboardData?.getData("text/plain") ?? "";
      const len = text.length;
      const now = Date.now();

      if (len >= largePasteCharThreshold) {
        void postPotentialAiInjection("large_block_paste", {
          char_count: len,
          threshold: largePasteCharThreshold,
          recorded_at_client: new Date(now).toISOString(),
        });
        return;
      }

      if (len >= rapidPasteMinChars) {
        const windowStart = now - rapidPasteWindowMs;
        pasteTimestampsRef.current = pasteTimestampsRef.current.filter((t) => t >= windowStart);
        pasteTimestampsRef.current.push(now);
        if (pasteTimestampsRef.current.length >= rapidPasteCount) {
          void postPotentialAiInjection("rapid_paste_burst", {
            char_count: len,
            rapid_paste_count: pasteTimestampsRef.current.length,
            window_ms: rapidPasteWindowMs,
            min_chars: rapidPasteMinChars,
            recorded_at_client: new Date(now).toISOString(),
          });
          pasteTimestampsRef.current = [];
        }
      }
    },
    [
      isEditor,
      largePasteCharThreshold,
      rapidPasteMinChars,
      rapidPasteCount,
      rapidPasteWindowMs,
      postPotentialAiInjection,
    ]
  );

  const editorSecurityHandlers: EditorSecurityHandlers = {
    onCopyCapture: blockClipboard,
    onCutCapture: blockClipboard,
    onContextMenuCapture: blockContextMenu,
    onPasteCapture,
  };

  const noopHandlers: EditorSecurityHandlers = {
    onCopyCapture: () => {},
    onCutCapture: () => {},
    onContextMenuCapture: () => {},
    onPasteCapture: () => {},
  };

  return {
    isEditor,
    roleLoaded,
    sovereignSecurityMessage,
    clearSovereignSecurityMessage,
    editorSecurityHandlers: isEditor ? editorSecurityHandlers : noopHandlers,
  };
}
