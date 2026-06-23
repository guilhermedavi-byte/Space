const test = require("node:test");
const assert = require("node:assert/strict");
const { validateWebhookSecret } = require("../api/_lib/security");

test("webhook exige segredo configurado", () => {
  const result = validateWebhookSecret({ headers: {}, url: "/" }, "");
  assert.equal(result.ok, false);
  assert.equal(result.status, 503);
});

test("webhook aceita segredo correto no cabeçalho", () => {
  const result = validateWebhookSecret(
    { headers: { "x-webhook-secret": "segredo-forte" }, url: "/" },
    "segredo-forte"
  );
  assert.equal(result.ok, true);
});

test("webhook rejeita segredo incorreto", () => {
  const result = validateWebhookSecret(
    { headers: { "x-webhook-secret": "errado" }, url: "/" },
    "segredo-forte"
  );
  assert.equal(result.ok, false);
  assert.equal(result.status, 401);
});
