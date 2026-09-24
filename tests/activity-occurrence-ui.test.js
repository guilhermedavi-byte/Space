const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const script = fs.readFileSync(path.join(root, "script.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "styles.css"), "utf8");

test("Activity occurrence action uses the workspace visual component, not native details", () => {
  assert.match(script, /renderActivityOccurrenceForm/);
  assert.match(script, /class="actws-occurrence-trigger"/);
  assert.match(script, /class="actws-occurrence-panel"/);
  assert.match(script, /data-actws-occurrence-toggle/);
  assert.match(script, /data-actws-occurrence-cancel/);
  assert.match(script, /data-actws-occurrence-submit/);
  assert.doesNotMatch(script, /<details><summary>Marcar como ocorrência<\/summary>/);
});

test("Activity occurrence submit preserves existing mutation payload and loading/error states", () => {
  assert.match(script, /healthAction: "occurrence"/);
  assert.match(script, /commentId: form\.dataset\.actwsOccurrence/);
  assert.match(script, /category: formData\.get\("category"\)/);
  assert.match(script, /severity: formData\.get\("severity"\)/);
  assert.match(script, /Registrando\.\.\./);
  assert.match(script, /Ocorrência registrada\./);
  assert.match(script, /Não foi possível registrar a ocorrência/);
});

test("Activity occurrence CSS removes browser-default form appearance", () => {
  assert.match(styles, /\.actws-occurrence-field select\{[^}]*appearance:none/);
  assert.match(styles, /\.actws-occurrence-cancel,\s*\.actws-occurrence-submit\{[^}]*appearance:none/);
  assert.match(styles, /\.actws-occurrence-panel\{[^}]*background:rgba/);
  assert.match(styles, /\.actws-occurrence-fields\{[^}]*grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)/);
  assert.match(styles, /@media \(max-width: 760px\)\{[\s\S]*\.actws-occurrence-fields\{grid-template-columns:1fr\}/);
});
