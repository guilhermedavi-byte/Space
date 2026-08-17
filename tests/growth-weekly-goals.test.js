const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveCommercialWeek } = require('../api/_lib/commercial-week');
const { buildWeeklyGoalsReadModel, decodeWeeklyGoalsMap } = require('../api/_lib/growth-people');
const { buildWeeklyTeamSummary } = require('../api/_lib/crm-live');

const PERSON_IDS = {
  matheus: 'matheus-afonso',
  luis: 'luis-eduardo',
  luana: 'luana-mendonca',
  ayres: 'ayres-andre',
  felipe: 'felipe-santos',
  outros: 'outros',
};

const makeGoal = (peopleConfig, teamTarget = 120000, extra = {}) => ({
  weeklyGoals: decodeWeeklyGoalsMap({
    'wk_2026-08-11': {
      startDateKey: '2026-08-11',
      endDateKey: '2026-08-18',
      teamTarget,
      individualMonthlyGoals: peopleConfig,
      ...extra,
    },
  }),
});

const canonicalDefaultPeople = {
  [PERSON_IDS.matheus]: { role: 'closer', targetValue: 8000 },
  [PERSON_IDS.luis]: { role: 'closer', targetValue: 8000 },
  [PERSON_IDS.outros]: { role: 'closer', targetValue: 4000 },
  [PERSON_IDS.luana]: { role: 'sdr', targetValue: 30 },
  [PERSON_IDS.felipe]: { role: 'sdr', targetValue: 30 },
  [PERSON_IDS.ayres]: { role: 'sdr', targetValue: 40 },
};

const baseGoal = makeGoal({
  [PERSON_IDS.matheus]: { role: 'closer', targetValue: 50000 },
  [PERSON_IDS.luana]: { role: 'sdr', targetValue: 8 },
});

const people = [
  {
    personId: PERSON_IDS.matheus,
    displayName: 'Matheus Afonso',
    active: true,
    roles: ['closer'],
    crmAttendantIds: ['crm-uuid-matheus'],
    crmAttendantAliases: ['Matheus Afonso | Space'],
    sdrEmails: [],
  },
  {
    personId: PERSON_IDS.luana,
    displayName: 'Luana Mendonça',
    active: true,
    roles: ['sdr'],
    crmAttendantIds: ['crm-uuid-luana'],
    crmAttendantAliases: [],
    sdrEmails: ['luana@space.test'],
  },
  {
    personId: PERSON_IDS.luis,
    displayName: 'Luis Eduardo',
    active: true,
    roles: ['closer'],
    crmAttendantIds: [],
    crmAttendantAliases: ['Luis Eduardo | Space'],
    sdrEmails: [],
  },
  {
    personId: PERSON_IDS.outros,
    displayName: 'Outros',
    active: true,
    isAggregate: true,
    sortOrder: 999,
    roles: ['closer'],
    crmAttendantIds: [],
    crmAttendantAliases: [],
    sdrEmails: [],
  },
  {
    personId: PERSON_IDS.ayres,
    displayName: 'Ayres André',
    active: true,
    roles: ['sdr'],
    crmAttendantIds: [],
    crmAttendantAliases: [],
    sdrEmails: ['ayres@space.test'],
  },
  {
    personId: PERSON_IDS.felipe,
    displayName: 'Felipe Santos',
    active: true,
    roles: ['sdr'],
    crmAttendantIds: [],
    crmAttendantAliases: [],
    sdrEmails: ['felipe@space.test'],
  },
];

test('resolveCommercialWeek respeita a semana especial inicial', () => {
  const week = resolveCommercialWeek({ now: new Date('2026-08-11T10:00:00-03:00') });
  assert.deepEqual(week, {
    weekKey: 'wk_2026-08-11',
    startDateKey: '2026-08-11',
    endDateKey: '2026-08-18',
    nowDateKey: '2026-08-11',
    isSpecial: true,
  });
});

