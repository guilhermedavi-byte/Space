const test = require("node:test");
const assert = require("node:assert/strict");

const { buildCollisionGroups } = require("../api/_lib/pedagogico-reconciliation");

test("buildCollisionGroups separa órfãos singulares de grupos em colisão", () => {
  const result = buildCollisionGroups([
    { lessonId: "1", studentId: "a", teacherId: "t", dateKey: "2026-07-27", startTime: "10:00", endTime: "10:30" },
    { lessonId: "2", studentId: "a", teacherId: "t", dateKey: "2026-07-27", startTime: "10:00", endTime: "10:30" },
    { lessonId: "3", studentId: "b", teacherId: "u", dateKey: "2026-07-27", startTime: "11:00", endTime: "11:30" },
  ]);

  assert.equal(result.collisionGroups.length, 1);
  assert.equal(result.collisionRowCount, 2);
  assert.deepEqual(result.collisionGroups[0].rows.map((row) => row.lessonId), ["1", "2"]);
  assert.deepEqual(result.unmatchedRows.map((row) => row.lessonId), ["3"]);
});
