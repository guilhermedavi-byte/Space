const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildCommandPayload,
  buildQueuesFromCases,
  computeScheduledServiceEndAt,
  needsOverrideJustification,
  rebuildCaseProjectionFromEvents,
  sanitizePayloadByCommand,
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

test("command payload saneia campos e bloqueia mass assignment fora do comando", () => {
  const payload = buildCommandPayload({
    command: "register_formal_request",
    actor: { sub: "growth-1", role: "growth", name: "Growth", email: "hidden@example.com" },
    body: {
      firestoreStudentId: "firestore-123",
      clientActionId: "click-1",
      payload: {
        requested_at: "2026-08-26T12:00:00.000Z",
        reason: "Quero cancelar",
        injected: "nope",
        lifecycle_status: "churned",
      },
    },
  });
  assert.equal(payload.actor.email, undefined);
  assert.deepEqual(Object.keys(payload.payload).sort(), ["detail", "first_lesson_at", "origin", "reason", "requested_at"]);
  assert.equal(payload.payload.injected, undefined);
  assert.equal(payload.payload.lifecycle_status, undefined);
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

test("queues mapeiam caso perdido como desfecho lost", () => {
  const queues = buildQueuesFromCases([
    {
      id: "case-1",
      case_kind: "formal",
      stage: "lost",
      lifecycle_status: "churned",
      pause_status: "none",
      financial_status: "unknown",
      version: 3,
      firestore_student_id: "student-1",
      full_name: "Aluno Teste",
    },
  ]);
  assert.equal(queues.efetivados.length, 1);
  assert.equal(queues.efetivados[0].desfecho, "lost");
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

test("awaiting_customer preserva a data final já programada", () => {
  const projection = rebuildCaseProjectionFromEvents([
    { event_type: "register_formal_request", payload: { scheduled_service_end_at: "2026-10-26T12:00:00.000Z" } },
    { event_type: "mark_awaiting_customer" },
  ]);
  assert.equal(projection.stage, "awaiting_customer");
  assert.equal(projection.scheduledServiceEndAt, "2026-10-26T12:00:00.000Z");
});

test("continuidade confirmada devolve o caso para scheduled", () => {
  const projection = rebuildCaseProjectionFromEvents([
    { event_type: "register_formal_request", payload: { scheduled_service_end_at: "2026-10-26T12:00:00.000Z" } },
    { event_type: "mark_awaiting_customer" },
    { event_type: "confirm_cancellation_continuity" },
  ]);
  assert.equal(projection.stage, "scheduled");
  assert.equal(projection.lifecycleStatus, "cancellation_scheduled");
});

test("delinquency_recovered retorna o financeiro para current", () => {
  const projection = rebuildCaseProjectionFromEvents(
    [{ event_type: "delinquency_recovered" }],
    { financialStatus: "delinquent" }
  );
  assert.equal(projection.financialStatus, "current");
});

test("delinquency_started leva o financeiro para delinquent", () => {
  const projection = rebuildCaseProjectionFromEvents([{ event_type: "delinquency_started" }]);
  assert.equal(projection.financialStatus, "delinquent");
});

test("legacy_import com state_after semeia a projeção reconstruída", () => {
  const projection = rebuildCaseProjectionFromEvents([
    {
      event_type: "legacy_import",
      state_after: {
        stage: "scheduled",
        lifecycle_status: "cancellation_scheduled",
        pause_status: "paused_non_billable",
        financial_status: "unknown",
        scheduled_service_end_at: "2026-10-27T12:00:00.000Z",
      },
    },
  ]);
  assert.equal(projection.stage, "scheduled");
  assert.equal(projection.lifecycleStatus, "cancellation_scheduled");
  assert.equal(projection.pauseStatus, "paused_non_billable");
  assert.equal(projection.scheduledServiceEndAt, "2026-10-27T12:00:00.000Z");
});

test("sanitizePayloadByCommand ignora campos técnicos fora do contrato", () => {
  const payload = sanitizePayloadByCommand({
    command: "effectuate_churn",
    payload: {
      mode: "automatic",
      occurred_at: "2026-08-26T15:00:00.000Z",
      notes: "ok",
      actor_uid: "leak",
      pause_status: "paused_billable",
    },
  });
  assert.deepEqual(Object.keys(payload).sort(), ["mode", "notes", "occurred_at", "outcome"]);
  assert.equal(payload.actor_uid, undefined);
  assert.equal(payload.pause_status, undefined);
});
