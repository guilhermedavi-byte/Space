const test = require("node:test");
const assert = require("node:assert/strict");

const { mergePedagogicalStudents } = require("../api/_lib/pedagogico-service");
const adminDataHandler = require("../api/admin-data");

const makeFirestoreStudent = (overrides = {}) => ({
  id: overrides.id || "fs-1",
  firestore_doc_id: overrides.firestore_doc_id || overrides.id || "fs-1",
  aluno_id: overrides.aluno_id || overrides.id || "fs-1",
  aluno_nome: overrides.aluno_nome || "Aluno Firestore",
  nome: overrides.nome || overrides.aluno_nome || "Aluno Firestore",
  email: overrides.email || "aluno@example.com",
  telefone: overrides.telefone || "+5511999999999",
  plano: overrides.plano || "Gold",
  professor_id: overrides.professor_id || "teacher-1",
  professor_nome: overrides.professor_nome || "Prof. Firestore",
  cancelamento: overrides.cancelamento ?? null,
  source: "firestore",
  ...overrides,
});

const makeSupabaseStudent = (overrides = {}) => ({
  id: overrides.id || "sb-1",
  aluno_id: overrides.aluno_id || overrides.id || "sb-1",
  aluno_nome: overrides.aluno_nome || "Aluno Supabase",
  email: overrides.email || "aluno@example.com",
  telefone: overrides.telefone || "+5511888888888",
  plano: overrides.plano || "Diamond",
  professor_id: overrides.professor_id || "teacher-2",
  professor_nome: overrides.professor_nome || "Prof. Supabase",
  source: overrides.source || "financeiro",
  ...overrides,
});

test("aluno somente no Firestore aparece", () => {
  const merged = mergePedagogicalStudents({
    onboarding: [makeFirestoreStudent({ id: "fs-only", email: "fs-only@example.com" })],
    financeStudents: [],
    preferences: [],
  });

  assert.equal(merged.length, 1);
  assert.equal(merged[0].firestore_doc_id, "fs-only");
  assert.equal(merged[0].legacy_orphan, false);
});

test("aluno nos dois bancos aparece uma vez", () => {
  const merged = mergePedagogicalStudents({
    onboarding: [makeFirestoreStudent({ id: "fs-joined", email: "joined@example.com" })],
    financeStudents: [makeSupabaseStudent({ id: "fin-1", firestore_doc_id: "fs-joined", email: "joined@example.com" })],
    preferences: [],
  });

  assert.equal(merged.length, 1);
  assert.equal(merged[0].firestore_doc_id, "fs-joined");
  assert.equal(merged[0].email, "joined@example.com");
});

test("cancelamento do Firestore prevalece", () => {
  const cancellation = { origem: "pedido", dataPedido: "2026-07-01T00:00:00.000Z", dataFimAviso: "2026-07-31T00:00:00.000Z", desfecho: null };
  const merged = mergePedagogicalStudents({
    onboarding: [makeFirestoreStudent({ id: "fs-cancel", email: "cancel@example.com", cancelamento: cancellation })],
    financeStudents: [makeSupabaseStudent({ id: "fin-cancel", firestore_doc_id: "fs-cancel", email: "cancel@example.com", cancelamento: null })],
    preferences: [],
  });

  assert.deepEqual(merged[0].cancelamento, cancellation);
});

test("Supabase sem firestore_doc_id não remove o aluno do Firestore", () => {
  const merged = mergePedagogicalStudents({
    onboarding: [makeFirestoreStudent({ id: "fs-visible", email: "visible@example.com" })],
    financeStudents: [makeSupabaseStudent({ id: "fin-orphan", email: "orphan@example.com" })],
    preferences: [],
  });

  assert.equal(merged.length, 2);
  assert.ok(merged.some((row) => row.firestore_doc_id === "fs-visible"));
  const orphan = merged.find((row) => row.id === "fin-orphan");
  assert.equal(orphan?.legacy_orphan, true);
});

test("dois alunos com nome igual não são fundidos", () => {
  const merged = mergePedagogicalStudents({
    onboarding: [
      makeFirestoreStudent({ id: "fs-a", nome: "João Silva", aluno_nome: "João Silva", email: "joao-a@example.com" }),
      makeFirestoreStudent({ id: "fs-b", nome: "João Silva", aluno_nome: "João Silva", email: "joao-b@example.com" }),
    ],
    financeStudents: [],
    preferences: [],
  });

  assert.equal(merged.length, 2);
  assert.deepEqual(
    merged.map((row) => row.firestore_doc_id).sort(),
    ["fs-a", "fs-b"]
  );
});

test("match ambíguo por e-mail gera warning e preserva registros", () => {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args);
  try {
    const merged = mergePedagogicalStudents({
      onboarding: [
        makeFirestoreStudent({ id: "fs-amb-1", email: "same@example.com" }),
        makeFirestoreStudent({ id: "fs-amb-2", email: "same@example.com" }),
      ],
      financeStudents: [makeSupabaseStudent({ id: "fin-amb", email: "same@example.com" })],
      preferences: [],
    });

    assert.equal(merged.length, 3);
    assert.ok(merged.some((row) => row.id === "fin-amb" && row.legacy_orphan === true));
    assert.ok(warnings.some((entry) => String(entry[0] || "").includes("ambiguous finance student email match")));
  } finally {
    console.warn = originalWarn;
  }
});

test("admin-data classifica aluno explícito e legado por markers", () => {
  const helpers = adminDataHandler._test;
  assert.equal(helpers.inferLegacyUserRole({ tipo: "student" }), "student");
  assert.equal(helpers.inferLegacyUserRole({ professorId: "teacher-1", plano: "Gold" }), "student");
  assert.equal(helpers.inferLegacyUserRole({ especialidade: "Business English" }), "teacher");
});

