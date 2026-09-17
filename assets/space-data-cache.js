(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(root);
  else root.SpaceDataCache = factory(root);
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  const DB_NAME = "space-data-cache";
  const STORE = "entries";
  const SCHEMA_VERSION = "fast-data-v1";
  const DB_VERSION = 1;
  const memory = new Map();
  let dbPromise = null;

  const now = () => Date.now();
  const stable = (value) => {
    if (Array.isArray(value)) return value.map(stable);
    if (!value || typeof value !== "object") return value;
    return Object.keys(value).sort().reduce((out, key) => {
      out[key] = stable(value[key]);
      return out;
    }, {});
  };
  const session = () => (root && root.__SPACE_SESSION__) || {};
  const context = (extra = {}) => {
    const user = session();
    return {
      schema: SCHEMA_VERSION,
      userId: String(user.sub || user.id || "anonymous"),
      role: String(user.role || ""),
      commercialRoles: Array.isArray(user.commercialRoles) ? user.commercialRoles.slice().sort().join(",") : "",
      scope: String(extra.scope || "space-main"),
      resource: String(extra.resource || ""),
      params: stable(extra.params || {}),
    };
  };
  const makeKey = (parts) => {
    if (typeof parts === "string") return `${SCHEMA_VERSION}:${parts}`;
    return `${SCHEMA_VERSION}:${JSON.stringify(context(parts || {}))}`;
  };
  const db = () => {
    if (!root || !root.indexedDB) return Promise.resolve(null);
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve) => {
      const req = root.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const database = req.result;
        if (!database.objectStoreNames.contains(STORE)) database.createObjectStore(STORE, { keyPath: "key" });
      };
      req.onerror = () => resolve(null);
      req.onsuccess = () => resolve(req.result);
    });
    return dbPromise;
  };
  const withStore = async (mode, fn) => {
    const database = await db();
    if (!database) return null;
    return new Promise((resolve) => {
      try {
        const tx = database.transaction(STORE, mode);
        const store = tx.objectStore(STORE);
        const done = (value) => resolve(value);
        const result = fn(store, done);
        if (result !== undefined) resolve(result);
        tx.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  };
  const getDisk = (key) => withStore("readonly", (store, done) => {
    const req = store.get(key);
    req.onerror = () => done(null);
    req.onsuccess = () => done(req.result || null);
  });
  const putDisk = (entry) => withStore("readwrite", (store, done) => {
    const req = store.put(entry);
    req.onerror = () => done(false);
    req.onsuccess = () => done(true);
  });
  const deleteDisk = (key) => withStore("readwrite", (store, done) => {
    const req = store.delete(key);
    req.onerror = () => done(false);
    req.onsuccess = () => done(true);
  });
  const allKeys = () => withStore("readonly", (store, done) => {
    const req = store.getAllKeys();
    req.onerror = () => done([]);
    req.onsuccess = () => done(Array.isArray(req.result) ? req.result : []);
  });

  const api = {
    version: SCHEMA_VERSION,
    key: makeKey,
    ttl: {
      crmBoard: 60_000,
      crmList: 60_000,
      crmOpportunity: 60_000,
      crmTimeline: 60_000,
      crmActivities: 30_000,
      commercialOverview: 60_000,
      commercialGoals: 60_000,
      commercialUsers: 60_000,
    },
    async get(key) {
      const safeKey = makeKey(key);
      const cached = memory.get(safeKey);
      if (cached) return { ...cached, cacheSource: "memory", cacheAgeMs: now() - cached.cachedAt };
      const disk = await getDisk(safeKey);
      if (!disk || disk.schemaVersion !== SCHEMA_VERSION) return null;
      memory.set(safeKey, disk);
      return { ...disk, cacheSource: "indexeddb", cacheAgeMs: now() - disk.cachedAt };
    },
    async set(key, data, metadata = {}) {
      const safeKey = makeKey(key);
      const entry = {
        key: safeKey,
        schemaVersion: SCHEMA_VERSION,
        data,
        metadata: metadata && typeof metadata === "object" ? metadata : {},
        cachedAt: Number(metadata.cachedAt) || now(),
        lastValidatedAt: Number(metadata.lastValidatedAt) || now(),
      };
      memory.set(safeKey, entry);
      await putDisk(entry);
      return entry;
    },
    async delete(key) {
      const safeKey = makeKey(key);
      memory.delete(safeKey);
      await deleteDisk(safeKey);
    },
    async invalidate(prefix) {
      const raw = String(prefix || "");
      for (const key of Array.from(memory.keys())) if (key.includes(raw)) memory.delete(key);
      const keys = await allKeys();
      await Promise.all(keys.filter((key) => String(key).includes(raw)).map(deleteDisk));
    },
    async clearUserScope() {
      const userId = String(session().sub || session().id || "");
      if (!userId) return;
      await api.invalidate(`"userId":"${userId}"`);
    },
    async loadWithCache({ key, fetcher, maxAge = 60_000, renderCached, onFresh, onError } = {}) {
      const cached = await api.get(key);
      if (cached && typeof renderCached === "function") renderCached(cached.data, cached);
      const shouldFetch = !cached || now() - Number(cached.lastValidatedAt || cached.cachedAt || 0) > maxAge;
      if (!shouldFetch) return { data: cached.data, cacheHit: true, cacheSource: cached.cacheSource, cacheAgeMs: cached.cacheAgeMs };
      try {
        const fresh = await fetcher();
        await api.set(key, fresh, { lastValidatedAt: now() });
        if (typeof onFresh === "function") onFresh(fresh, { cacheHit: false, cacheSource: "network", cacheAgeMs: 0 });
        return { data: fresh, cacheHit: Boolean(cached), cacheSource: cached ? cached.cacheSource : "network", refreshed: true };
      } catch (error) {
        if (cached) {
          if (typeof onError === "function") onError(error, cached);
          return { data: cached.data, cacheHit: true, cacheSource: cached.cacheSource, staleIfError: true, error };
        }
        throw error;
      }
    },
    _memory: memory,
  };

  return api;
});