test('resolveCommercialWeek usa quarta-terça após 19/08/2026', () => {
  const week = resolveCommercialWeek({ now: new Date('2026-08-20T10:00:00-03:00') });
  assert.deepEqual(week, {
    weekKey: 'wk_2026-08-19',
    startDateKey: '2026-08-19',
    endDateKey: '2026-08-25',
    nowDateKey: '2026-08-20',
    isSpecial: false,
  });
});

test('weekly read model usa attendantId como chave principal para o closer da semana', () => {
  const payload = buildWeeklyGoalsReadModel({
    goal: baseGoal,
    people,
    businesses: [
      {
        id: 'biz_1',
        total: 12000,
        lastMovedAt: '2026-08-12T14:00:00.000Z',
        attendantId: 'crm-uuid-matheus',
        attendant: { name: 'Matheus Afonso | Space' },
        stage: { name: 'Fechado', pipeline: { name: 'Conversão' } },
      },
    ],
    sdrEvents: [],
    now: new Date('2026-08-12T12:00:00-03:00'),
  });

  assert.equal(payload.commercialWeek.weekKey, 'wk_2026-08-11');
  assert.equal(payload.progress.closers.length, 1);
  assert.equal(payload.progress.closers[0].personId, PERSON_IDS.matheus);
  assert.equal(payload.progress.closers[0].role, 'closer');
  assert.equal(payload.progress.closers[0].actualValue, 12000);
  assert.equal(payload.progress.closers[0].targetValue, 50000);
  assert.equal(payload.progress.closers[0].displayName, 'Matheus Afonso');
});

test('weekly read model usa fallback por alias e expõe attendantId não reconhecido', () => {
  const payload = buildWeeklyGoalsReadModel({
    goal: makeGoal({
      [PERSON_IDS.luis]: { role: 'closer', targetValue: 10000 },
    }),
    people,
    businesses: [
      {
        id: 'biz_alias',
        total: 8000,
        lastMovedAt: '2026-08-12T16:00:00.000Z',
        attendant: { name: 'Luis Eduardo | Space' },
        stage: { name: 'Fechado', pipeline: { name: 'Conversão' } },
      },
      {
        id: 'biz_unknown',
        total: 4500,
        lastMovedAt: '2026-08-12T18:00:00.000Z',
        attendantId: 'crm-uuid-desconhecido',
        attendant: { name: 'Pessoa Desconhecida' },
        stage: { name: 'Fechado', pipeline: { name: 'Conversão' } },
      },
    ],
    sdrEvents: [],
    now: new Date('2026-08-12T12:00:00-03:00'),
  });

  assert.equal(payload.progress.closers[0].personId, PERSON_IDS.luis);
  assert.equal(payload.progress.closers[0].actualValue, 8000);
  assert.equal(payload.unresolved.crmAttendantIds.length, 1);
  assert.equal(payload.unresolved.crmAttendantIds[0].crmAttendantId, 'crm-uuid-desconhecido');
  assert.equal(payload.unresolved.crmAttendantIds[0].count, 1);
  assert.equal(payload.unresolved.crmAttendantIds[0].revenue, 4500);
});

test('weekly read model agrega attendant não cadastrado em Outros e mantém unresolved para diagnóstico', () => {
  const payload = buildWeeklyGoalsReadModel({
    goal: makeGoal({
      [PERSON_IDS.matheus]: { role: 'closer', targetValue: 8000 },
      [PERSON_IDS.luis]: { role: 'closer', targetValue: 8000 },
      [PERSON_IDS.outros]: { role: 'closer', targetValue: 4000 },
    }, 20000),
    people,
    businesses: [
      {
        id: 'biz_unknown_to_outros',
        total: 4500,
        lastMovedAt: '2026-08-12T18:00:00.000Z',
        attendantId: 'crm-uuid-desconhecido',
        attendant: { name: 'Pessoa Desconhecida' },
        stage: { name: 'Fechado', pipeline: { name: 'Conversão' } },
      },
    ],
    sdrEvents: [],
    now: new Date('2026-08-12T12:00:00-03:00'),
  });

  const outros = payload.progress.closers.find((row) => row.personId === PERSON_IDS.outros);
  assert.equal(outros?.actualValue, 4500);
  assert.equal(outros?.count, 1);
  assert.equal(payload.unresolved.crmAttendantIds.length, 1);
});

