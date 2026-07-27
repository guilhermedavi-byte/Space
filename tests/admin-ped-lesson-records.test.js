const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const script = fs.readFileSync(path.join(__dirname, "..", "script.js"), "utf8");

test("Registros de Aulas usa occurrence_id como chave primária do join", () => {
  assert.match(script, /const legacyOccurrenceMap =\s+adminPedagogicoState\.legacyOccurrenceMap/);
  assert.match(script, /recordsByOccurrenceId: recordsIndex\.byOccurrenceId/);
  assert.match(script, /const mappedRecord = recordByEventId\.get\(String\(row\.id \|\| ""\)\) \|\| null;/);
  assert.match(script, /occurrenceId: String\(\s*event\.occurrenceId \|\|\s*\(legacyOccurrenceMap\.byEventId instanceof Map/);
});

test("Registros de Aulas usa fallback explícito só pelo legacy occurrence map", () => {
  assert.match(script, /const normalizeAdminPedLegacyOccurrenceMap = \(rows\) => \{/);
  assert.match(script, /fetchWithAuth\(\"\/api\/pedagogico\/legacy-occurrence-map\", \{ method: \"GET\", cache: \"no-store\" \}\)/);
  assert.match(script, /const occurrenceId =\s+String\(event\?\.occurrenceId \|\| ""\)\.trim\(\) \|\|\s+\(legacyOccurrenceMap && legacyOccurrenceMap\.byEventId instanceof Map/);
  assert.match(script, /const log = mappedLog \|\| logsByEventId\.get\(String\(row\.id \|\| ""\)\) \|\| null;/);
  assert.match(script, /statusLabel = "Presença"/);
  assert.match(script, /statusLabel = "Falta"/);
  assert.match(script, /statusLabel = "Remarcada"/);
  assert.match(script, /statusLabel = "Cancelada"/);
});
