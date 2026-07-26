const test = require("node:test");
const assert = require("node:assert/strict");

process.env.APP_ENV = "local";

const { _private } = require("../api/schedule-events");

test("findScheduleConflict bloqueia professor com aula sobreposta", () => {
  const conflict = _private.findScheduleConflict({
    candidates: [{ professorId: "teacher-1", dateKey: "2026-07-14", startMin: 1200, endMin: 1230 }],
    existingEvents: [{ id: "aula-1", professorId: "teacher-1", dateKey: "2026-07-14", startMin: 1200, endMin: 1230, alunoNome: "Aluno A" }],
  });

  assert.equal(conflict.source, "firestore");
  assert.equal(conflict.existing.id, "aula-1");
});

test("findScheduleConflict permite mesmo horário para professores diferentes", () => {
  const conflict = _private.findScheduleConflict({
    candidates: [{ professorId: "teacher-2", dateKey: "2026-07-14", startMin: 1200, endMin: 1230 }],
    existingEvents: [{ id: "aula-1", professorId: "teacher-1", dateKey: "2026-07-14", startMin: 1200, endMin: 1230 }],
  });

  assert.equal(conflict, null);
});

test("findScheduleConflict bloqueia duplicata dentro do mesmo payload", () => {
  const conflict = _private.findScheduleConflict({
    candidates: [
      { professorId: "teacher-1", dateKey: "2026-07-14", startMin: 1200, endMin: 1230 },
      { professorId: "teacher-1", dateKey: "2026-07-14", startMin: 1215, endMin: 1245 },
    ],
    existingEvents: [],
  });

  assert.equal(conflict.source, "request");
});

test("findScheduleConflict ignora o próprio evento ao editar", () => {
  const conflict = _private.findScheduleConflict({
    candidates: [{ id: "aula-1", professorId: "teacher-1", dateKey: "2026-07-14", startMin: 1200, endMin: 1230 }],
    existingEvents: [{ id: "aula-1", professorId: "teacher-1", dateKey: "2026-07-14", startMin: 1200, endMin: 1230 }],
    excludeId: "aula-1",
  });

  assert.equal(conflict, null);
});

test("teacher só pode escrever na própria agenda", () => {
  assert.equal(
    _private.canTeacherWriteOwnSchedule({ role: "teacher", requesterId: "teacher-1", professorId: "teacher-1" }),
    true
  );
  assert.equal(
    _private.canTeacherWriteOwnSchedule({ role: "teacher", requesterId: "teacher-1", professorId: "teacher-2" }),
    false
  );
  assert.equal(
    _private.canTeacherWriteOwnSchedule({ role: "admin", requesterId: "admin-1", professorId: "teacher-1" }),
    false
  );
});

test("payload live mantém alunoNome quando backend recebe fallback do front", () => {
  const payload = _private.buildLiveLessonMirrorPayload({
    eventId: "aula-1",
    data: {
      firestoreDocId: "student-1",
      occurrenceId: "occ_123",
      alunoId: "student-1",
      alunoNome: "André Luiz",
      professorId: "teacher-1",
      professorNome: "Rodrigo Batista",
      dateKey: "2026-07-28",
      startMin: 1290,
      endMin: 1320,
    },
    startMs: Date.parse("2026-07-29T00:30:00.000Z"),
    endMs: Date.parse("2026-07-29T01:00:00.000Z"),
  });

  assert.equal(payload.aluno_nome, "André Luiz");
  assert.equal(payload.professor_id, "teacher-1");
  assert.equal(payload.professor_nome, "Rodrigo Batista");
  assert.equal(payload.occurrence_id, "occ_123");
});

test("buildOccurrenceId gera chave canônica com prefixo occ", () => {
  const occurrenceId = _private.buildOccurrenceId();
  assert.match(occurrenceId, /^occ_/);
});

test("findLinkedReplacementEvent encontra reposição já criada pelo vínculo de origem", () => {
  const linked = _private.findLinkedReplacementEvent({
    existingEvents: [
      { id: "aula_old", originEventId: "", originLessonId: "" },
      { id: "aula_new", originEventId: "fire_event_1", originLessonId: "live_5014" },
    ],
    originEventId: "fire_event_1",
    originLessonId: "live_5014",
  });

  assert.equal(linked?.id, "aula_new");
});

test("buildRecurringSeriesMutationPlan preserva passado, atualiza datas futuras e cancela slots removidos", () => {
  const plan = _private.buildRecurringSeriesMutationPlan({
    groupId: "grp-1",
    effectiveFromKey: "2026-07-28",
    nowMs: Date.parse("2026-07-26T12:00:00.000Z"),
    candidateDocs: [
      { dateKey: "2026-07-28", startMin: 1290, endMin: 1320 },
      { dateKey: "2026-07-30", startMin: 1290, endMin: 1320 },
    ],
    existingEvents: [
      { id: "past-1", grupoRecorrenciaId: "grp-1", dateKey: "2026-07-24", startMs: Date.parse("2026-07-25T01:00:00.000Z") },
      { id: "keep-28", grupoRecorrenciaId: "grp-1", dateKey: "2026-07-28", startMs: Date.parse("2026-07-29T01:00:00.000Z") },
      { id: "cancel-29", grupoRecorrenciaId: "grp-1", dateKey: "2026-07-29", startMs: Date.parse("2026-07-30T01:00:00.000Z") },
    ],
  });

  assert.deepEqual(plan.updates.map((entry) => entry.existing.id), ["keep-28"]);
  assert.equal(plan.creates.length, 1);
  assert.equal(plan.creates[0].dateKey, "2026-07-30");
  assert.deepEqual(plan.cancels.map((row) => row.id), ["cancel-29"]);
});
