const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const script = fs.readFileSync(path.join(__dirname, "..", "script.js"), "utf8");
const {
  normalizeLessonRegisterStatus,
  getLessonStatusWeight,
  getCreditedLessonMinutes,
} = require("../api/_lib/teacher-dashboard-hours");

test("normalizeLessonRegisterStatus trata status pedagógicos relevantes", () => {
  assert.equal(normalizeLessonRegisterStatus("Realizada"), "realizada");
  assert.equal(normalizeLessonRegisterStatus("Falta"), "falta_aluno");
  assert.equal(normalizeLessonRegisterStatus("Cancelada"), "cancelada");
  assert.equal(normalizeLessonRegisterStatus("Remarcada"), "remarcada");
  assert.equal(normalizeLessonRegisterStatus(""), "");
});

test("getLessonStatusWeight aplica pesos corretos", () => {
  assert.equal(getLessonStatusWeight("realizada"), 1);
  assert.equal(getLessonStatusWeight("falta_aluno"), 0.5);
  assert.equal(getLessonStatusWeight("cancelada"), 0);
  assert.equal(getLessonStatusWeight("remarcada"), 0);
  assert.equal(getLessonStatusWeight("sem_registro"), 0);
});

test("getCreditedLessonMinutes soma integral para aula realizada", () => {
  assert.equal(getCreditedLessonMinutes({ startMin: 600, endMin: 645, status: "realizada" }), 45);
});

test("getCreditedLessonMinutes soma metade para falta", () => {
  assert.equal(getCreditedLessonMinutes({ startMin: 600, endMin: 630, status: "falta_aluno" }), 15);
});

test("getCreditedLessonMinutes zera cancelada, remarcada e sem registro", () => {
  assert.equal(getCreditedLessonMinutes({ startMin: 600, endMin: 630, status: "cancelada" }), 0);
  assert.equal(getCreditedLessonMinutes({ startMin: 600, endMin: 630, status: "remarcada" }), 0);
  assert.equal(getCreditedLessonMinutes({ startMin: 600, endMin: 630, status: "" }), 0);
});

test("reposicao realizada conta 100% pela duração real", () => {
  assert.equal(getCreditedLessonMinutes({ startMin: 600, endMin: 630, status: "realizada" }), 30);
});

test("script do dashboard usa minutos creditados por status no card mensal", () => {
  assert.match(script, /const getTeacherDashboardLessonCreditedMinutes = \(lesson, logsByEventId\) =>/);
  assert.match(script, /const monthMinutes = monthLessons\.reduce\(\(acc, evt\) => acc \+ getTeacherDashboardLessonCreditedMinutes\(evt, logsByEventId\), 0\)/);
  assert.match(script, /const lastMonthMinutes = lastMonthLessons\.reduce\(\(acc, evt\) => acc \+ getTeacherDashboardLessonCreditedMinutes\(evt, logsByEventId\), 0\)/);
});
