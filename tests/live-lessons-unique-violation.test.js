const test = require("node:test");
const assert = require("node:assert/strict");

const { isOccurrenceUniqueViolation } = require("../api/_lib/live-lessons");

test("isOccurrenceUniqueViolation detecta 23505 do índice de occurrence_id", () => {
  assert.equal(
    isOccurrenceUniqueViolation({
      code: "23505",
      message: "duplicate key value violates unique constraint ux_n8n_registros_aula_space_occurrence_id",
    }),
    true
  );
});

test("isOccurrenceUniqueViolation ignora erros de outra natureza", () => {
  assert.equal(
    isOccurrenceUniqueViolation({
      code: "PGRST204",
      message: "column does not exist",
    }),
    false
  );
});
