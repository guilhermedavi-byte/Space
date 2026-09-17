const assert = require("node:assert/strict");
const test = require("node:test");

const { createPerformanceTimer } = require("../api/_lib/performance-observer");

const fakeRes = () => {
  const headers = new Map();
  return {
    headersSent: false,
    setHeader(name, value) {
      headers.set(String(name).toLowerCase(), value);
    },
    getHeader(name) {
      return headers.get(String(name).toLowerCase());
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
