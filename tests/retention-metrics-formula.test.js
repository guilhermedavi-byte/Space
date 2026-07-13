const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const script = fs.readFileSync(path.join(__dirname, "..", "script.js"), "utf8");

test("taxa de reversão usa casos fechados no mês como denominador", () => {
  assert.match(script, /const casosFechadosNoMes = revertidosNoMes \+ churnNoMes/);
  assert.match(script, /reversalRate: casosFechadosNoMes > 0 \? \(revertidosNoMes \/ casosFechadosNoMes\) \* 100 : null/);
  assert.doesNotMatch(script, /reversalRate: pedidosNoMes > 0 \? \(revertidosNoMes \/ pedidosNoMes\) \* 100 : 0/);
});

test("taxa de reversão sem casos fechados é exibida como sem dados", () => {
  assert.match(script, /label: "Taxa de reversão"/);
  assert.match(script, /value: m\.reversalRate == null \? "—" : formatRetentionPercent\(m\.reversalRate\)/);
  assert.match(script, /Sem casos fechados no mês/);
});
