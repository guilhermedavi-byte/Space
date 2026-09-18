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

const { buildWeeklyNewsScreens } = require('../api/_lib/crm-live');
const { personalBestCopy, sdrRankingPages } = require('../api/_lib/crm-live-presentation');
const { createLiveTvLoopController } = require('../api/_lib/live-tv-rotation');

test('record copy distinguishes beating, tying and surpassing, including singular and zero', () => {
  const base = { personName: 'Pessoa Teste', historicalBest: 17 };
  assert.match(personalBestCopy({ ...base, actualValue: 10 }).headline, /^Faltam 8 agendamentos/);
  assert.match(personalBestCopy({ ...base, actualValue: 17 }).headline, /igualou/);
  assert.match(personalBestCopy({ ...base, actualValue: 19 }).headline, /superou.*2 agendamentos/);
  assert.match(personalBestCopy({ ...base, actualValue: 18 }).headline, /em 1 agendamento\./);
  assert.match(personalBestCopy({ ...base, actualValue: 0 }).headline, /^Faltam 18/);
  assert.match(personalBestCopy({}).context, /não há uma marca anterior/);
});

test('legacy weekly news no longer emits multiple personal record slides', () => {
  const news = buildWeeklyNewsScreens({ weekly: { sdrs: [{ personId: 'a', targetValue: 20, actualValue: 1 }] }, weeklyRollups: [{ peopleProgress: { sdrs: [{ personId: 'a', actualValue: 8 }] } }] });
  assert.equal(news.filter(row => row.type === 'personal_best').length, 0);
});

test('SDR pagination preserves every row, order, values and global offsets', () => {
  const rows = Array.from({ length: 11 }, (_, i) => ({ personId: String(i), progressPct: i ? 250 : 0, displayName: 'Nome longo '.repeat(10) }));
  const pages = sdrRankingPages(rows);
  assert.deepEqual(pages.map(p => p.rows.length), [4, 4, 3]);
  assert.deepEqual(pages.map(p => p.offset), [0, 4, 8]);
  assert.deepEqual(pages.map(p => p.key), ['sdrs', 'sdrs_1', 'sdrs_2']);
  assert.deepEqual(pages.flatMap(p => p.rows), rows);
  assert.equal(sdrRankingPages([]).length, 1);
});
