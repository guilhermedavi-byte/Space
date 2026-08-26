const test = require("node:test");
const assert = require("node:assert/strict");

const { buildLegacyRetentionImportSnapshot } = require("../api/_lib/retention-import");

test("importador legado gera dry-run idempotente sem duplicar o snapshot", () => {
  const users = [
    {
      firestoreDocId: "student-1",
      tipo: "student",
      nome: "Aluno Um",
      email: "aluno1@example.com",
      cancelamento: {
        dataPedido: "2026-08-20T12:00:00.000Z",
        dataFimAviso: "2026-10-20T12:00:00.000Z",
        eventos: [{ data: "2026-08-20T12:00:00.000Z", acao: "Pedido registrado", detalhe: "Teste" }],
      },
    },
  ];
  const first = buildLegacyRetentionImportSnapshot({ users, dryRun: true });
  const second = buildLegacyRetentionImportSnapshot({ users, dryRun: true, importedAt: first.payload.students[0].legacy_source.imported_at });
  assert.deepEqual(first.payload, second.payload);
  assert.equal(first.report.importedStudents, 1);
  assert.equal(first.report.openCases, 1);
  assert.equal(first.report.importedEvents, 1);
});

test("cancelamento efetivado entra como caso legado encerrado", () => {
  const snapshot = buildLegacyRetentionImportSnapshot({
    users: [
      {
        firestoreDocId: "student-2",
        tipo: "student",
        nome: "Aluno Dois",
        cancelamento: {
          dataPedido: "2026-07-10T12:00:00.000Z",
          dataEfetivacao: "2026-08-10T12:00:00.000Z",
          desfecho: { tipo: "churned" },
          eventos: [],
        },
      },
    ],
    dryRun: true,
  });
  assert.equal(snapshot.payload.cases.length, 1);
  assert.equal(snapshot.payload.cases[0].stage, "churned");
  assert.equal(snapshot.report.closedCases, 1);
});
