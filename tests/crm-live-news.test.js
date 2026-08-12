const test = require('node:test');
const assert = require('node:assert/strict');

const { decorateLeaderboardComparisons } = require('../api/_lib/crm-live');

test('ranking SDR calcula ultrapassagem por percentual da meta, não por diferença bruta', () => {
  const rows = decorateLeaderboardComparisons({
    rows: [
      { personId: 'felipe', displayName: 'Felipe Santos', targetValue: 30, actualValue: 7 },
      { personId: 'ayres', displayName: 'Ayres André', targetValue: 40, actualValue: 6 },
    ],
    discrete: true,
  });

  assert.equal(Number(rows[0].progressPct.toFixed(1)), 23.3);
  assert.equal(Number(rows[1].progressPct.toFixed(1)), 15.0);
  assert.equal(rows[0].leaderPressureUnits, 4);
  assert.equal(rows[1].missingToLead, 4);
});
