const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const script = fs.readFileSync(path.join(__dirname, "..", "script.js"), "utf8");

test("efetivação de cancelamento usa writeBatch para aluno e cascata Firestore", () => {
  const saveStart = script.indexOf("const saveAdminStudentLifecyclePatch");
  const saveEnd = script.indexOf("const archiveStudentCancellationRecord", saveStart);
  assert.notEqual(saveStart, -1);
  assert.notEqual(saveEnd, -1);
  const saveBody = script.slice(saveStart, saveEnd);

  assert.match(saveBody, /firebase\.writeBatch\(firebase\.primaryDb\)/);
  assert.match(saveBody, /batch\.update\(studentRef, cleanPatch\)/);
  assert.match(saveBody, /cascade\(\{ firebase, batch, studentRef, studentId: id, beforeData \}\)/);
  assert.match(saveBody, /batch\.commit\(\)/);
  assert.ok(saveBody.indexOf("batch.update(studentRef, cleanPatch)") < saveBody.indexOf("batch.commit()"));
});

test("sync Supabase acontece somente depois da confirmação Firestore", () => {
  const saveStart = script.indexOf("const saveAdminStudentLifecyclePatch");
  const saveEnd = script.indexOf("const archiveStudentCancellationRecord", saveStart);
  const saveBody = script.slice(saveStart, saveEnd);

  assert.match(saveBody, /requestAdminStudentMirrorSync\(\{ firestoreDocId: id, context: "student_lifecycle_patch" \}\)/);
  assert.ok(saveBody.indexOf("batch.commit()") < saveBody.indexOf("requestAdminStudentMirrorSync"));
});

