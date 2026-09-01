const test = require("node:test");
const assert = require("node:assert/strict");

const storePath = require.resolve("../api/_lib/retention-store");
const firestorePath = require.resolve("../api/_lib/firestore-admin");
const supabaseRestPath = require.resolve("../api/_lib/supabase-rest");

const loadStore = ({ supabaseFetchImpl, getDocumentImpl = async () => ({}) } = {}) => {
  delete require.cache[storePath];
  delete require.cache[firestorePath];
  delete require.cache[supabaseRestPath];
  require.cache[firestorePath] = {
    id: firestorePath,
    filename: firestorePath,
    loaded: true,
    exports: {
      getDocumentAsAdmin: getDocumentImpl,
    },
  };
  require.cache[supabaseRestPath] = {
    id: supabaseRestPath,
    filename: supabaseRestPath,
    loaded: true,
    exports: {
      supabaseFetch: supabaseFetchImpl,
    },
  };
  return require("../api/_lib/retention-store");
};

test("provisiona aluno ausente e resolve subject depois do upsert local", async () => {
  const calls = [];
  let provisioned = false;
  const store = loadStore({
    getDocumentImpl: async () => ({
      firestoreDocId: "firestore-123",
      nome: "Aluno Novo",
      email: "novo@example.com",
      telefone: "5511999990000",
      dataCadastro: "2026-08-10",
      plano: "Gold",
      ativo: true,
    }),
    supabaseFetchImpl: async (path, { body } = {}) => {
      calls.push({ path, body });
      if (path === "/rpc/retention_resolve_subject_by_firestore_student_id") {
        return { status: 200, data: provisioned ? { student_id: "student-uuid", subscription_id: "subscription-uuid" } : null };
      }
      if (path === "/rpc/retention_provision_subject") {
        provisioned = true;
        return { status: 200, data: { ok: true } };
      }
      throw new Error(`unexpected_path:${path}`);
    },
  });

  const resolved = await store.resolveRetentionSubjectByFirestoreStudentId({ firestoreStudentId: "firestore-123" });
  assert.deepEqual(resolved, {
    studentId: "student-uuid",
    subscriptionId: "subscription-uuid",
    firestoreStudentId: "firestore-123",
  });
  assert.equal(calls.filter((entry) => entry.path === "/rpc/retention_provision_subject").length, 1);
  assert.equal(calls[1].body.p_payload.subscription.external_subscription_key, "firestore:firestore-123");
  assert.equal(calls[1].body.p_payload.service_period.period_start, "2026-08-10");
  assert.equal(calls[1].body.p_payload.service_period.period_end, "2026-09-09");
});

test("aluno já existente não reprovisiona nem consulta Firestore", async () => {
  let firestoreCalls = 0;
  let provisionCalls = 0;
  const store = loadStore({
    getDocumentImpl: async () => {
      firestoreCalls += 1;
      return {};
    },
    supabaseFetchImpl: async (path) => {
      if (path === "/rpc/retention_resolve_subject_by_firestore_student_id") {
        return { status: 200, data: { student_id: "student-existing", subscription_id: "subscription-existing" } };
      }
      if (path === "/rpc/retention_provision_subject") {
        provisionCalls += 1;
        return { status: 200, data: { ok: true } };
      }
      throw new Error(`unexpected_path:${path}`);
    },
  });

  const resolved = await store.resolveRetentionSubjectByFirestoreStudentId({ firestoreStudentId: "firestore-existing" });
  assert.equal(resolved.studentId, "student-existing");
  assert.equal(firestoreCalls, 0);
  assert.equal(provisionCalls, 0);
});