test('weekly read model agrega receita de pessoa com role SDR em Outros', () => {
  const payload = buildWeeklyGoalsReadModel({
    goal: makeGoal({
      [PERSON_IDS.matheus]: { role: 'closer', targetValue: 8000 },
      [PERSON_IDS.luis]: { role: 'closer', targetValue: 8000 },
      [PERSON_IDS.outros]: { role: 'closer', targetValue: 4000 },
    }, 20000),
    people,
    businesses: [
      {
        id: 'biz_sdr_closing',
        total: 3000,
        lastMovedAt: '2026-08-12T14:00:00.000Z',
        attendantId: 'crm-uuid-luana',
        attendant: { name: 'Luana Mendonça' },
        stage: { name: 'Fechado', pipeline: { name: 'Conversão' } },
      },
    ],
    sdrEvents: [],
    now: new Date('2026-08-12T12:00:00-03:00'),
  });

  const outros = payload.progress.closers.find((row) => row.personId === PERSON_IDS.outros);
  assert.equal(outros?.actualValue, 3000);
  assert.equal(outros?.breakdown?.[0]?.resolvedPersonId, PERSON_IDS.luana);
});

test('weekly read model agrega attendantId nulo em Outros', () => {
  const payload = buildWeeklyGoalsReadModel({
    goal: makeGoal({
      [PERSON_IDS.matheus]: { role: 'closer', targetValue: 8000 },
      [PERSON_IDS.luis]: { role: 'closer', targetValue: 8000 },
      [PERSON_IDS.outros]: { role: 'closer', targetValue: 4000 },
    }, 20000),
    people,
    businesses: [
      {
        id: 'biz_missing_attendant',
        total: 1500,
        lastMovedAt: '2026-08-12T14:00:00.000Z',
        attendant: { name: '' },
        stage: { name: 'Fechado', pipeline: { name: 'Conversão' } },
      },
    ],
    sdrEvents: [],
    now: new Date('2026-08-12T12:00:00-03:00'),
  });

  const outros = payload.progress.closers.find((row) => row.personId === PERSON_IDS.outros);
  assert.equal(outros?.actualValue, 1500);
  assert.equal(payload.unresolved.crmAttendantIds[0]?.crmAttendantId, '');
});

test('weekly read model expõe unresolved mesmo sem weeklyGoal cadastrado', () => {
  const payload = buildWeeklyGoalsReadModel({
    goal: { weeklyGoals: {} },
    people: [],
    businesses: [
      {
        id: 'biz_no_goal',
        total: 3200,
        lastMovedAt: '2026-08-12T13:00:00.000Z',
        attendantId: 'crm-uuid-sem-cadastro',
        attendant: { name: 'Closer Sem Cadastro' },
        stage: { name: 'Fechado', pipeline: { name: 'Conversão' } },
      },
    ],
    sdrEvents: [],
    now: new Date('2026-08-12T12:00:00-03:00'),
  });

  assert.equal(payload.weeklyGoal, null);
  assert.equal(payload.unresolved.crmAttendantIds.length, 1);
  assert.equal(payload.unresolved.crmAttendantIds[0].crmAttendantId, 'crm-uuid-sem-cadastro');
});

