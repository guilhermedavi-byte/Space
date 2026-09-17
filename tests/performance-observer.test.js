const assert = require("node:assert/strict");
const test = require("node:test");

const { createPerformanceTimer, sendJsonWithPerformance } = require("../api/_lib/performance-observer");

const fakeRes = () => {
  const headers = new Map();
  return {
    headersSent: false,
    statusCode: 200,
    body: "",
    setHeader(name, value) {
      headers.set(String(name).toLowerCase(), value);
    },
    getHeader(name) {
      return headers.get(String(name).toLowerCase());
    },
    end(value = "") {
      this.body = value;
      this.headersSent = true;
    },
  };
};

test("performance timer writes Server-Timing and request id", async () => {
  const timer = createPerformanceTimer({
    req: { headers: { "x-request-id": "req_test_1" } },
    route: "/api/example",
    operation: "example",
  });
  await timer.measure("firestore", async () => "ok", { firestore: true });
  const res = fakeRes();
  const metrics = timer.finish(res, { ok: true });

  assert.equal(res.getHeader("x-request-id"), "req_test_1");
  assert.match(String(res.getHeader("server-timing")), /firestore;dur=/);
  assert.match(String(res.getHeader("server-timing")), /total;dur=/);
  assert.equal(metrics.firestoreRequests, 1);
  assert.ok(metrics.payloadBytes > 0);
});

test("performance logs contain metrics but not response payload content", () => {
  const previous = process.env.SPACE_PERF_DEBUG;
  process.env.SPACE_PERF_DEBUG = "1";
  const lines = [];
  const originalLog = console.log;
  console.log = (line) => lines.push(String(line));
  try {
    const timer = createPerformanceTimer({ req: { headers: {} }, route: "/api/example", operation: "example" });
    timer.finish(fakeRes(), { email: "person@example.com", token: "secret" });
  } finally {
    console.log = originalLog;
    if (previous === undefined) delete process.env.SPACE_PERF_DEBUG;
    else process.env.SPACE_PERF_DEBUG = previous;
  }

  assert.equal(lines.length, 1);
  assert.match(lines[0], /"type":"performance"/);
  assert.doesNotMatch(lines[0], /person@example\.com|secret/);
});

test("sendJsonWithPerformance returns private ETag and 304 on matching GET", () => {
  const payload = { ok: true, rows: [1, 2, 3] };
  const firstReq = { method: "GET", headers: {} };
  const firstRes = fakeRes();
  sendJsonWithPerformance(firstReq, firstRes, 200, payload, createPerformanceTimer({ req: firstReq }), { etag: true });

  const tag = firstRes.getHeader("etag");
  assert.match(String(tag), /^"/);
  assert.equal(firstRes.getHeader("cache-control"), "private, no-store");
  assert.equal(firstRes.statusCode, 200);
  assert.deepEqual(JSON.parse(firstRes.body), payload);

  const secondReq = { method: "GET", headers: { "if-none-match": tag } };
  const secondRes = fakeRes();
  sendJsonWithPerformance(secondReq, secondRes, 200, payload, createPerformanceTimer({ req: secondReq }), { etag: true });

  assert.equal(secondRes.statusCode, 304);
  assert.equal(secondRes.body, "");
  assert.equal(secondRes.getHeader("etag"), tag);
});
