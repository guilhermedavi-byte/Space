const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const script = fs.readFileSync(path.join(__dirname, "..", "script.js"), "utf8");
const styles = fs.readFileSync(path.join(__dirname, "..", "styles.css"), "utf8");

test("status visual do registro pedagógico é sincronizado pela mesma fonte de verdade", () => {
  assert.match(script, /const syncPedagogicoStatusControlState = \(rootEl, selectedStatus\) =>/);
  assert.match(script, /pill\.classList\.toggle\("is-selected", isSelected\)/);
  assert.match(script, /pill\.setAttribute\("aria-pressed", isSelected \? "true" : "false"\)/);
  assert.match(script, /syncPedagogicoStatusControlState\(formRoot instanceof HTMLElement \? formRoot : pedagogicoFormContainer, nextStatus\)/);
  assert.match(script, /syncPedagogicoStatusControlState\(formRoot, nextValue\)/);
});

test("painel de usuários do pedagógico não usa corte fixo de altura", () => {
  assert.doesNotMatch(styles, /\.admin-ped-panel\s*\{[^}]*max-height:\s*4000px/s);
  assert.match(styles, /\.admin-ped-surface--people\s*\{[^}]*height:\s*calc\(100dvh - var\(--admin-ped-people-viewport-offset\)\)/s);
  assert.match(styles, /\.admin-ped-surface--people\s*\{[^}]*border-bottom-color:\s*transparent/s);
  assert.match(styles, /\.admin-ped-list--students,\s*\.admin-ped-teachers\s*\{[^}]*overflow-y:\s*auto/s);
  assert.match(script, /class="admin-ped-list admin-ped-list--students"/);
  assert.match(script, /const syncAdminPedPeopleViewportHeight = \(pass = 0\) =>/);
  assert.match(script, /card\.style\.setProperty\("--admin-ped-people-viewport-offset", `\$\{top\}px`\)/);
  assert.match(script, /card\.style\.height = `\$\{height\}px`/);
});

test("agenda admin suporta semana de 7 dias e split com 1 professor", () => {
  assert.match(script, /const getWeekDaysMonToSun = \(date\) =>/);
  assert.match(script, /const formatWeekRange = \(days\) =>/);
  assert.match(script, /const days = getWeekDaysMonToSun\(focus\)/);
  assert.match(script, /const days = getWeekDaysMonToSun\(focusDate\)/);
  assert.match(script, /if \(selected instanceof Set && selected\.size > 0\)/);
  assert.match(script, /teacher-cal-week-head-days" style="grid-template-columns:repeat\(\$\{days\.length\}, minmax\(0, 1fr\)\)"/);
  assert.match(script, /teacher-cal-week-cols" style="grid-template-columns:repeat\(\$\{days\.length\}, minmax\(0, 1fr\)\)"/);
  assert.match(script, /const color = currentRole === "admin" \? getAdminTeacherColor\(event\.professorId\) : ""/);
});

test("datas ISO do live usam America/Sao_Paulo no front", () => {
  assert.match(script, /const dateKeyFromIso = \(value\) =>/);
  assert.match(script, /new Intl\.DateTimeFormat\("en-CA", \{ timeZone: "America\/Sao_Paulo" \}\)\.format\(date\)/);
  assert.match(script, /const minutesFromIso = \(value\) =>/);
  assert.match(script, /timeZone: "America\/Sao_Paulo",/);
});
