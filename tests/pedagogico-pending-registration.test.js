const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

const script = fs.readFileSync(path.join(__dirname, "..", "script.js"), "utf8");

test("pendência pedagógica usa somente status de registro válido", () => {
  assert.match(script, /const PEDAGOGICO_REGISTERED_STATUSES = new Set\(\["realizada", "falta_aluno", "remarcada", "cancelada"\]\)/);
  assert.match(script, /const getPedagogicoRegisteredStatus = \(log\) =>/);
  assert.match(script, /const isDone = Boolean\(registeredStatus\)/);
  assert.doesNotMatch(script, /situacaoReposicao[^\n]+temporalState === "pending"/);
});

test("logs pedagógicos são indexados também pelo id derivado do documento", () => {
  assert.match(script, /const derivePedagogicoEventIdFromLogId = \(id\) =>/);
  assert.match(script, /indexPedagogicoLogByEvent\(logsByEventId, derivePedagogicoEventIdFromLogId\(log\.id \|\| log\.docId \|\| log\.documentId\), log\)/);
});
