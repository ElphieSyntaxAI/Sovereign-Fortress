/**
 * Durable sealed HAL offline store (extension service worker / panel).
 * Hash-chained batches + HMAC with lease signing_material (Web Crypto).
 * Loaded via importScripts in background.js; also usable from panel if needed.
 */
(function (global) {
  const GENESIS =
    "0000000000000000000000000000000000000000000000000000000000000000";
  const DB_NAME = "elphie-hal-offline";
  const DB_VERSION = 1;
  const STORE_EVENTS = "open_events";
  const STORE_BATCHES = "sealed_batches";
  const STORE_META = "meta";
  const SEAL_EVENT_THRESHOLD = 175;
  const SEAL_MS = 3 * 60 * 1000;

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_EVENTS)) {
          db.createObjectStore(STORE_EVENTS, { keyPath: "id", autoIncrement: true });
        }
        if (!db.objectStoreNames.contains(STORE_BATCHES)) {
          db.createObjectStore(STORE_BATCHES, { keyPath: "batch_id" });
        }
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META, { keyPath: "key" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function txDone(tx) {
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  async function idbGet(store, key) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const t = db.transaction(store, "readonly");
      const r = t.objectStore(store).get(key);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }

  async function idbPut(store, value) {
    const db = await openDb();
    const t = db.transaction(store, "readwrite");
    t.objectStore(store).put(value);
    await txDone(t);
  }

  async function idbGetAll(store) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const t = db.transaction(store, "readonly");
      const r = t.objectStore(store).getAll();
      r.onsuccess = () => resolve(r.result || []);
      r.onerror = () => reject(r.error);
    });
  }

  async function idbClear(store) {
    const db = await openDb();
    const t = db.transaction(store, "readwrite");
    t.objectStore(store).clear();
    await txDone(t);
  }

  async function idbDelete(store, key) {
    const db = await openDb();
    const t = db.transaction(store, "readwrite");
    t.objectStore(store).delete(key);
    await txDone(t);
  }

  function toHex(buf) {
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  async function sha256Hex(str) {
    const data = new TextEncoder().encode(str);
    const dig = await crypto.subtle.digest("SHA-256", data);
    return toHex(dig);
  }

  async function hmacHex(secretHex, message) {
    const keyRaw = new TextEncoder().encode(secretHex);
    const key = await crypto.subtle.importKey(
      "raw",
      keyRaw,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
    return toHex(sig);
  }

  async function computeBatchHash(input) {
    const eventsDigest = await sha256Hex(JSON.stringify(input.events));
    const payload = {
      batch_id: input.batch_id,
      prev_hash: input.prev_hash,
      started_at: input.started_at,
      ended_at: input.ended_at,
      event_count: input.event_count,
      events_digest: eventsDigest,
      lease_id: input.lease_id,
      manuscript_id: input.manuscript_id,
      content_fingerprint: input.content_fingerprint ?? null,
    };
    return sha256Hex(JSON.stringify(payload));
  }

  async function getMeta(key) {
    const row = await idbGet(STORE_META, key);
    return row ? row.value : null;
  }

  async function setMeta(key, value) {
    await idbPut(STORE_META, { key, value });
  }

  async function getLease() {
    return (await getMeta("lease")) || null;
  }

  async function setLease(lease) {
    await setMeta("lease", lease);
  }

  async function appendEvent(entry) {
    await idbPut(STORE_EVENTS, {
      ...entry,
      _ts: Date.now(),
    });
    const open = await idbGetAll(STORE_EVENTS);
    const lastSeal = Number((await getMeta("last_seal_at")) || 0);
    if (open.length >= SEAL_EVENT_THRESHOLD || Date.now() - lastSeal >= SEAL_MS) {
      await sealOpenBatch();
    }
  }

  async function sealOpenBatch() {
    const lease = await getLease();
    if (!lease?.lease_id || !lease?.signing_material || !lease?.manuscript_id) {
      return null;
    }
    const open = await idbGetAll(STORE_EVENTS);
    if (open.length === 0) return null;

    const events = open.map((e) => {
      const { id, _ts, ...rest } = e;
      return rest;
    });
    const started_at =
      typeof events[0]?.timestamp === "string"
        ? events[0].timestamp
        : new Date(open[0]._ts || Date.now()).toISOString();
    const ended_at =
      typeof events[events.length - 1]?.timestamp === "string"
        ? events[events.length - 1].timestamp
        : new Date().toISOString();

    const sealed = await idbGetAll(STORE_BATCHES);
    const ordered = sealed.sort((a, b) =>
      String(a.started_at).localeCompare(String(b.started_at))
    );
    const lastHash =
      ordered.length > 0
        ? ordered[ordered.length - 1].batch_hash
        : lease.genesis_prev_hash || GENESIS;

    const batch_id =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `b-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const batch_hash = await computeBatchHash({
      batch_id,
      prev_hash: lastHash,
      started_at,
      ended_at,
      event_count: events.length,
      events,
      lease_id: lease.lease_id,
      manuscript_id: lease.manuscript_id,
      content_fingerprint: null,
    });
    const hmac = await hmacHex(lease.signing_material, batch_hash);

    const batch = {
      batch_id,
      prev_hash: lastHash,
      batch_hash,
      hmac,
      started_at,
      ended_at,
      event_count: events.length,
      events,
      content_fingerprint: null,
      word_count_estimate: Math.max(1, Math.round(events.length / 5)),
      synced: false,
      lease_id: lease.lease_id,
    };

    await idbPut(STORE_BATCHES, batch);
    await idbClear(STORE_EVENTS);
    await setMeta("last_seal_at", Date.now());
    return batch;
  }

  async function listPendingBatches() {
    const all = await idbGetAll(STORE_BATCHES);
    return all
      .filter((b) => !b.synced)
      .sort((a, b) => String(a.started_at).localeCompare(String(b.started_at)));
  }

  async function pendingCount() {
    return (await listPendingBatches()).length;
  }

  async function markBatchesSynced(batchIds) {
    const set = new Set(batchIds || []);
    const all = await idbGetAll(STORE_BATCHES);
    for (const b of all) {
      if (set.has(b.batch_id)) {
        await idbPut(STORE_BATCHES, { ...b, synced: true });
      }
    }
  }

  async function forceSeal() {
    return sealOpenBatch();
  }

  global.HalOfflineStore = {
    GENESIS,
    appendEvent,
    sealOpenBatch,
    forceSeal,
    listPendingBatches,
    pendingCount,
    markBatchesSynced,
    getLease,
    setLease,
  };
})(typeof self !== "undefined" ? self : globalThis);