test('ranking de closers ordena Outros no meio por percentual', () => {
  const payload = buildWeeklyGoalsReadModel({
    goal: makeGoal({
      [PERSON_IDS.matheus]: { role: 'closer', targetValue: 8000 },
      [PERSON_IDS.luis]: { role: 'closer', targetValue: 8000 },
      [PERSON_IDS.outros]: { role: 'closer', targetValue: 4000 },
    }, 20000),
    people,
    businesses: [
      {
        id: 'biz_matheus',
        total: 7000,
        lastMovedAt: '2026-08-12T12:00:00.000Z',
        attendantId: 'crm-uuid-matheus',
        attendant: { name: 'Matheus Afonso | Space' },
        stage: { name: 'Fechado', pipeline: { name: 'Conversão' } },
      },
      {
        id: 'biz_luis',
        total: 2000,
        lastMovedAt: '2026-08-12T13:00:00.000Z',
        attendant: { name: 'Luis Eduardo | Space' },
        stage: { name: 'Fechado', pipeline: { name: 'Conversão' } },
      },
      {
        id: 'biz_unknown_mid',
        total: 3000,
        lastMovedAt: '2026-08-12T14:00:00.000Z',
        attendantId: 'crm-uuid-desconhecido',
        attendant: { name: 'Pessoa Desconhecida' },
        stage: { name: 'Fechado', pipeline: { name: 'Conversão' } },
      },
    ],
    sdrEvents: [],
    now: new Date('2026-08-12T12:00:00-03:00'),
  });

  assert.deepEqual(payload.progress.closers.map((row) => row.personId), [PERSON_IDS.matheus, PERSON_IDS.outros, PERSON_IDS.luis]);
});

test('ranking de closers ordena Outros no topo por percentual', () => {
  const payload = buildWeeklyGoalsReadModel({
    goal: makeGoal({
      [PERSON_IDS.matheus]: { role: 'closer', targetValue: 8000 },
      [PERSON_IDS.luis]: { role: 'closer', targetValue: 8000 },
      [PERSON_IDS.outros]: { role: 'closer', targetValue: 4000 },
    }, 20000),
    people,
    businesses: [
      {
        id: 'biz_matheus_top',
        total: 6000,
        lastMovedAt: '2026-08-12T12:00:00.000Z',
        attendantId: 'crm-uuid-matheus',
        attendant: { name: 'Matheus Afonso | Space' },
        stage: { name: 'Fechado', pipeline: { name: 'Conversão' } },
      },
      {
        id: 'biz_luis_top',
        total: 2000,
        lastMovedAt: '2026-08-12T13:00:00.000Z',
        attendant: { name: 'Luis Eduardo | Space' },
        stage: { name: 'Fechado', pipeline: { name: 'Conversão' } },
      },
      {
        id: 'biz_unknown_top',
        total: 3500,
        lastMovedAt: '2026-08-12T14:00:00.000Z',
        attendantId: 'crm-uuid-desconhecido',
        attendant: { name: 'Pessoa Desconhecida' },
        stage: { name: 'Fechado', pipeline: { name: 'Conversão' } },
      },
    ],
    sdrEvents: [],
    now: new Date('2026-08-12T12:00:00-03:00'),
  });

  assert.deepEqual(payload.progress.closers.map((row) => row.personId), [PERSON_IDS.outros, PERSON_IDS.matheus, PERSON_IDS.luis]);
});

test('weekly read model conta reunião feita do SDR por show em sdrActivityEvents', () => {
  const payload = buildWeeklyGoalsReadModel({
    goal: baseGoal,
    people,
    businesses: [],
    sdrEvents: [
      { dateKey: '2026-08-12', eventType: 'meeting', outcome: 'show', sdrEmail: 'luana@space.test' },
      { dateKey: '2026-08-12', eventType: 'meeting', outcome: 'noshow', sdrEmail: 'luana@space.test' },
      { dateKey: '2026-08-12', eventType: 'call', outcome: 'agendou', sdrEmail: 'luana@space.test' },
      { dateKey: '2026-08-19', eventType: 'meeting', outcome: 'show', sdrEmail: 'luana@space.test' },
    ],
    now: new Date('2026-08-12T12:00:00-03:00'),
  });

  assert.equal(payload.progress.sdrs.length, 1);
  assert.equal(payload.progress.sdrs[0].personId, PERSON_IDS.luana);
  assert.equal(payload.progress.sdrs[0].actualValue, 1);
  assert.equal(payload.progress.sdrs[0].targetValue, 8);
  assert.equal(payload.progress.sdrs[0].role, 'sdr');
});

