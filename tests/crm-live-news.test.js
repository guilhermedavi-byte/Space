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
  assert.match(personalBestCopy({ ...base, actualValue: 10 }).headline, /^Faltam 8 reuniões/);
  assert.match(personalBestCopy({ ...base, actualValue: 17 }).headline, /igualou/);
  assert.match(personalBestCopy({ ...base, actualValue: 19 }).headline, /superou.*2 reuniões/);
  assert.match(personalBestCopy({ ...base, actualValue: 18 }).headline, /em 1 reunião\./);
  assert.match(personalBestCopy({ ...base, actualValue: 0 }).headline, /^Faltam 18/);
  assert.match(personalBestCopy({}).context, /não há uma marca anterior/);
});

test('all eligible people reach the carousel, with stable IDs and no duplicates', () => {
  const rows = [0, 17, 19, 10].map((actualValue, i) => ({ personId: String(i), displayName: 'Nome longo '.repeat(8) + i, targetValue: 30, actualValue, photoURL: '' }));
  const weeklyRollups = [{ peopleProgress: { sdrs: rows.map(r => ({ personId: r.personId, actualValue: 17 })) } }];
  const news = buildWeeklyNewsScreens({ weekly: { sdrs: [...rows, rows[0], { personId: 'no-history', targetValue: 30 }] }, weeklyRollups });
  assert.equal(news.length, 4);
  assert.equal(new Set(news.map(n => n.personId)).size, 4);
  assert.ok(news.every(n => n.photoURL === '' && n.personName.length > 60));
  assert.deepEqual(buildWeeklyNewsScreens({ weekly: { sdrs: rows.slice().reverse() }, weeklyRollups }), news);
  assert.equal(buildWeeklyNewsScreens({ weekly: { sdrs: rows.slice(0, 1) }, weeklyRollups }).length, 1);
  const tied = buildWeeklyNewsScreens({ weekly: { sdrs: rows.map(r => ({ ...r, actualValue: 17 })) }, weeklyRollups });
  assert.equal(tied.length, 4);
  assert.ok(tied.every(item => item.headline.includes('igualou')));
  assert.deepEqual(buildWeeklyNewsScreens({ weekly: { sdrs: rows }, weeklyRollups: [] }), []);
  let tick;
  const visited = new Set();
  const loop = createLiveTvLoopController({ setIntervalFn: fn => { tick = fn; return 1; }, clearIntervalFn() {}, onScreenChange: s => visited.add(s.activeKey) });
  loop.setPayload({ news });
  for (let i = 0; i < 10; i++) tick();
  news.forEach((_, i) => assert.ok(visited.has('news_' + i)));
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
