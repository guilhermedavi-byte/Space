const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const script = fs.readFileSync(path.join(__dirname, "..", "script.js"), "utf8");

test("status visual do registro pedagógico é sincronizado pela mesma fonte de verdade", () => {
  assert.match(script, /const syncPedagogicoStatusControlState = \(rootEl, selectedStatus\) =>/);
  assert.match(script, /pill\.classList\.toggle\("is-selected", isSelected\)/);
  assert.match(script, /pill\.setAttribute\("aria-pressed", isSelected \? "true" : "false"\)/);
  assert.match(script, /syncPedagogicoStatusControlState\(formRoot instanceof HTMLElement \? formRoot : pedagogicoFormContainer, nextStatus\)/);
  assert.match(script, /syncPedagogicoStatusControlState\(formRoot, nextValue\)/);
});
