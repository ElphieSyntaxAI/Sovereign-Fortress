import { useMemo, type ReactNode } from "react";

import { CoolDownLock, type CoolDownManuscriptState } from "./CoolDownLock";
import { ManuscriptRequiredBanner } from "./ManuscriptRequiredBanner";
import { useNarrative } from "../context/NarrativeContext";

export function CreativeManuscriptShell({
  children,
  useRevisionLock = false,
}: {
  children: ReactNode;
  /** Wrap content in vault cooldown overlay when manuscript is LOCKED. */
  useRevisionLock?: boolean;
}) {
  const { selection, setSelection } = useNarrative();

  const manuscript: CoolDownManuscriptState | null = useMemo(() => {
    if (!selection) return null;
    const vaultLocked =
      selection.cooldown_revision_status === "LOCKED" || selection.revision_status === "LOCKED";
    return {
      status: vaultLocked ? "LOCKED" : selection.revision_status,
      revision_status: selection.revision_status,
      cooldown_revision_status: selection.cooldown_revision_status,
      locked_until: selection.locked_until ?? null,
      lock_expires_at: selection.lock_expires_at ?? null,
      revision_cooldown_until: selection.revision_cooldown_until ?? null,
    };
  }, [selection]);

  if (!selection) {
    return <ManuscriptRequiredBanner />;
  }

  const inner = <div className="space-y-8">{children}</div>;

  if (!useRevisionLock) {
    return inner;
  }

  return (
    <CoolDownLock
      manuscript={manuscript}
      manuscriptId={selection.manuscriptId}
      onVaultSealed={(m) => {
        setSelection({
          ...selection,
          revision_status:
            typeof m.revision_status === "string" ? m.revision_status : selection.revision_status,
          cooldown_revision_status:
            typeof m.cooldown_revision_status === "string"
              ? m.cooldown_revision_status
              : selection.cooldown_revision_status,
          locked_until: m.locked_until != null ? String(m.locked_until) : null,
          revision_cooldown_until:
            m.revision_cooldown_until != null
              ? String(m.revision_cooldown_until)
              : selection.revision_cooldown_until,
          lock_expires_at:
            m.lock_expires_at != null ? String(m.lock_expires_at) : selection.lock_expires_at,
        });
      }}
    >
      {inner}
    </CoolDownLock>
  );
}
