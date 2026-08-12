const test = require('node:test');
const assert = require('node:assert/strict');

const { decorateLeaderboardComparisons, buildWeeklyNewsScreens } = require('../api/_lib/crm-live');

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

test('tela de vendas para assumir liderança usa ticket médio real e arredonda para cima', () => {
  const news = buildWeeklyNewsScreens({
    month: { summary: { ticketMedio: 1200 } },
    weekly: {
      team: {
        closers: { actualValue: 5300, targetValue: 16000, progressPct: 33.125 },
        sdrs: { actualValue: 0, targetValue: 0, progressPct: 0 },
      },
      commercialWeek: { weekKey: 'wk_2026-08-11', startDateKey: '2026-08-11', endDateKey: '2026-08-18' },
      closers: [
        {
          personId: 'luis',
          displayName: 'Luis Eduardo',
          targetValue: 8000,
          actualValue: 3200,
          progressPct: 40,
          leaderPressureFromName: 'Matheus Afonso',
          leaderPressureUnits: 2700,
        },
        {
          personId: 'matheus',
          displayName: 'Matheus Afonso',
          targetValue: 8000,
          actualValue: 530,
          progressPct: 6.625,
          missingToLead: 2700,
        },
      ],
      sdrs: [],
    },
    previousMonthComparison: null,
    weeklyRollups: [],
    now: new Date('2026-08-12T15:00:00.000Z'),
  });

  const screen = news.find((item) => item.type === 'sales_to_lead');
  assert.ok(screen);
  assert.equal(screen.salesNeeded, 3);
});
