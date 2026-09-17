const crypto = require("crypto");

const SLOW_REQUEST_MS = 1000;

const now = () => {
  if (typeof performance !== "undefined" && typeof performance.now === "function") return performance.now();
  return Date.now();
};

const cleanToken = (value) =>
  String(value || "")
    .trim()
    .replace(/[^A-Za-z0-9_-]/g, "_")
    .slice(0, 48);

const requestIdFrom = (req) => {
  const incoming = String(req?.headers?.["x-request-id"] || req?.headers?.["x-correlation-id"] || "").trim();
  return incoming && incoming.length <= 96 ? incoming : `perf_${crypto.randomUUID()}`;
};

const byteSize = (value) => {
  try {
    return Buffer.byteLength(typeof value === "string" ? value : JSON.stringify(value ?? {}), "utf8");
  } catch {
    return 0;
  }
};

const createPerformanceTimer = ({ req, route = "", operation = "" } = {}) => {
  const requestStart = now();
  const requestId = requestIdFrom(req);
  const segments = new Map();
  const starts = new Map();
  const metrics = {
    route,
    operation,
    requestId,
    firestoreRequests: 0,
    firestoreMs: 0,
  };

  const addMetric = (key, value) => {
    const safeKey = cleanToken(key);
    if (!safeKey) return;
    metrics[safeKey] = value;
  };

  const addDuration = (name, dur) => {
    const safeName = cleanToken(name);
    const ms = Math.max(0, Number(dur) || 0);
    if (!safeName) return ms;
    segments.set(safeName, (segments.get(safeName) || 0) + ms);
    metrics[`${safeName}Ms`] = Math.round((segments.get(safeName) || 0) * 10) / 10;
    if (safeName.toLowerCase().includes("firestore")) {
      metrics.firestoreMs = Math.round(((Number(metrics.firestoreMs) || 0) + ms) * 10) / 10;
    }
    return ms;
  };

  const timer = {
    requestId,
    metrics,
    start(name) {
      const safeName = cleanToken(name);
      if (safeName) starts.set(safeName, now());
    },
    end(name) {
      const safeName = cleanToken(name);
      if (!safeName || !starts.has(safeName)) return 0;
      const dur = now() - starts.get(safeName);
      starts.delete(safeName);
      return addDuration(safeName, dur);
    },
    async measure(name, fn, { firestore = false } = {}) {
      const safeName = cleanToken(name);
      const started = now();
      try {
        return await fn();
      } finally {
        const dur = addDuration(safeName, now() - started);
        if (firestore) {
          metrics.firestoreRequests = (Number(metrics.firestoreRequests) || 0) + 1;
          addMetric(`${safeName}FirestoreMs`, Math.round(dur * 10) / 10);
        }
      }
    },
    count(key, amount = 1) {
      const safeKey = cleanToken(key);
      if (!safeKey) return;
      metrics[safeKey] = (Number(metrics[safeKey]) || 0) + amount;
    },
    set: addMetric,
    finish(res, payload) {
      const totalMs = Math.round((now() - requestStart) * 10) / 10;
      const payloadBytes = byteSize(payload);
      metrics.totalMs = totalMs;
      metrics.payloadBytes = payloadBytes;
      metrics.slow_request = totalMs > SLOW_REQUEST_MS;
      if (res && !res.headersSent) {
        res.setHeader("X-Request-Id", requestId);
        const serverTiming = Array.from(segments.entries())
          .concat([["total", totalMs]])
          .map(([name, dur]) => `${cleanToken(name)};dur=${Math.round((Number(dur) || 0) * 10) / 10}`)
          .join(", ");
        if (serverTiming) res.setHeader("Server-Timing", serverTiming);
      }
      if (metrics.slow_request || process.env.SPACE_PERF_DEBUG === "1") {
        console.log(JSON.stringify({ type: "performance", ...metrics }));
      }
      return metrics;
    },
  };

  return timer;
};

module.exports = { byteSize, createPerformanceTimer };
