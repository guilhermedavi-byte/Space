const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const script = fs.readFileSync(path.join(__dirname, "..", "script.js"), "utf8");

test("dashboard do professor faz merge por aluno+professor+data+horário", () => {
  assert.match(script, /const mergeTeacherDashboardLessons = \(firestoreLessons, liveLessons\) =>/);
  assert.match(
    script,
    /const key = `\$\{String\(lesson\.alunoId \|\| ""\)\}:\$\{String\(lesson\.professorId \|\| ""\)\}:\$\{String\(lesson\.dateKey \|\| ""\)\}:\$\{Number\(lesson\.startMin\) \|\| 0\}`/
  );
});

test("dashboard reaproveita o merge deduplicado ao juntar Firestore e live lessons", () => {
  assert.match(script, /aulas\.splice\(0, aulas\.length, \.\.\.mergeTeacherDashboardLessons\(aulas, liveAulas\)\);/);
});

test("badge Concluída na agenda de hoje depende apenas do horário já passado", () => {
  assert.match(script, /const isDone = evt\.endMs <= now\.getTime\(\);/);
  assert.match(script, /const badge = isDone \? "Concluída"/);
});