test("chamadas concorrentes do mesmo aluno compartilham um único provisionamento", async () => {
  let firestoreCalls = 0;
  let provisionCalls = 0;
  let provisioned = false;
  const store = loadStore({
    getDocumentImpl: async () => {
      firestoreCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return {
        firestoreDocId: "firestore-concurrent",
        nome: "Aluno Concorrente",
        dataCadastro: "2026-08-05",
        ativo: true,
      };
    },
    supabaseFetchImpl: async (path) => {
      if (path === "/rpc/retention_resolve_subject_by_firestore_student_id") {
        return {
          status: 200,
          data: provisioned ? { student_id: "student-concurrent", subscription_id: "subscription-concurrent" } : null,
        };
      }
      if (path === "/rpc/retention_provision_subject") {
        provisionCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 20));
        provisioned = true;
        return { status: 200, data: { ok: true } };
      }
      throw new Error(`unexpected_path:${path}`);
    },
  });
  store._test.clearProvisionInFlight();

  const [first, second] = await Promise.all([
    store.resolveRetentionSubjectByFirestoreStudentId({ firestoreStudentId: "firestore-concurrent" }),
    store.resolveRetentionSubjectByFirestoreStudentId({ firestoreStudentId: "firestore-concurrent" }),
  ]);

  assert.equal(first.studentId, "student-concurrent");
  assert.equal(second.subscriptionId, "subscription-concurrent");
  assert.equal(firestoreCalls, 1);
  assert.equal(provisionCalls, 1);
});

test("aluno inexistente no Firestore falha com erro claro e sem provisionar", async () => {
  let provisionCalls = 0;
  const store = loadStore({
    getDocumentImpl: async () => {
      const error = new Error("firestore_admin_get_failed");
      error.status = 404;
      throw error;
    },
    supabaseFetchImpl: async (path) => {
      if (path === "/rpc/retention_resolve_subject_by_firestore_student_id") {
        return { status: 200, data: null };
      }
      if (path === "/rpc/retention_provision_subject") {
        provisionCalls += 1;
        return { status: 200, data: { ok: true } };
      }
      throw new Error(`unexpected_path:${path}`);
    },
  });
  store._test.clearProvisionInFlight();

  await assert.rejects(
    () => store.resolveRetentionSubjectByFirestoreStudentId({ firestoreStudentId: "missing-firestore-student" }),
    (error) => error?.code === "retention_student_not_found"
  );
  assert.equal(provisionCalls, 0);
});

test("falha no provisionamento não avança para nova resolução nem cria sequência parcial no store", async () => {
  const calls = [];
  const store = loadStore({
    getDocumentImpl: async () => ({
      firestoreDocId: "firestore-fail",
      nome: "Aluno Falho",
      dataCadastro: "2026-08-12",
      ativo: true,
    }),
    supabaseFetchImpl: async (path) => {
      calls.push(path);
      if (path === "/rpc/retention_resolve_subject_by_firestore_student_id") {
        return { status: 200, data: null };
      }
      if (path === "/rpc/retention_provision_subject") {
        const error = new Error("provision_rpc_failed");
        error.code = "provision_rpc_failed";
        throw error;
      }
      throw new Error(`unexpected_path:${path}`);
    },
  });
  store._test.clearProvisionInFlight();

  await assert.rejects(
    () => store.resolveRetentionSubjectByFirestoreStudentId({ firestoreStudentId: "firestore-fail" }),
    (error) => error?.code === "provision_rpc_failed"
  );
  assert.deepEqual(calls, [
    "/rpc/retention_resolve_subject_by_firestore_student_id",
    "/rpc/retention_provision_subject",
  ]);
});

test("service period mensal ancora no dia de entrada e renova por ciclo corrente", () => {
  const store = loadStore({ supabaseFetchImpl: async () => ({ status: 200, data: null }) });
  const period = store._test.resolveCurrentMonthlyServicePeriod({
    startDateKey: "2026-01-31",
    today: new Date("2026-08-28T12:00:00-03:00"),
  });
  assert.deepEqual(period, {
    periodStart: "2026-07-31",
    periodEnd: "2026-08-30",
  });
});
