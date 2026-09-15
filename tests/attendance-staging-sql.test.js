const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHarness } = require('./helpers/attendance-postgres');
const { assertObjects } = require('../scripts/attendance-staging');

test('inventário e verificação pós-apply executam em PostgreSQL real isolado', {
  skip: process.env.RUN_ATTENDANCE_SQL_INTEGRATION !== '1', timeout: 90000,
}, async () => {
  const harness = await createHarness();
  try {
    const sql = fs.readFileSync(path.join(__dirname, '../scripts/attendance-schema-inventory.sql'), 'utf8');
    const before = harness.sql(sql);
    assertObjects(before);
    const inventory = JSON.parse(before);
    assert.ok(inventory.constraints.length > 40);
    assert.equal(inventory.functions.filter((f) => f.name.startsWith('attendance_')).length, 12);
    assert.equal(inventory.triggers.length, 2);
    assert.equal(before, harness.sql(sql), 'snapshot estável sem alterações de schema');
  } finally { harness.cleanup(); }
});
