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
 * Distribution Build ID: MSGF-853c3b6-20260519T054901Z-internal
 */
/** Optional client-side cache for the last Vault narrative log id returned by Pulse. */

export const DEFAULT_VAULT_SESSION_KEY = "msgf.vault_narrative_log_id";

export type VaultSessionStore = {
  getVaultNarrativeLogId(): string | null;
  setVaultNarrativeLogId(id: string | null): void;
  clear(): void;
};

export type VaultSessionStoreOptions = {
  storageKey?: string;
  /** Browser `localStorage` or any key-value store with the same shape. */
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem">;
};

export function createMemoryVaultSessionStore(
  storageKey = DEFAULT_VAULT_SESSION_KEY
): VaultSessionStore {
  const mem = new Map<string, string>();
  return {
    getVaultNarrativeLogId() {
      return mem.get(storageKey) ?? null;
    },
    setVaultNarrativeLogId(id) {
      if (id) mem.set(storageKey, id);
      else mem.delete(storageKey);
    },
    clear() {
      mem.delete(storageKey);
    },
  };
}

export function createLocalVaultSessionStore(
  options: VaultSessionStoreOptions = {}
): VaultSessionStore {
  const key = options.storageKey ?? DEFAULT_VAULT_SESSION_KEY;
  const storage = options.storage;

  if (!storage) {
    if (typeof globalThis === "undefined" || !("localStorage" in globalThis)) {
      return createMemoryVaultSessionStore(key);
    }
    return createLocalVaultSessionStore({
      storageKey: key,
      storage: (globalThis as typeof globalThis & { localStorage: Storage }).localStorage,
    });
  }

  return {
    getVaultNarrativeLogId() {
      try {
        return storage.getItem(key);
      } catch {
        return null;
      }
    },
    setVaultNarrativeLogId(id) {
      try {
        if (id) storage.setItem(key, id);
        else storage.removeItem(key);
      } catch {
        /* quota / private mode — ignore */
      }
    },
    clear() {
      try {
        storage.removeItem(key);
      } catch {
        /* ignore */
      }
    },
  };
}

export function resolveVaultSessionStore(
  sessionPersistence: boolean | VaultSessionStoreOptions | undefined
): VaultSessionStore | null {
  if (!sessionPersistence) return null;
  if (sessionPersistence === true) {
    return createLocalVaultSessionStore();
  }
  return createLocalVaultSessionStore(sessionPersistence);
}
