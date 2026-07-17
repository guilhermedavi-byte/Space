const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const script = fs.readFileSync(path.join(root, "script.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "styles.css"), "utf8");

test("Premium está disponível nos seletores e badges de plano", () => {
  assert.match(script, /premium:\s*\{\s*label:\s*"Premium"/);
  assert.match(script, /"Gold",\s*"Diamond",\s*"Premium",\s*"Turma"/);
  assert.match(script, /plan === "Premium"\) classes\.push\("is-plan-premium"\)/);
  assert.match(styles, /\.admin-student-tag\.is-plan-premium/);
  assert.match(styles, /rgba\(192, 192, 192, 0\.34\)/);
});

test("Premium herda elegibilidade ilimitada do Diamond em reposições", () => {
  assert.match(script, /plan === "diamond" \|\| plan === "premium"/);
  assert.match(script, /Plano \$\{planLabel\} — reposições ilimitadas com aviso no prazo/);
});