test("sync do espelho retorna ok=false quando rows_affected = 0", async () => {
  const modulePath = require.resolve("../api/_lib/student-mirror-sync");
  const firestoreAdminPath = require.resolve("../api/_lib/firestore-admin");
  const supabaseRestPath = require.resolve("../api/_lib/supabase-rest");
  const cachedModule = require.cache[modulePath];
  const cachedFirestore = require.cache[firestoreAdminPath];
  const cachedSupabase = require.cache[supabaseRestPath];

  require.cache[firestoreAdminPath] = {
    exports: {
      listCollectionAsAdmin: async () => [
        { id: "fs-sync-0", firestoreDocId: "fs-sync-0", tipo: "student", nome: "Aluno Sync", email: "sync@example.com" },
      ],
    },
  };
  require.cache[supabaseRestPath] = {
    exports: {
      supabaseFetch: async (path, { method = "GET" } = {}) => {
        if (method === "GET") return { status: 200, data: [] };
        return { status: 200, data: [] };
      },
    },
  };
  delete require.cache[modulePath];
  try {
    const { syncStudentMirrorToSupabase } = require("../api/_lib/student-mirror-sync");
    const result = await syncStudentMirrorToSupabase("fs-sync-0");
    assert.equal(result.ok, false);
    assert.equal(result.rowsAffected, 0);
    assert.equal(result.reason, "mirror_not_found");
  } finally {
    if (cachedModule) require.cache[modulePath] = cachedModule;
    else delete require.cache[modulePath];
    if (cachedFirestore) require.cache[firestoreAdminPath] = cachedFirestore;
    else delete require.cache[firestoreAdminPath];
    if (cachedSupabase) require.cache[supabaseRestPath] = cachedSupabase;
    else delete require.cache[supabaseRestPath];
  }
});

test("sync do espelho diferencia ambiguous e updated", async () => {
  const modulePath = require.resolve("../api/_lib/student-mirror-sync");
  const firestoreAdminPath = require.resolve("../api/_lib/firestore-admin");
  const supabaseRestPath = require.resolve("../api/_lib/supabase-rest");
  const cachedModule = require.cache[modulePath];
  const cachedFirestore = require.cache[firestoreAdminPath];
  const cachedSupabase = require.cache[supabaseRestPath];

  require.cache[firestoreAdminPath] = {
    exports: {
      listCollectionAsAdmin: async () => [
        { id: "fs-sync-1", firestoreDocId: "fs-sync-1", tipo: "student", nome: "Aluno Sync", email: "sync@example.com" },
      ],
    },
  };

  let getCount = 0;
  require.cache[supabaseRestPath] = {
    exports: {
      supabaseFetch: async (path, { method = "GET" } = {}) => {
        if (method === "GET") {
          getCount += 1;
          if (path.includes("firestore_doc_id=")) return { status: 200, data: [] };
          if (path.includes("email=")) return { status: 200, data: [{ id: 1 }, { id: 2 }] };
        }
        return { status: 200, data: [{ id: 1 }] };
      },
    },
  };
  delete require.cache[modulePath];
  try {
    const { syncStudentMirrorToSupabase } = require("../api/_lib/student-mirror-sync");
    const ambiguous = await syncStudentMirrorToSupabase("fs-sync-1");
    assert.equal(ambiguous.ok, false);
    assert.equal(ambiguous.results[0].status, "ambiguous");
    assert.equal(ambiguous.rowsAffected, 0);
  } finally {
    if (cachedModule) require.cache[modulePath] = cachedModule;
    else delete require.cache[modulePath];
    if (cachedFirestore) require.cache[firestoreAdminPath] = cachedFirestore;
    else delete require.cache[firestoreAdminPath];
    if (cachedSupabase) require.cache[supabaseRestPath] = cachedSupabase;
    else delete require.cache[supabaseRestPath];
  }
});

test("sync do espelho retorna updated com rows_affected explícito", async () => {
  const modulePath = require.resolve("../api/_lib/student-mirror-sync");
  const firestoreAdminPath = require.resolve("../api/_lib/firestore-admin");
  const supabaseRestPath = require.resolve("../api/_lib/supabase-rest");
  const cachedModule = require.cache[modulePath];
  const cachedFirestore = require.cache[firestoreAdminPath];
  const cachedSupabase = require.cache[supabaseRestPath];

  require.cache[firestoreAdminPath] = {
    exports: {
      listCollectionAsAdmin: async () => [
        { id: "fs-sync-2", firestoreDocId: "fs-sync-2", tipo: "student", nome: "Aluno Sync", email: "sync2@example.com" },
      ],
    },
  };
  require.cache[supabaseRestPath] = {
    exports: {
      supabaseFetch: async (path, { method = "GET" } = {}) => {
        if (method === "GET") return { status: 200, data: [{ id: 7 }] };
        return { status: 200, data: [{ id: 7 }] };
      },
    },
  };
  delete require.cache[modulePath];
  try {
    const { syncStudentMirrorToSupabase } = require("../api/_lib/student-mirror-sync");
    const updated = await syncStudentMirrorToSupabase("fs-sync-2");
    assert.equal(updated.ok, true);
    assert.equal(updated.rowsAffected, 2);
    assert.ok(updated.results.every((item) => item.status === "updated"));
  } finally {
    if (cachedModule) require.cache[modulePath] = cachedModule;
    else delete require.cache[modulePath];
    if (cachedFirestore) require.cache[firestoreAdminPath] = cachedFirestore;
    else delete require.cache[firestoreAdminPath];
    if (cachedSupabase) require.cache[supabaseRestPath] = cachedSupabase;
    else delete require.cache[supabaseRestPath];
  }
});