test('weekly read model expõe sdrUid e email não reconhecidos em unresolved.sdrActors', () => {
  const payload = buildWeeklyGoalsReadModel({
    goal: { weeklyGoals: {} },
    people: [
      {
        personId: PERSON_IDS.luana,
        displayName: 'Luana Mendonça',
        active: true,
        roles: ['sdr'],
        crmAttendantIds: [],
        crmAttendantAliases: [],
        sdrEmails: ['luana@space.test'],
      },
    ],
    businesses: [],
    sdrEvents: [
      { dateKey: '2026-08-12', eventType: 'meeting', outcome: 'show', sdrUid: 'uid-nao-mapeado', sdrEmail: 'nao.mapeado@space.test', sdrName: 'SDR Sem Cadastro' },
      { dateKey: '2026-08-12', eventType: 'call', outcome: 'atendeu', sdrUid: 'uid-nao-mapeado', sdrEmail: 'nao.mapeado@space.test', sdrName: 'SDR Sem Cadastro' },
      { dateKey: '2026-08-12', eventType: 'meeting', outcome: 'show', sdrUid: 'uid-mapeado', sdrEmail: 'luana@space.test', sdrName: 'Luana Mendonça' },
    ],
    now: new Date('2026-08-12T12:00:00-03:00'),
  });

  assert.equal(payload.unresolved.sdrActors.length, 1);
  assert.equal(payload.unresolved.sdrActors[0].sdrUid, 'uid-nao-mapeado');
  assert.equal(payload.unresolved.sdrActors[0].sdrEmail, 'nao.mapeado@space.test');
  assert.equal(payload.unresolved.sdrActors[0].meetingShows, 1);
  assert.equal(payload.unresolved.sdrActors[0].calls, 1);
});

test('meta semanal do time de closers usa 20000 independente da soma individual', () => {
  const weeklyReadModel = buildWeeklyGoalsReadModel({
    goal: makeGoal({
      [PERSON_IDS.matheus]: { role: 'closer', targetValue: 8000 },
      [PERSON_IDS.luis]: { role: 'closer', targetValue: 8000 },
      [PERSON_IDS.outros]: { role: 'closer', targetValue: 4000 },
    }, 20000),
    people,
    businesses: [],
    sdrEvents: [],
    now: new Date('2026-08-12T12:00:00-03:00'),
  });

  const team = buildWeeklyTeamSummary({ weeklyReadModel });
  assert.equal(team.closers.targetValue, 20000);
});

test('meta semanal do time de closers cai para a soma das linhas quando teamTarget está ausente', () => {
  const weeklyReadModel = buildWeeklyGoalsReadModel({
    goal: makeGoal({
      [PERSON_IDS.matheus]: { role: 'closer', targetValue: 8000 },
      [PERSON_IDS.luis]: { role: 'closer', targetValue: 8000 },
    }, 0),
    people,
    businesses: [],
    sdrEvents: [],
    now: new Date('2026-08-12T12:00:00-03:00'),
  });

  assert.equal(weeklyReadModel.weeklyGoal?.teamTarget, 0);
  const team = buildWeeklyTeamSummary({ weeklyReadModel });
  assert.equal(team.closers.targetValue, 16000);
});

test('weekly read model usa default da competência quando a semana não está preenchida', () => {
  const weeklyReadModel = buildWeeklyGoalsReadModel({
    goal: {
      defaultWeeklyConfig: {
        teamTarget: 20000,
        individualMonthlyGoals: canonicalDefaultPeople,
      },
      weeklyGoals: {},
    },
    people,
    businesses: [],
    sdrEvents: [],
    now: new Date('2026-08-12T12:00:00-03:00'),
  });

  assert.equal(weeklyReadModel.weeklyGoalConfigSource, 'competencia');
  assert.deepEqual(weeklyReadModel.progress.closers.map((row) => row.personId), [PERSON_IDS.matheus, PERSON_IDS.luis, PERSON_IDS.outros]);
  assert.equal(weeklyReadModel.weeklyGoal?.teamTarget, 20000);
  assert.deepEqual(weeklyReadModel.progress.sdrs.map((row) => [row.personId, row.targetValue]), [
    [PERSON_IDS.luana, 30],
    [PERSON_IDS.felipe, 30],
    [PERSON_IDS.ayres, 40],
  ]);
});

