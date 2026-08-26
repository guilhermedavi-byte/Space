const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildCommandPayload,
  buildQueuesFromCases,
  computeScheduledServiceEndAt,
  needsOverrideJustification,
  rebuildCaseProjectionFromEvents,
} = require("../api/_lib/retention-domain");

test("pedido dentro de 7 dias da primeira aula encerra em 1 mês da primeira aula", () => {
  const result = computeScheduledServiceEndAt({
    requestedAt: "2026-08-26T12:00:00.000Z",
    firstLessonAt: "2026-08-22T12:00:00.000Z",
  });
  assert.equal(result.toISOString(), "2026-09-22T12:00:00.000Z");
});

test("pedido fora da janela inicial encerra em 2 meses do pedido", () => {
  const result = computeScheduledServiceEndAt({
    requestedAt: "2026-08-26T12:00:00.000Z",
    firstLessonAt: "2026-08-01T12:00:00.000Z",
  });
  assert.equal(result.toISOString(), "2026-10-26T12:00:00.000Z");
});

test("command payload preserva retry idempotente e aceita resolução por firestore_student_id", () => {
  const payload = buildCommandPayload({
    command: "register_formal_request",
    actor: { sub: "growth-1", role: "growth", name: "Growth" },
    body: {
      firestoreStudentId: "firestore-123",
      clientActionId: "click-1",
      payload: { reason: "Quero cancelar" },
    },
  });
  assert.equal(payload.command, "register_formal_request");
  assert.equal(payload.firestore_student_id, "firestore-123");
  assert.equal(payload.client_action_id, "click-1");
  assert.equal(payload.idempotency_key, "register_formal_request:::click-1");
});

test("queues exibem financeiro indisponível sem forçar R$ 0,00", () => {
  const queues = buildQueuesFromCases([
    {
      id: "case-1",
      case_kind: "formal",
      stage: "scheduled",
      lifecycle_status: "cancellation_scheduled",
      pause_status: "none",
      financial_status: "unknown",
      version: 3,
      firestore_student_id: "student-1",
      full_name: "Aluno Teste",
      mrr_brl: null,
    },
  ]);
  assert.equal(queues.avisos.length, 1);
  assert.equal(queues.avisos[0].mrrDisplay, "Dados financeiros incompletos");
  assert.equal(queues.avisos[0].financialUnavailable, true);
});

test("override administrativo exige justificativa nos comandos críticos", () => {
  assert.equal(needsOverrideJustification({ command: "effectuate_churn", role: "admin" }), true);
  assert.equal(needsOverrideJustification({ command: "effectuate_churn", role: "growth" }), false);
});

test("projeção pode ser reconstruída a partir do histórico append-only", () => {
  const projection = rebuildCaseProjectionFromEvents([
    { event_type: "register_formal_request", payload: { scheduled_service_end_at: "2026-10-26T12:00:00.000Z" } },
    { event_type: "pause_non_billable" },
    { event_type: "mark_awaiting_customer" },
    { event_type: "retract_cancellation", occurred_at: "2026-08-27T12:00:00.000Z" },
  ]);
  assert.equal(projection.lifecycleStatus, "active");
  assert.equal(projection.pauseStatus, "paused_non_billable");
  assert.equal(projection.stage, "saved");
  assert.equal(projection.savedAt, "2026-08-27T12:00:00.000Z");
});
