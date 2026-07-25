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
});
