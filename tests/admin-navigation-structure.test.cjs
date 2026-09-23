const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { Readable } = require("stream");
const { JSDOM } = require("jsdom");
const { createSessionForUser } = require("../_lib/session");

const root = path.resolve(__dirname, "..");
const template = fs.readFileSync(path.join(root, "api", "_templates", "app.html"), "utf8");
const script = fs.readFileSync(path.join(root, "script.js"), "utf8");

const count = (source, needle) => (source.match(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;

assert.strictEqual(count(template, 'data-panel-target="configuracoes-admin"'), 1, "main sidebar exposes exactly one Configurações entry");
assert.strictEqual(count(template, 'data-panel-target="guia-colaboradores"'), 0, "Guide is not exposed in the sidebar");
assert.strictEqual(count(template, 'data-panel="guia-colaboradores"'), 0, "Guide panel was removed from the app shell");
assert.strictEqual(count(template, 'data-panel-target="status-plataforma"'), 0, "Status is not a top-level sidebar entry");
assert.strictEqual(count(template, 'data-panel="status-plataforma"'), 0, "Status is rendered inside Configurações");
assert.strictEqual(count(template, 'data-panel-target="ao-vivo"'), 1, "Agenda is exposed only once in the app shell");
assert.strictEqual(count(template, "data-growth-crm-link"), 0, "CRM is not exposed through the legacy Growth top-level link");
assert.strictEqual(count(template, "data-growth-sdr-link"), 0, "SDR is not exposed through the legacy Growth top-level link");

const dom = new JSDOM(template);
const document = dom.window.document;
const topLevelLabels = Array.from(document.querySelectorAll(".sidebar-nav > .sidebar-link"))
  .map((item) => item.textContent.replace(/\s+/g, " ").trim())
  .filter(Boolean);
assert.ok(!topLevelLabels.includes("CRM"), "CRM is not a main sidebar item");
assert.ok(!topLevelLabels.includes("SDR"), "SDR is not a main sidebar item");
assert.ok(!topLevelLabels.includes("Growth"), "Growth is not a main sidebar item");

const commercialLabels = Array.from(document.querySelectorAll("[data-sidebar-accordion-body='comercial'] .sidebar-link-sub"))
  .map((item) => item.textContent.replace(/\s+/g, " ").trim())
  .filter(Boolean);
assert.ok(commercialLabels.includes("CRM"), "Comercial contains CRM");
assert.ok(commercialLabels.includes("Painel SDR") || commercialLabels.includes("↳ Painel SDR"), "Comercial contains Painel SDR");
assert.ok(commercialLabels.includes("Growth"), "Comercial contains Growth");

const expectedSettingsOrder = [
  "meu-perfil",
  "acessos",
  "tags",
  "planos",
  "motivos-cancelamento",
  "listas",
  "campos-adicionais",
  "integracoes",
  "conexoes",
  "status",
  "lixeira",
];
const sectionsMatch = script.match(/const ADMIN_SETTINGS_SECTIONS = \[([\s\S]*?)\];/);
assert.ok(sectionsMatch, "settings sections registry exists");
const actualSettingsOrder = Array.from(sectionsMatch[1].matchAll(/key:\s*"([^"]+)"/g)).map((match) => match[1]);
assert.deepStrictEqual(actualSettingsOrder, expectedSettingsOrder, "settings sections keep the expected order");

const invokeApp = async (pathParam) => {
  const appPath = require.resolve("../api/app");
  const firestoreAdminPath = require.resolve("../api/_lib/firestore-admin");
  const previousApp = require.cache[appPath];
  const previousFirestoreAdmin = require.cache[firestoreAdminPath];
  require.cache[firestoreAdminPath] = {
    id: firestoreAdminPath,
    filename: firestoreAdminPath,
    loaded: true,
    exports: {
      getDocumentAsAdmin: async () => ({ tipo: "admin", role: "admin", isSuperAdmin: true }),
    },
  };
  delete require.cache[appPath];
  const app = require("../api/app");
  const req = Readable.from([]);
  req.method = "GET";
  req.url = `/api/app?path=${encodeURIComponent(pathParam)}`;
  req.headers = {
    host: "localhost",
    cookie: `space_session=${createSessionForUser({ id: "admin", role: "admin", name: "Admin", email: "admin@example.com" }).token}`,
  };
  let body = "";
  const headers = {};
  const res = { statusCode: 200, setHeader(key, value) { headers[key.toLowerCase()] = value; }, end(value = "") { body += value; } };
  try {
    await app(req, res);
    return { statusCode: res.statusCode, headers, body };
  } finally {
    if (previousApp) require.cache[appPath] = previousApp;
    else delete require.cache[appPath];
    if (previousFirestoreAdmin) require.cache[firestoreAdminPath] = previousFirestoreAdmin;
    else delete require.cache[firestoreAdminPath];
  }
};

(async () => {
  const guide = await invokeApp("admin/guia");
  assert.strictEqual(guide.statusCode, 404, "removed Guide route returns not found for authenticated admins");

  const legacyStatus = await invokeApp("admin/status");
  assert.strictEqual(legacyStatus.statusCode, 200, "legacy Status route stays available");
  assert.match(legacyStatus.body, /data-initial-panel="configuracoes-admin"/, "legacy Status route opens Configurações");

  const commercialGrowth = await invokeApp("admin/comercial/growth");
  assert.strictEqual(commercialGrowth.statusCode, 200, "Comercial > Growth route is available");
  assert.match(commercialGrowth.body, /data-initial-panel="growth"/, "Comercial > Growth opens the Growth workspace");

  console.log("admin navigation structure tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
