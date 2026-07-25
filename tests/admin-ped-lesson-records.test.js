const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const script = fs.readFileSync(path.join(__dirname, "..", "script.js"), "utf8");

test("Registros de Aulas usa o adaptador de evento->live lesson para casar status", () => {
  assert.match(script, /const recordByEventId = buildPedov2EventRecordIndex\(\{/);
  assert.match(script, /const mappedRecord = recordByEventId\.get\(String\(row\.id \|\| ""\)\) \|\| null;/);
  assert.match(script, /const liveLessonId = String\(mappedRecord\?\.aulaId \|\| ""\)\.trim\(\)/);
});

test("Registros de Aulas usa fallback pelo live lesson id antes de marcar sem registro", () => {
  assert.match(script, /const log = logsByEventId\.get\(String\(row\.id \|\| ""\)\) \|\| \(liveLessonId \? logsByEventId\.get\(liveLessonId\) \|\| null : null\) \|\| mappedLog;/);
  assert.match(script, /statusLabel = "Presença"/);
  assert.match(script, /statusLabel = "Falta"/);
  assert.match(script, /statusLabel = "Remarcada"/);
  assert.match(script, /statusLabel = "Cancelada"/);
});
