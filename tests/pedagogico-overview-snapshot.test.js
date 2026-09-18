const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

const servicePath = require.resolve("../api/_lib/pedagogico-service");
const googlePath = require.resolve("../_lib/google-service-account");
const supabasePath = require.resolve("../api/_lib/supabase-rest");
const firestoreRestPath = require.resolve("../api/_lib/firestore-rest");

const installService = ({ initialSnapshot = null, now = "2026-09-17T12:00:00.000Z" } = {}) => {
  const cached = {
    service: require.cache[servicePath],
    google: require.cache[googlePath],
    supabase: require.cache[supabasePath],
    firestore: require.cache[firestoreRestPath],
  };
  let snapshot = initialSnapshot;
  const calls = { supabase: [], firestore: [] };
  const rows = {
    onboarding: [
      {
        id: "onb-1",
        aluno_id: "student-1",
        aluno_nome: "Aluno Um",
        email: "aluno@example.com",
        professor_id: "teacher-1",
        created_at: "2026-09-01T10:00:00.000Z",
        primeira_aula_em: "2026-09-02T10:00:00.000Z",
        status_onboarding: "concluido",
        aulas_realizadas: 4,
      },
    ],
    lessons: [
      {
        id: "lesson-1",
        aluno_id: "student-1",
        aluno_nome: "Aluno Um",
        professor_id: "teacher-1",
        professor_nome: "Prof Um",
        inicio: "2026-09-17T10:00:00.000Z",
        fim: "2026-09-17T11:00:00.000Z",
        status_aula: "realizada",
      },
    ],
    registers: [{ id: "reg-1", aula_id: "lesson-1", status: "realizada", created_at: "2026-09-17T11:05:00.000Z" }],
    alerts: [{ id: "alert-1", status: "open", created_at: "2026-09-17T09:00:00.000Z" }],
    satisfaction: [{ id: "sat-1", tipo: "csat", nota: 5, created_at: "2026-09-17T09:00:00.000Z" }],
    flexge: [{ id: "flex-1", aluno_id: "student-1", flexge_last_sync_at: "2026-09-17T09:00:00.000Z" }],
    teachers: [{ id: "teacher-1", nome: "Prof Um", updated_at: "2026-09-17T09:00:00.000Z" }],
    reports: [{ id: "report-1", created_at: "2026-09-17T09:00:00.000Z" }],
    finance: [{ id: "fin-1", aluno_id: "student-1", email: "aluno@example.com", updated_at: "2026-09-17T09:00:00.000Z" }],
    preferences: [],
  };
  const supabaseFetch = async (path) => {
    calls.supabase.push(path);
    if (path.includes("n8n_onboarding_alunos_space")) return { data: rows.onboarding };
    if (path.includes("n8n_aulas_pedagogicas_space")) return { data: rows.lessons };
    if (path.includes("n8n_registros_aula_space")) return { data: rows.registers };
    if (path.includes("n8n_ocorrencias_pedagogicas_space")) return { data: rows.alerts };
    if (path.includes("n8n_satisfacao_alunos_space")) return { data: rows.satisfaction };
    if (path.includes("n8n_flexge_evolucao_alunos_space")) return { data: rows.flexge };
    if (path.includes("n8n_professores_space")) return { data: rows.teachers };
    if (path.includes("n8n_relatorios_pedagogicos_space")) return { data: rows.reports };
    if (path.includes("n8n_alunos_financeiro_space")) return { data: rows.finance };
    if (path.includes("n8n_preferencias_alunos_pedagogico_space")) return { data: rows.preferences };
    return { data: [] };
  };

  require.cache[googlePath] = { exports: { getGoogleAccessToken: async () => ({ accessToken: "admin-token" }) } };
  require.cache[supabasePath] = { exports: { supabaseFetch } };
  require.cache[firestoreRestPath] = {
    exports: {
      FIRESTORE_BASE: "https://firestore.test/documents",
      decodeFields: (doc) => doc?.fields || {},
      encodeFields: (data) => ({ fields: data }),
      encodeValue: (value) => value,
      firestoreRunQuery: async () => ({ ok: true, status: 200, data: [] }),
      getDocIdFromName: (name) => String(name || "").split("/").filter(Boolean).pop() || "",
      requestJson: async (url, { method = "GET", body } = {}) => {
        calls.firestore.push({ method, url, body });
        if (method === "GET") {
          return snapshot ? { ok: true, status: 200, data: { fields: snapshot } } : { ok: false, status: 404 };
        }
        if (method === "PATCH") {
          snapshot = body?.fields || body;
          return { ok: true, status: 200, data: { fields: snapshot } };
        }
        return { ok: true, status: 200, data: null };
      },
    },
  };
  delete require.cache[servicePath];
  globalThis.__pedagogicalOverviewSnapshotRebuildPromise = null;
  const originalNow = Date.now;
  Date.now = () => Date.parse(now);
  return {
    service: require("../api/_lib/pedagogico-service"),
    calls,
    get snapshot() {
      return snapshot;
    },
    restore() {
      Date.now = originalNow;
      if (cached.service) require.cache[servicePath] = cached.service;
      else delete require.cache[servicePath];
      if (cached.google) require.cache[googlePath] = cached.google;
      else delete require.cache[googlePath];
      if (cached.supabase) require.cache[supabasePath] = cached.supabase;
      else delete require.cache[supabasePath];
      if (cached.firestore) require.cache[firestoreRestPath] = cached.firestore;
      else delete require.cache[firestoreRestPath];
      globalThis.__pedagogicalOverviewSnapshotRebuildPromise = null;
    },
  };
};

