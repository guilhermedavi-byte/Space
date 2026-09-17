const assert = require("node:assert/strict");
const test = require("node:test");

function installFakeIndexedDB() {
  const rows = new Map();
  global.__SPACE_FAKE_IDB_ROWS = rows;
  const asyncReq = (value) => {
    const req = {};
    process.nextTick(() => {
      req.result = value;
      req.onsuccess?.({ target: req });
    });
    return req;
  };
  global.indexedDB = {
    open() {
      const req = {};
      process.nextTick(() => {
        req.result = {
          objectStoreNames: { contains: () => true },
          createObjectStore() {},
          transaction() {
            return {
              objectStore() {
                return {
                  get: (key) => asyncReq(rows.get(key) || null),
                  put: (entry) => {
                    rows.set(entry.key, entry);
                    return asyncReq(true);
                  },
                  delete: (key) => {
                    rows.delete(key);
                    return asyncReq(true);
                  },
                  getAllKeys: () => asyncReq(Array.from(rows.keys())),
                };
              },
            };
          },
        };
        req.onsuccess?.({ target: req });
      });
      return req;
    },
  };
  return rows;
}

function freshCache(userId = "u1") {
  delete require.cache[require.resolve("../assets/space-data-cache")];
  global.__SPACE_SESSION__ = { sub: userId, role: "admin", commercialRoles: ["sdr"] };
  installFakeIndexedDB();
  return require("../assets/space-data-cache");
}

test("memory and indexedDB hits", async () => {
  const cache = freshCache();
  const key = cache.key({ resource: "crm-board", params: { workspace: "sdr" } });
  await cache.set(key, { ok: 1 });
  assert.equal((await cache.get(key)).cacheSource, "memory");
  cache._memory.clear();
  const disk = await cache.get(key);
  assert.equal(disk.cacheSource, "indexeddb");
  assert.deepEqual(disk.data, { ok: 1 });
});

test("network fallback and SWR refresh", async () => {
  const cache = freshCache();
  const key = cache.key({ resource: "commercial-goals", params: { competencia: "2026-09" } });
  let freshRendered = false;
  const result = await cache.loadWithCache({
    key,
    fetcher: async () => ({ value: 2 }),
    onFresh: () => { freshRendered = true; },
  });
  assert.equal(result.cacheSource, "network");
  assert.equal(freshRendered, true);
  assert.deepEqual((await cache.get(key)).data, { value: 2 });
});

test("stale-if-error keeps cached data", async () => {
  const cache = freshCache();
  const key = cache.key({ resource: "crm-activities", params: { opportunityId: "opp1" } });
  await cache.set(key, { rows: [1] }, { lastValidatedAt: Date.now() - 10000 });
  const result = await cache.loadWithCache({
    key,
    maxAge: 1,
    fetcher: async () => { throw new Error("offline"); },
  });
  assert.equal(result.staleIfError, true);
  assert.deepEqual(result.data, { rows: [1] });
});

test("user isolation and targeted invalidation", async () => {
  const cache = freshCache("user-a");
  const keyA = cache.key({ resource: "commercial-users" });
  await cache.set(keyA, ["a"]);
  global.__SPACE_SESSION__ = { sub: "user-b", role: "admin", commercialRoles: ["sdr"] };
  const keyB = cache.key({ resource: "commercial-users" });
  assert.notEqual(keyA, keyB);
  assert.equal(await cache.get(keyB), null);
  await cache.invalidate("commercial-users");
  global.__SPACE_SESSION__ = { sub: "user-a", role: "admin", commercialRoles: ["sdr"] };
  assert.equal(await cache.get(keyA), null);
});

test("schema version mismatch is ignored", async () => {
  const cache = freshCache();
  const key = cache.key({ resource: "crm-board" });
  global.__SPACE_FAKE_IDB_ROWS.set(key, {
    key,
    schemaVersion: "old-schema",
    data: { stale: true },
    cachedAt: Date.now(),
    lastValidatedAt: Date.now(),
  });
  assert.equal(await cache.get(key), null);
});
