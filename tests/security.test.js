const test = require("node:test");
const assert = require("node:assert/strict");
const { validateWebhookSecret } = require("../api/_lib/security");
const { supabaseFetch } = require("../api/_lib/supabase-rest");

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

test("Supabase server-side exige service role explícito", async () => {
  const original = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  };
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.APP_ENV = "production";
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_SERVICE_KEY;
  process.env.SUPABASE_ANON_KEY = "anon-only";
  await assert.rejects(() => supabaseFetch("/rpc/test", { method: "POST", body: {} }), /supabase_not_configured/);
  Object.assign(process.env, original);
});
