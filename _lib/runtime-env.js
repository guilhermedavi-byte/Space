const PROD_FIREBASE_PUBLIC_DEFAULTS = {
  apiKey: "AIzaSyD0qyhYh6MWRPMRDN_SYqdDEeogS3thQPE",
  authDomain: "plataforma-space.firebaseapp.com",
  projectId: "plataforma-space",
  storageBucket: "plataforma-space.firebasestorage.app",
  messagingSenderId: "984031970274",
  appId: "1:984031970274:web:fff5da2fe5e318b04aefbb",
  measurementId: "G-X28MKDJPKE",
};

const PROD_ASAAS_BASE_URL = "https://api.asaas.com/v3";
const SANDBOX_ASAAS_BASE_URL = "https://api-sandbox.asaas.com/v3";

const normalizeAppEnv = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "production" || raw === "prod") return "production";
  if (raw === "staging" || raw === "preview" || raw === "homolog") return "staging";
  return "local";
};

const getEnv = (env, ...names) => {
  for (const name of names) {
    const value = String(env?.[name] || "").trim();
    if (value) return value;
  }
  return "";
};

const stripTrailingSlash = (value) => String(value || "").trim().replace(/\/+$/, "");

const safeParseJson = (value) => {
  try {
    return JSON.parse(String(value || ""));
  } catch {
    return null;
  }
};

const getAppEnv = (env = process.env) =>
  normalizeAppEnv(getEnv(env, "APP_ENV", "SPACE_APP_ENV", "VERCEL_ENV", "NODE_ENV"));

