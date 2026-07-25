const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const liveLessonsSource = fs.readFileSync(path.join(__dirname, "..", "api", "_lib", "live-lessons.js"), "utf8");
const { summarizeLiveLessons, omitNilValues } = require("../api/_lib/live-lessons");

test("aula antiga com status ao_vivo não entra como aula ativa", () => {
  const now = Date.parse("2026-06-23T15:00:00.000Z");
  const summary = summarizeLiveLessons(
    [{
      status_aula: "ao_vivo",
      inicio: "2026-06-12T14:00:00.000Z",
      fim: "2026-06-12T15:00:00.000Z",
      startMs: Date.parse("2026-06-12T14:00:00.000Z"),
      endMs: Date.parse("2026-06-12T15:00:00.000Z"),
      professor_id: "p1",
      aluno_id: "a1",
    }],
    now
  );
  assert.equal(summary.liveNow, 0);
  assert.equal(summary.staleLive, 1);
});

test("aula dentro do horário aparece ao vivo mesmo antes da atualização do status", () => {
  const now = Date.parse("2026-06-23T15:00:00.000Z");
  const summary = summarizeLiveLessons(
    [{
      status_aula: "agendada",
      inicio: "2026-06-23T14:30:00.000Z",
      fim: "2026-06-23T15:30:00.000Z",
      startMs: Date.parse("2026-06-23T14:30:00.000Z"),
      endMs: Date.parse("2026-06-23T15:30:00.000Z"),
      professor_id: "p1",
      aluno_id: "a1",
    }],
    now
  );
  assert.equal(summary.liveNow, 1);
  assert.equal(summary.teachersInClass, 1);
  assert.equal(summary.studentsInClass, 1);
});

test("omitNilValues remove campos legados nulos sem perder false e zero", () => {
  const payload = omitNilValues({
    aula_id: "lesson-1",
    status: "realizada",
    engajamento: null,
    confianca: undefined,
    reposicao_necessaria: false,
    estrelas: 0,
    observacoes: "",
  });

  assert.deepEqual(payload, {
    aula_id: "lesson-1",
    status: "realizada",
    reposicao_necessaria: false,
    estrelas: 0,
    observacoes: "",
  });
});

test("remarcação atualiza início e fim da aula live para manter duração válida", () => {
  assert.match(liveLessonsSource, /const durationMs = computeLessonDurationMs\(lesson\)/);
  assert.match(liveLessonsSource, /lessonPatch\.inicio = nextStartIso/);
  assert.match(liveLessonsSource, /lessonPatch\.fim = new Date\(nextStartMs \+ durationMs\)\.toISOString\(\)/);
});