test('weekly read model faz merge campo a campo entre semana e default da competência', () => {
  const weeklyReadModel = buildWeeklyGoalsReadModel({
    goal: {
      defaultWeeklyConfig: {
        teamTarget: 20000,
        individualMonthlyGoals: canonicalDefaultPeople,
      },
      weeklyGoals: decodeWeeklyGoalsMap({
        'wk_2026-08-11': {
          individualMonthlyGoals: {
            [PERSON_IDS.matheus]: { role: 'closer', targetValue: 9000 },
            [PERSON_IDS.luis]: { role: 'closer', targetValue: 8000 },
          },
        },
      }),
    },
    people,
    businesses: [],
    sdrEvents: [],
    now: new Date('2026-08-12T12:00:00-03:00'),
  });

  assert.equal(weeklyReadModel.weeklyGoalConfigSource, 'mixed');
  assert.deepEqual(weeklyReadModel.weeklyGoalConfigSourceDetails, { teamTarget: 'competencia', people: 'week' });
  assert.equal(weeklyReadModel.weeklyGoal?.teamTarget, 20000);
  assert.deepEqual(
    weeklyReadModel.progress.closers.map((row) => [row.personId, row.targetValue]),
    [
      [PERSON_IDS.matheus, 9000],
      [PERSON_IDS.luis, 8000],
      [PERSON_IDS.outros, 4000],
    ]
  );
  assert.deepEqual(
    weeklyReadModel.progress.sdrs.map((row) => [row.personId, row.targetValue]),
    [
      [PERSON_IDS.luana, 30],
      [PERSON_IDS.felipe, 30],
      [PERSON_IDS.ayres, 40],
    ]
  );
});

test('weekly read model permite excluir pessoa do default por flag explícita na semana', () => {
  const weeklyReadModel = buildWeeklyGoalsReadModel({
    goal: {
      defaultWeeklyConfig: {
        teamTarget: 20000,
        individualMonthlyGoals: canonicalDefaultPeople,
      },
      weeklyGoals: decodeWeeklyGoalsMap({
        'wk_2026-08-11': {
          individualMonthlyGoals: {
            [PERSON_IDS.outros]: { excluded: true },
          },
        },
      }),
    },
    people,
    businesses: [],
    sdrEvents: [],
    now: new Date('2026-08-12T12:00:00-03:00'),
  });

  assert.equal(weeklyReadModel.weeklyGoalConfigSource, 'mixed');
  assert.deepEqual(weeklyReadModel.weeklyGoalConfigSourceDetails, { teamTarget: 'competencia', people: 'week' });
  assert.deepEqual(weeklyReadModel.progress.closers.map((row) => row.personId), [PERSON_IDS.matheus, PERSON_IDS.luis]);
});

test('weekly read model usa default global quando competência e semana não estão preenchidas', () => {
  const weeklyReadModel = buildWeeklyGoalsReadModel({
    goal: { weeklyGoals: {} },
    globalConfig: {
      defaultWeeklyConfig: {
        teamTarget: 20000,
        individualMonthlyGoals: canonicalDefaultPeople,
      },
    },
    people,
    businesses: [],
    sdrEvents: [],
    now: new Date('2026-08-12T12:00:00-03:00'),
  });

  assert.equal(weeklyReadModel.weeklyGoalConfigSource, 'global');
  assert.deepEqual(weeklyReadModel.progress.closers.map((row) => row.personId), [PERSON_IDS.matheus, PERSON_IDS.luis, PERSON_IDS.outros]);
  assert.equal(weeklyReadModel.weeklyGoal?.teamTarget, 20000);
  assert.deepEqual(weeklyReadModel.progress.sdrs.map((row) => [row.personId, row.targetValue]), [
    [PERSON_IDS.luana, 30],
    [PERSON_IDS.felipe, 30],
    [PERSON_IDS.ayres, 40],
  ]);
});

test('defaultWeeklyConfig canônico referencia apenas personIds existentes em growthPeople', () => {
  const personIds = new Set(people.map((person) => String(person.personId || '')));
  const missing = Object.keys(canonicalDefaultPeople).filter((personId) => !personIds.has(personId));
  assert.deepEqual(missing, []);
});
