import * as vscode from "vscode";

import { PASTE_DELTA_THRESHOLD } from "./constants";
import type { PulseKeystrokeEvent } from "./ide-types";
import type { TelemetryChangeEvent } from "./telemetryTypes";

function workspaceContextForUri(uri: vscode.Uri): {
  workspacePath: string;
  workspaceName: string;
} {
  const folder = vscode.workspace.getWorkspaceFolder(uri);
  if (!folder) {
    return { workspacePath: uri.fsPath, workspaceName: "—" };
  }
  const relative = vscode.workspace.asRelativePath(uri, false);
  return {
    workspacePath: relative || uri.fsPath,
    workspaceName: folder.name,
  };
}

function buildTargetMeta(ev: TelemetryChangeEvent): string {
  return JSON.stringify({
    uri: ev.documentUri,
    path: ev.workspacePath,
    workspace: ev.workspaceName,
    paste: ev.isLikelyPaste,
    netDelta: ev.netDelta,
    inserted: ev.insertedLength,
    deleted: ev.deletedLength,
  });
}

/**
 * Parse a VS Code text change into a telemetry payload (URI, timestamp, length deltas).
 */
export function parseTextDocumentChange(
  document: vscode.TextDocument,
  change: vscode.TextDocumentContentChangeEvent,
  tsMs: number = performance.now()
): TelemetryChangeEvent {
  const insertedLength = change.text.length;
  const deletedLength = change.rangeLength;
  const netDelta = insertedLength - deletedLength;
  const { workspacePath, workspaceName } = workspaceContextForUri(document.uri);

  return {
    tsMs,
    documentUri: document.uri.toString(),
    workspacePath,
    workspaceName,
    insertedLength,
    deletedLength,
    netDelta,
    isLikelyPaste: insertedLength >= PASTE_DELTA_THRESHOLD,
    insertedText: change.text,
  };
}

export function parseTextDocumentEvent(
  event: vscode.TextDocumentChangeEvent
): TelemetryChangeEvent[] {
  const tsMs = performance.now();
  return event.contentChanges.map((change) =>
    parseTextDocumentChange(event.document, change, tsMs)
  );
}

/**
 * Convert batched telemetry → P1 keystroke envelope for `POST /api/msgf/pulse`.
 */
export function telemetryToKeystrokes(events: TelemetryChangeEvent[]): PulseKeystrokeEvent[] {
  const keystrokes: PulseKeystrokeEvent[] = [];

  for (const ev of events) {
    const target = buildTargetMeta(ev);

    if (ev.deletedLength > 0 && ev.insertedLength === 0) {
      keystrokes.push({
        ts: ev.tsMs,
        key: "Backspace",
        type: "keydown",
        target,
      });
      continue;
    }

    if (ev.isLikelyPaste) {
      keystrokes.push({
        ts: ev.tsMs,
        key: "Paste",
        type: "input",
        target,
      });
      continue;
    }

    const text = ev.insertedText ?? "";
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === "\r") continue;
      keystrokes.push({
        ts: ev.tsMs + i * 0.01,
        key: char === "\n" ? "Enter" : char,
        type: "input",
        target,
      });
    }
  }

  return keystrokes;
}
