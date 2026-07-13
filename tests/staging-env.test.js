const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const {
  getPublicRuntimeConfig,
  validateEnvironmentIsolation,
} = require("../_lib/runtime-env");
const { buildResetPlan, validateResetEnvironment } = require("../scripts/staging-reset");

const makeBaseEnv = () => ({
  APP_ENV: "staging",
  NEXT_PUBLIC_FIREBASE_API_KEY: "firebase-key-staging",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "space-staging.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "space-staging",
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "space-staging.firebasestorage.app",
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "1234567890",
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:1234567890:web:abcdef",
  NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: "G-STAGING",
  SUPABASE_URL: "https://space-staging.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-staging",
  ASAAS_BASE_URL: "https://api-sandbox.asaas.com/v3",
  ASAAS_KEY_SCOPE: "sandbox",
  N8N_BASE_URL: "https://n8n-staging.example.com",
  N8N_ENV_SCOPE: "staging",
  N8N_PEDAGOGICO_ONBOARDING_WEBHOOK_URL: "https://n8n-staging.example.com/webhook/onboarding",
  SPACE_PRODUCTION_FIREBASE_PROJECT_ID: "plataforma-space",
  SPACE_PRODUCTION_SUPABASE_URL: "https://space-prod.supabase.co",
  SPACE_PRODUCTION_N8N_BASE_URL: "https://n8n-prod.example.com",
  SPACE_PRODUCTION_ASAAS_BASE_URL: "https://api.asaas.com/v3",
  SPACE_STAGING_FIREBASE_PROJECT_ID: "space-staging",
  SPACE_STAGING_SUPABASE_URL: "https://space-staging.supabase.co",
  SPACE_STAGING_N8N_BASE_URL: "https://n8n-staging.example.com",
  SPACE_STAGING_ASAAS_BASE_URL: "https://api-sandbox.asaas.com/v3",
  FIREBASE_ENV_SCOPE: "staging",
  SUPABASE_ENV_SCOPE: "staging",
  STAGING_ADMIN_EMAIL_ALLOWLIST: "admin.staging@example.com",
});

test("staging falha se apontar para Firebase de produção", () => {
  const result = validateEnvironmentIsolation({
    ...makeBaseEnv(),
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: "plataforma-space",
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "plataforma-space.firebaseapp.com",
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes("staging_uses_production_firebase"));
});

test("staging falha se apontar para Supabase de produção", () => {
  const result = validateEnvironmentIsolation({
    ...makeBaseEnv(),
    SUPABASE_URL: "https://space-prod.supabase.co",
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes("staging_uses_production_supabase"));
});

test("staging falha se usar Asaas real", () => {
  const result = validateEnvironmentIsolation({
    ...makeBaseEnv(),
    ASAAS_BASE_URL: "https://api.asaas.com/v3",
    ASAAS_KEY_SCOPE: "production",
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes("staging_uses_production_asaas"));
  assert.ok(result.errors.includes("staging_uses_real_asaas_key_scope"));
});

test("staging falha se webhook de produção estiver configurado", () => {
  const result = validateEnvironmentIsolation({
    ...makeBaseEnv(),
    N8N_PEDAGOGICO_ONBOARDING_WEBHOOK_URL: "https://n8n-prod.example.com/webhook/onboarding",
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((entry) => entry.startsWith("staging_uses_production_webhook:")));
});

test("runtime público de staging expõe banner de teste", () => {
  const runtime = getPublicRuntimeConfig(makeBaseEnv());
  assert.equal(runtime.environment.appEnv, "staging");
  assert.equal(runtime.environment.showBanner, true);
  assert.equal(runtime.environment.bannerLabel, "AMBIENTE DE TESTE");
});

test("páginas carregam runtime-config para exibir banner de staging", () => {
  const files = [
    path.join(__dirname, "..", "index.html"),
    path.join(__dirname, "..", "entrar", "index.html"),
    path.join(__dirname, "..", "api", "_templates", "app.html"),
    path.join(__dirname, "..", "api", "app.js"),
    path.join(__dirname, "..", "api", "growth-dashboard.js"),
  ];
  files.forEach((file) => {
    const content = fs.readFileSync(file, "utf8");
    assert.match(content, /\/api\/runtime-config\.js/);
  });
});

test("reset recusa execução fora do staging", () => {
  assert.throws(
    () =>
      validateResetEnvironment({
        ...makeBaseEnv(),
        APP_ENV: "production",
        STAGING_RESET_WRITE_ENABLED: "true",
      }),
    /reset_requires_staging/
  );
});

test("reset dry-run preserva plano seguro", () => {
  const plan = buildResetPlan(makeBaseEnv());
  assert.equal(plan.dryRunOnlyByDefault, true);
  assert.equal(plan.deleteOnlySyntheticData, true);
  assert.ok(plan.preserveCollections.includes("accounts"));
});
