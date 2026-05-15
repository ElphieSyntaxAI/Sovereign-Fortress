/** Optional partial editor fields merged into DiagnosticSnapshot.editor. */

export type EditorSnapshotPartial = Record<string, unknown>;

const providers: Array<() => EditorSnapshotPartial> = [];

export function registerEditorStateProvider(fn: () => EditorSnapshotPartial): () => void {
  providers.push(fn);
  return () => {
    const idx = providers.indexOf(fn);
    if (idx >= 0) providers.splice(idx, 1);
  };
}

export function mergeEditorStateSnapshot(): EditorSnapshotPartial {
  const merged: EditorSnapshotPartial = {};
  for (const fn of providers) {
    Object.assign(merged, fn());
  }
  return merged;
}
