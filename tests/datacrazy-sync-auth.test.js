const test = require("node:test");
const assert = require("node:assert/strict");

process.env.DATACRAZY_SYNC_SECRET = "segredo-sync";

const handler = require("../api/datacrazy-sync");

const createRes = () => ({
  statusCode: 200,
  headers: {},
  body: null,
  setHeader(name, value) {
    this.headers[name] = value;
  },
  end(value) {
    this.body = value;
  },
});

test("endpoint de sync rejeita sem sessão nem segredo", async () => {
  const req = { method: "GET", url: "/api/datacrazy-sync?action=validate", headers: { host: "localhost" } };
  const res = createRes();
  await handler(req, res);
  assert.equal(res.statusCode, 401);
});