const getFirebasePublicConfig = (env = process.env) => {
  const appEnv = getAppEnv(env);
  const config = {
    apiKey: getEnv(env, "NEXT_PUBLIC_FIREBASE_API_KEY", "FIREBASE_WEB_API_KEY"),
    authDomain: getEnv(env, "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", "FIREBASE_AUTH_DOMAIN"),
    projectId: getEnv(env, "NEXT_PUBLIC_FIREBASE_PROJECT_ID", "FIREBASE_PROJECT_ID"),
    storageBucket: getEnv(env, "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", "FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: getEnv(env, "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", "FIREBASE_MESSAGING_SENDER_ID"),
    appId: getEnv(env, "NEXT_PUBLIC_FIREBASE_APP_ID", "FIREBASE_APP_ID"),
    measurementId: getEnv(env, "NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID", "FIREBASE_MEASUREMENT_ID"),
  };

  if (appEnv !== "staging") {
    return {
      apiKey: config.apiKey || PROD_FIREBASE_PUBLIC_DEFAULTS.apiKey,
      authDomain: config.authDomain || PROD_FIREBASE_PUBLIC_DEFAULTS.authDomain,
      projectId: config.projectId || PROD_FIREBASE_PUBLIC_DEFAULTS.projectId,
      storageBucket: config.storageBucket || PROD_FIREBASE_PUBLIC_DEFAULTS.storageBucket,
      messagingSenderId: config.messagingSenderId || PROD_FIREBASE_PUBLIC_DEFAULTS.messagingSenderId,
      appId: config.appId || PROD_FIREBASE_PUBLIC_DEFAULTS.appId,
      measurementId: config.measurementId || PROD_FIREBASE_PUBLIC_DEFAULTS.measurementId,
    };
  }

  return config;
};

const getFirebaseProjectId = (env = process.env) => {
  const publicConfig = getFirebasePublicConfig(env);
  if (publicConfig.projectId) return publicConfig.projectId;
  const serviceAccountJson = safeParseJson(
    getEnv(env, "FIREBASE_SERVICE_ACCOUNT_JSON", "GOOGLE_SERVICE_ACCOUNT_JSON", "FIREBASE_SERVICE_ACCOUNT")
  );
  return String(serviceAccountJson?.project_id || "").trim();
};

const getFirebaseServerConfig = (env = process.env) => {
  const publicConfig = getFirebasePublicConfig(env);
  return {
    projectId: getFirebaseProjectId(env) || publicConfig.projectId,
    apiKey: publicConfig.apiKey,
  };
};

const getEnvironmentPresentation = (env = process.env) => {
  const appEnv = getAppEnv(env);
  if (appEnv === "staging") {
    return {
      appEnv,
      label: "staging",
      titlePrefix: "🧪 [TESTE] ",
      bannerLabel: "AMBIENTE DE TESTE",
      bannerDetail: "Use apenas dados sintéticos. Nenhuma automação real deve ser disparada aqui.",
      showBanner: true,
    };
  }
  if (appEnv === "local") {
    return {
      appEnv,
      label: "local",
      titlePrefix: "🛠️ [LOCAL] ",
      bannerLabel: "AMBIENTE LOCAL",
      bannerDetail: "Ambiente de desenvolvimento local. Não usar dados reais.",
      showBanner: true,
    };
  }
  return {
    appEnv,
    label: "production",
    titlePrefix: "",
    bannerLabel: "",
    bannerDetail: "",
    showBanner: false,
  };
};

const collectWebhookUrls = (env = process.env) =>
  Object.entries(env || {})
    .filter(([key, value]) => /N8N_.*(?:WEBHOOK_)?URL$/i.test(key) && String(value || "").trim())
    .map(([key, value]) => ({ key, value: stripTrailingSlash(value) }));

const validateEnvironmentIsolation = (env = process.env) => {
  const appEnv = getAppEnv(env);
  const firebase = getFirebasePublicConfig(env);
  const firebaseProjectId = getFirebaseProjectId(env);
  const supabaseUrl = stripTrailingSlash(getEnv(env, "SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"));
  const asaasBaseUrl = stripTrailingSlash(getEnv(env, "ASAAS_BASE_URL"));
  const n8nBaseUrl = stripTrailingSlash(getEnv(env, "N8N_BASE_URL"));

  const prodRefs = {
    firebaseProjectId: getEnv(env, "SPACE_PRODUCTION_FIREBASE_PROJECT_ID") || PROD_FIREBASE_PUBLIC_DEFAULTS.projectId,
    supabaseUrl: stripTrailingSlash(getEnv(env, "SPACE_PRODUCTION_SUPABASE_URL")),
    n8nBaseUrl: stripTrailingSlash(getEnv(env, "SPACE_PRODUCTION_N8N_BASE_URL")),
    asaasBaseUrl: stripTrailingSlash(getEnv(env, "SPACE_PRODUCTION_ASAAS_BASE_URL")) || PROD_ASAAS_BASE_URL,
  };
  const stagingRefs = {
    firebaseProjectId: getEnv(env, "SPACE_STAGING_FIREBASE_PROJECT_ID"),
    supabaseUrl: stripTrailingSlash(getEnv(env, "SPACE_STAGING_SUPABASE_URL")),
    n8nBaseUrl: stripTrailingSlash(getEnv(env, "SPACE_STAGING_N8N_BASE_URL")),
    asaasBaseUrl: stripTrailingSlash(getEnv(env, "SPACE_STAGING_ASAAS_BASE_URL")) || SANDBOX_ASAAS_BASE_URL,
  };

  const scopeHints = {
    firebase: getEnv(env, "FIREBASE_ENV_SCOPE"),
    supabase: getEnv(env, "SUPABASE_ENV_SCOPE"),
    asaas: getEnv(env, "ASAAS_KEY_SCOPE", "ASAAS_ENV"),
    n8n: getEnv(env, "N8N_ENV_SCOPE"),
  };

  const errors = [];

  if (appEnv === "staging") {
    if (!firebaseProjectId) errors.push("staging_missing_firebase_project_id");
    if (firebaseProjectId && firebaseProjectId === prodRefs.firebaseProjectId) errors.push("staging_uses_production_firebase");
    if (firebase.authDomain && firebase.authDomain === PROD_FIREBASE_PUBLIC_DEFAULTS.authDomain) errors.push("staging_uses_production_firebase_auth_domain");
    if (firebase.storageBucket && firebase.storageBucket === PROD_FIREBASE_PUBLIC_DEFAULTS.storageBucket) errors.push("staging_uses_production_firebase_storage");

    if (!supabaseUrl) errors.push("staging_missing_supabase_url");
    if (supabaseUrl && prodRefs.supabaseUrl && supabaseUrl === prodRefs.supabaseUrl) errors.push("staging_uses_production_supabase");

    if (!asaasBaseUrl) errors.push("staging_missing_asaas_base_url");
    if (asaasBaseUrl && (!/sandbox/i.test(asaasBaseUrl) || asaasBaseUrl === prodRefs.asaasBaseUrl)) errors.push("staging_uses_production_asaas");

    if (scopeHints.asaas && !/sandbox|staging/i.test(scopeHints.asaas)) errors.push("staging_uses_real_asaas_key_scope");

    if (n8nBaseUrl && prodRefs.n8nBaseUrl && n8nBaseUrl === prodRefs.n8nBaseUrl) errors.push("staging_uses_production_n8n");
    if (scopeHints.n8n && !/staging|disabled|mock/i.test(scopeHints.n8n)) errors.push("staging_uses_production_n8n_scope");

    const productionWebhook = collectWebhookUrls(env).find(
      ({ value }) => prodRefs.n8nBaseUrl && value.startsWith(prodRefs.n8nBaseUrl)
    );
    if (productionWebhook) errors.push(`staging_uses_production_webhook:${productionWebhook.key}`);
  }

  if (appEnv === "production") {
    if (stagingRefs.firebaseProjectId && firebaseProjectId === stagingRefs.firebaseProjectId) errors.push("production_uses_staging_firebase");
    if (stagingRefs.supabaseUrl && supabaseUrl === stagingRefs.supabaseUrl) errors.push("production_uses_staging_supabase");
    if (stagingRefs.n8nBaseUrl && n8nBaseUrl === stagingRefs.n8nBaseUrl) errors.push("production_uses_staging_n8n");
    if (stagingRefs.asaasBaseUrl && asaasBaseUrl === stagingRefs.asaasBaseUrl) errors.push("production_uses_sandbox_asaas");
    if (scopeHints.asaas && /sandbox|staging/i.test(scopeHints.asaas)) errors.push("production_uses_sandbox_asaas_scope");
    if (scopeHints.n8n && /staging|disabled|mock/i.test(scopeHints.n8n)) errors.push("production_uses_staging_n8n_scope");
  }

  return {
    ok: errors.length === 0,
    appEnv,
    errors,
    current: {
      firebaseProjectId,
      supabaseUrl,
      asaasBaseUrl,
      n8nBaseUrl,
      scopeHints,
    },
    references: {
      production: prodRefs,
      staging: stagingRefs,
    },
  };
};

const assertEnvironmentIsolation = (env = process.env) => {
  const validation = validateEnvironmentIsolation(env);
  if (!validation.ok) {
    const error = new Error(`environment_isolation_failed:${validation.errors.join(",")}`);
    error.code = "environment_isolation_failed";
    error.details = validation;
    throw error;
  }
  return validation;
};

const getPublicRuntimeConfig = (env = process.env) => {
  const presentation = getEnvironmentPresentation(env);
  const firebase = getFirebasePublicConfig(env);
  return {
    environment: presentation,
    firebase,
    leads: {
      firestoreProjectId: firebase.projectId || "",
      directFirestoreFallbackEnabled: presentation.appEnv !== "staging",
    },
  };
};

module.exports = {
  PROD_FIREBASE_PUBLIC_DEFAULTS,
  PROD_ASAAS_BASE_URL,
  SANDBOX_ASAAS_BASE_URL,
  normalizeAppEnv,
  getAppEnv,
  getFirebasePublicConfig,
  getFirebaseProjectId,
  getFirebaseServerConfig,
  getEnvironmentPresentation,
  getPublicRuntimeConfig,
  validateEnvironmentIsolation,
  assertEnvironmentIsolation,
};