test("overview snapshot miss calcula uma vez, persiste e preserva números do build antigo", async () => {
  const ctx = installService();
  try {
    const legacy = await ctx.service.loadAdminDashboard({ session: { sub: "admin-1", email: "admin@example.com" } });
    const result = await ctx.service.loadAdminOverviewSnapshot({ session: { sub: "admin-1", email: "admin@example.com" } });
    assert.equal(result.snapshot.cached, false);
    assert.equal(result.metrics.aulas_hoje, legacy.metrics.aulas_hoje);
    assert.equal(result.metrics.ocorrencias_abertas, legacy.metrics.ocorrencias_abertas);
    assert.equal(ctx.snapshot.meta.schemaVersion, ctx.service._test.PEDAGOGICAL_OVERVIEW_SNAPSHOT_SCHEMA_VERSION);
    assert.ok(ctx.calls.firestore.some((call) => call.method === "PATCH"));
  } finally {
    ctx.restore();
  }
});

test("overview snapshot hit serve sem recomputar fontes pesadas", async () => {
  const initialSnapshot = {
    payload: { metrics: { aulas_hoje: 7 }, students: [], teachers: [], onboarding: [] },
    meta: { generatedAt: "2026-09-17T11:59:00.000Z", period: "rolling", schemaVersion: 1 },
  };
  const ctx = installService({ initialSnapshot });
  try {
    const result = await ctx.service.loadAdminOverviewSnapshot({ session: { sub: "admin-1" } });
    assert.equal(result.snapshot.cached, true);
    assert.equal(result.snapshot.stale, false);
    assert.equal(result.metrics.aulas_hoje, 7);
    assert.equal(ctx.calls.supabase.length, 0);
  } finally {
    ctx.restore();
  }
});

test("overview snapshot stale serve imediatamente e agenda rebuild controlado", async () => {
  const initialSnapshot = {
    payload: { metrics: { aulas_hoje: 3 }, students: [], teachers: [], onboarding: [] },
    meta: { generatedAt: "2026-09-17T11:50:00.000Z", period: "rolling", schemaVersion: 1 },
  };
  const ctx = installService({ initialSnapshot });
  try {
    const result = await ctx.service.loadAdminOverviewSnapshot({ session: { sub: "admin-1" } });
    assert.equal(result.snapshot.cached, true);
    assert.equal(result.snapshot.stale, true);
    assert.equal(result.snapshot.rebuilding, true);
    assert.equal(result.metrics.aulas_hoje, 3);
    await globalThis.__pedagogicalOverviewSnapshotRebuildPromise;
    assert.ok(ctx.calls.supabase.length > 0);
    assert.equal(ctx.snapshot.payload.metrics.aulas_hoje, 1);
  } finally {
    ctx.restore();
  }
});

test("overview snapshot protege contra rebuild duplicado no mesmo runtime", async () => {
  const ctx = installService();
  try {
    const [first, second] = await Promise.all([
      ctx.service.loadAdminOverviewSnapshot({ session: { sub: "admin-1" } }),
      ctx.service.loadAdminOverviewSnapshot({ session: { sub: "admin-1" } }),
    ]);
    assert.equal(first.snapshot.cached, false);
    assert.equal(second.snapshot.cached, false);
    assert.equal(ctx.calls.supabase.filter((path) => path.includes("n8n_aulas_pedagogicas_space")).length, 1);
  } finally {
    ctx.restore();
  }
});

test("frontend da visão geral usa snapshot e não dispara carga completa das outras abas", () => {
  const script = fs.readFileSync(path.join(__dirname, "..", "script.js"), "utf8");
  assert.match(script, /fetchWithAuth\("\/api\/pedagogico\/dashboard\?view=overview"/);
  assert.match(script, /const overviewOnly = adminPedagogicoState\.activeTab === "overview"/);
  assert.match(script, /if \(overviewOnly\) \{/);
  assert.match(script, /await loadAdminPedOverviewV2Data\(\{ force \}\)/);
  assert.match(script, /else runAdminPedagogicoRenderers\(\)/);
  assert.doesNotMatch(script, /fetchWithAuth\("\/api\/pedagogico\/onboarding", \{ method: "GET" \}\)/);
});
