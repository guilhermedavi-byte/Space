const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const script = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');
const scheduleEventsApi = fs.readFileSync(path.join(__dirname, '..', 'api', 'schedule-events.js'), 'utf8');

test('agenda do admin expõe os 4 tipos especiais e exige professor responsável', () => {
  assert.match(script, /const SPECIAL_EVENT_KIND_OPTIONS = \[/);
  assert.match(script, /\["experimental", "Aula Experimental"\]/);
  assert.match(script, /\["onboarding", "Onboarding de Aluno"\]/);
  assert.match(script, /\["coordenacao", "Reunião com Coordenação"\]/);
  assert.match(script, /\["outro", "Outro"\]/);
  assert.match(script, /data-ce-special-kind/);
  assert.match(script, /Professor responsável/);
  assert.match(script, /const requiresAdminTeacher = currentRole === "admin"/);
  assert.match(script, /data-ce-admin-student-combobox/);
  assert.match(script, /data-ce-admin-teacher-combobox/);
  assert.match(script, /setAdminEventUserPickerOpen\("student", false\)/);
  assert.match(script, /setAdminEventUserPickerOpen\("teacher", false\)/);
  assert.doesNotMatch(script, /<span>Convidados<\/span>/);
  assert.doesNotMatch(script, /data-ce-guest-search/);
});

test('eventos experimentais e onboarding usam registro pedagógico simplificado', () => {
  assert.match(script, /const PEDAGOGICO_SPECIAL_STATUS_OPTIONS = \[/);
  assert.match(script, /label: "Ocorreu"/);
  assert.match(script, /label: "Não ocorreu"/);
  assert.match(script, /renderPedagogicoSpecialStatusControl\(status\)/);
  assert.match(script, /getPedagogicoDynamicFieldsHtml\(status, pedagogicoDraft, safeLesson\)/);
  assert.match(script, /Esse tipo de evento aceita apenas “Ocorreu” ou “Não ocorreu”/);
  assert.match(script, /motivo_falta: "nao_informado"/);
  assert.match(script, /conteudo_aula: "Evento especial realizado"/);
});

test('horas-aula incluem especiais de aula e presença exclui todos os tipoEvento especiais', () => {
  assert.match(script, /const getTeacherDashboardLessonCreditedMinutes = \(lesson, logsByEventId\) =>/);
  assert.match(script, /const shouldIncludeLessonInTeacherPresence = \(lesson\) =>/);
  assert.match(script, /return shouldCountLessonKindInPresence\(lesson\.tipoEvento \|\| ""\)/);
  assert.match(script, /const presencePastMonth = pastMonth\.filter\(\(evt\) => shouldIncludeLessonInTeacherPresence\(evt\)\)/);
  assert.match(script, /\.filter\(\(evt\) => shouldIncludeLessonInTeacherPresence\(evt\)\)\.length/);
});

test('api de schedule-events persiste tipoEvento no documento da agenda', () => {
  assert.match(scheduleEventsApi, /const tipoEvento = String\(body\?\.tipoEvento \|\| ""\)\.trim\(\)/);
  assert.match(scheduleEventsApi, /tipoEvento: tipoEvento \|\| null/);
  assert.match(scheduleEventsApi, /tipo_evento: data\.tipoEvento \|\| null/);
  assert.match(scheduleEventsApi, /const requestedEventType = String\(body\?\.eventType \|\| ""\)\.trim\(\)\.toLowerCase\(\)/);
});

test('api legada de lesson-logs não persiste mais statusAula operacional no Firestore', () => {
  assert.match(scheduleEventsApi, /const statusAula = normalizeStatusAula\(body\?\.statusAula\)/);
  assert.doesNotMatch(scheduleEventsApi, /statusAula,\n\s*\/\/ Realizada/);
});
