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
