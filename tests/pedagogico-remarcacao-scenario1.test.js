const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const script = fs.readFileSync(path.join(__dirname, "..", "script.js"), "utf8");

test("professor cria payload de reposição com vínculo para aula Firestore", () => {
  assert.match(script, /const buildPedagogicoReplacementEventPayload = \(\{ lesson, draft, sessionUser: activeSessionUser \} = \{\}\) =>/);
  assert.match(script, /originEventId: String\(sourceLesson\.id \|\| sourceLesson\.eventId \|\| ""\)\.trim\(\)/);
  assert.match(script, /originLessonId: String\(sourceLesson\.supabaseLessonId \|\| sourceLesson\.liveLessonId \|\| sourceLesson\.id \|\| ""\)\.trim\(\)/);
});

test("professor cria ou atualiza reposição também para aula Supabase live", () => {
  assert.match(script, /if \(!autosave && draft\.statusAula === "remarcada"\)/);
  assert.doesNotMatch(script, /!isSupabaseLesson &&\s*draft\.statusAula === "remarcada"/);
  assert.match(script, /method: existingReplacement\?\.id \? "PUT" : "POST"/);
});

test("evento de reposição entra no estado local com vínculo de origem", () => {
  assert.match(script, /originEventId: createPayload\.originEventId/);
  assert.match(script, /originLessonId: createPayload\.originLessonId/);
  assert.match(script, /pedagogicoState\.lessons = \[\.\.\.others, replacementRow\]\.sort/);
});
