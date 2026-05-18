/**
 * HAL telemetry unit captured from `onDidChangeTextDocument` before micro-batching.
 */
export type TelemetryChangeEvent = {
  /** High-resolution timestamp (ms) at capture time. */
  tsMs: number;
  /** Absolute document URI for the active editor buffer. */
  documentUri: string;
  /** Workspace-relative path when available. */
  workspacePath: string;
  /** Owning workspace folder name. */
  workspaceName: string;
  /** Characters inserted in this change. */
  insertedLength: number;
  /** Characters removed (rangeLength). */
  deletedLength: number;
  /** Net character delta (inserted − deleted). */
  netDelta: number;
  /** True when insert looks like a large block paste vs rhythm typing. */
  isLikelyPaste: boolean;
  /** Raw inserted text for rhythm expansion (omitted on delete-only). */
  insertedText?: string;
};
