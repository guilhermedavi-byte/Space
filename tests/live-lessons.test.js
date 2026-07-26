const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const liveLessonsSource = fs.readFileSync(path.join(__dirname, "..", "api", "_lib", "live-lessons.js"), "utf8");
const { summarizeLiveLessons, omitNilValues, buildLessonRegisterRecord, normalizeLesson } = require("../api/_lib/live-lessons");

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

test("remarcação live não move mais a aula original para a nova data", () => {
  assert.match(liveLessonsSource, /const lessonPatch = \{\s*status_aula:/);
  assert.doesNotMatch(liveLessonsSource, /lessonPatch\.inicio = nextStartIso/);
  assert.doesNotMatch(liveLessonsSource, /lessonPatch\.fim = new Date\(nextStartMs \+ durationMs\)\.toISOString\(\)/);
});

test("register novo herda occurrence_id canônico da lesson", () => {
  const register = buildLessonRegisterRecord({
    lesson: {
      id: "lesson-1",
      occurrence_id: "occ_abc",
      firestore_doc_id: "student-1",
      aluno_id: "student-1",
      aluno_nome: "Aluno",
      professor_id: "teacher-1",
      professor_nome: "Professor",
      professor_email: "teacher@example.com",
    },
    session: { name: "Teacher" },
    payload: { status: "realizada", conteudo_trabalhado: "Simple past" },
    now: "2026-07-26T03:00:00.000Z",
  });

  assert.equal(register.occurrence_id, "occ_abc");
});

test("normalizeLesson preserva occurrence_id quando a linha live já o possui", () => {
  const lesson = normalizeLesson({
    id: 10,
    occurrence_id: "occ_live_1",
    aluno_id: "student-1",
    professor_id: "teacher-1",
    status_aula: "agendada",
  });

  assert.equal(lesson?.occurrence_id, "occ_live_1");
});
