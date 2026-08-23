const fs = require("fs");
const http = require("http");
const path = require("path");
const { execSync } = require("child_process");

const root = process.cwd();
const currentCrmRoute = require(path.join(root, "api", "crm-live.js"));
const currentCsRoute = require(path.join(root, "api", "cs-live.js"));
const { getCsLiveProvider } = require(path.join(root, "api", "_lib", "cs-live-provider.js"));
const { getCsLiveBuildId } = require(path.join(root, "api", "_lib", "cs-live-build.js"));

const baselineRoot = path.join(root, "tmp", "__baseline_render");
const baselineApiRoot = path.join(baselineRoot, "api");
const baselineLibRoot = path.join(baselineApiRoot, "_lib");
fs.mkdirSync(baselineLibRoot, { recursive: true });

const writeBaseline = (relativePath) => {
  const targetPath = path.join(baselineRoot, relativePath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, execSync(`git show HEAD:${relativePath}`, { cwd: root, encoding: "utf8" }));
};

writeBaseline("api/crm-live.js");
writeBaseline("api/_lib/crm-live-runtime.js");
writeBaseline("api/_lib/crm-live-rotation.js");

const proxyModule = (targetPath) => `module.exports = require(${JSON.stringify(targetPath)});\n`;
fs.writeFileSync(path.join(baselineLibRoot, "crm-live.js"), proxyModule(path.join(root, "api", "_lib", "crm-live.js")));
fs.writeFileSync(path.join(baselineLibRoot, "crm-live-deadline.js"), proxyModule(path.join(root, "api", "_lib", "crm-live-deadline.js")));
fs.writeFileSync(path.join(baselineLibRoot, "crm-live-build.js"), proxyModule(path.join(root, "api", "_lib", "crm-live-build.js")));
fs.writeFileSync(path.join(baselineLibRoot, "crm-live-toggle.js"), proxyModule(path.join(root, "api", "_lib", "crm-live-toggle.js")));
const baselineSharedLibRoot = path.join(baselineRoot, "_lib");
fs.mkdirSync(baselineSharedLibRoot, { recursive: true });
fs.writeFileSync(path.join(baselineSharedLibRoot, "session.js"), proxyModule(path.join(root, "_lib", "session.js")));

const baselineCrmRoute = require(path.join(baselineApiRoot, "crm-live.js"));

const crmPayload = {
  month: { summary: { meta: 180000, realizado: 128000, gap: 52000 } },
  news: [],
  pipeline: { rows: [] },
  weekly: {
    commercialWeek: { startDateKey: "2026-08-19", endDateKey: "2026-08-25", weekKey: "wk_2026-08-19" },
    team: {
      closers: { targetValue: 20000, actualValue: 12600, progressPct: 63 },
      sdrs: { targetValue: 40, actualValue: 23, progressPct: 57.5 },
    },
    closers: [
      { personId: "1", displayName: "Matheus Afonso", actualValue: 7600, targetValue: 10000, progressPct: 76, role: "closer" },
      { personId: "2", displayName: "Luis Eduardo", actualValue: 5000, targetValue: 10000, progressPct: 50, role: "closer" },
    ],
    sdrs: [
      { personId: "3", displayName: "Luana Mendonça", actualValue: 13, targetValue: 20, progressPct: 65, role: "sdr" },
      { personId: "4", displayName: "Nina Lima", actualValue: 10, targetValue: 20, progressPct: 50, role: "sdr" },
    ],
  },
  highlights: {
    dayKey: "2026-08-22",
    weekKey: "wk_2026-08-19",
    closer: { displayName: "Matheus Afonso", actualValue: 4200, dailyValue: 42, role: "closer" },
    sdr: { displayName: "Luana Mendonça", actualValue: 7, dailyValue: 35, role: "sdr" },
  },
  latestSale: null,
  unresolved: { missingResponsible: [], unknownResponsible: [], sdrActors: [] },
  cacheDebug: {},
  generatedAt: "2026-08-23T12:00:00.000Z",
  snapshotGeneratedAt: "2026-08-23T12:00:00.000Z",
  staleSource: "",
  stale: false,
  cached: false,
  staleAgeMinutes: 0,
  buildId: "render-build",
};

const json = (res, payload) => {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
};

const html = (res, body) => {
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(body);
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/crm-before") return html(res, baselineCrmRoute.buildHtml({ buildId: "before-build" }));
  if (url.pathname === "/crm-after") return html(res, currentCrmRoute.buildHtml({ buildId: "after-build" }));
  if (url.pathname === "/cs") return html(res, currentCsRoute.buildHtml({ buildId: getCsLiveBuildId() }));
  if (url.pathname === "/api/crm-live-data") return json(res, crmPayload);
  if (url.pathname === "/api/crm-live-events") return json(res, { ok: true, coldStart: false, generatedAt: new Date().toISOString(), queueDurationMs: 20000, events: [] });
  if (url.pathname === "/api/cs-live-data") {
    const provider = getCsLiveProvider();
    const snapshot = await provider.getSnapshot();
    return json(res, { ...snapshot, buildId: getCsLiveBuildId(), stale: false, staleAgeMinutes: 0 });
  }
  if (url.pathname === "/api/cs-live-events") return json(res, { ok: true, coldStart: false, generatedAt: new Date().toISOString(), queueDurationMs: 20000, events: [] });
  res.statusCode = 404;
  res.end("not found");
});

server.listen(4017, () => {
  process.stdout.write("http://127.0.0.1:4017\n");
});

const cleanup = () => {
  try { fs.rmSync(baselineRoot, { recursive: true, force: true }); } catch {}
};
process.on("exit", cleanup);
process.on("SIGINT", () => {
  cleanup();
  process.exit(0);
});
