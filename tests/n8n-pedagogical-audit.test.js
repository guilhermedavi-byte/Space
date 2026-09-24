const test = require("node:test");
const assert = require("node:assert/strict");

const handler = require("../api/integrations/n8n/pedagogical-audit");

test("pedagogical audit endpoint module loads", () => {
  assert.equal(typeof handler, "function");
});
