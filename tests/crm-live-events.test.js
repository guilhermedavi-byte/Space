const test = require("node:test");
const assert = require("node:assert/strict");

const { buildCrmLiveEventQueue } = require("../api/_lib/crm-live");

const makeWeeklyReadModel = () => ({
  commercialWeek: { weekKey: "wk_2026-08-11", startDateKey: "2026-08-11", endDateKey: "2026-08-18" },
  weeklyGoal: { teamTarget: 20000 },
  people: [
    { personId: "matheus", displayName: "Matheus Afonso", roles: ["closer"], active: true, crmAttendantIds: [], crmAttendantAliases: ["Matheus Afonso"], sdrEmails: [] },
    { personId: "luis", displayName: "Luis Eduardo", roles: ["closer"], active: true, crmAttendantIds: [], crmAttendantAliases: ["Luis Eduardo"], sdrEmails: [] },
    { personId: "outros", displayName: "Outros", roles: ["closer"], active: true, isAggregate: true, crmAttendantIds: [], crmAttendantAliases: [], sdrEmails: [] },
    { personId: "luana", displayName: "Luana Mendonça", roles: ["sdr"], active: true, crmAttendantIds: [], crmAttendantAliases: [], sdrEmails: [] },
    { personId: "ayres", displayName: "Ayres André", roles: ["sdr"], active: true, crmAttendantIds: [], crmAttendantAliases: [], sdrEmails: [] },
  ],
  progress: {
    closers: [
      { personId: "matheus", displayName: "Matheus Afonso", role: "closer", actualValue: 8100, targetValue: 8000, progressPct: 101.25 },
      { personId: "luis", displayName: "Luis Eduardo", role: "closer", actualValue: 6200, targetValue: 8000, progressPct: 77.5 },
      { personId: "outros", displayName: "Outros", role: "closer", actualValue: 0, targetValue: 4000, progressPct: 0, isAggregate: true },
    ],
    sdrs: [
      { personId: "luana", displayName: "Luana Mendonça", role: "sdr", actualValue: 31, targetValue: 30, progressPct: 103.33 },
      { personId: "ayres", displayName: "Ayres André", role: "sdr", actualValue: 22, targetValue: 40, progressPct: 55 },
    ],
  },
});

const makeTeamSummary = () => ({
  closers: { actualValue: 14300, targetValue: 20000, progressPct: 71.5 },
  sdrs: { actualValue: 61, targetValue: 100, progressPct: 61 },
});

const makeBusiness = ({ id, movedAt, total = 2500, client = "Cliente", plan = "Gold", closer = "Matheus Afonso" }) => ({
  id,
  status: "won",
  total,
  lastMovedAt: movedAt,
  attendant: { name: closer },
  lead: { name: client },
  products: [{ product: { name: plan } }],
});

test("detector em partida a frio só semeia cursor e não dispara eventos", () => {
  const result = buildCrmLiveEventQueue({
    previousState: null,
    weeklyReadModel: makeWeeklyReadModel(),
    weekTeamSummary: makeTeamSummary(),
    freshWonBusinesses: [
      makeBusiness({ id: "deal_1", movedAt: "2026-08-12T13:00:00.000Z" }),
      makeBusiness({ id: "deal_2", movedAt: "2026-08-12T13:30:00.000Z" }),
    ],
    monthSummary: { summary: { gap: 12000 } },
    now: new Date("2026-08-12T14:00:00.000Z"),
  });

  assert.equal(result.coldStart, true);
  assert.deepEqual(result.events, []);
  assert.equal(result.nextState.cursor, "2026-08-12T13:30:00.000Z");
  assert.equal(result.nextState.currentWeek.weekKey, "wk_2026-08-11");
  assert.deepEqual(result.nextState.currentWeek.teamMetasHit, []);
  assert.deepEqual(result.nextState.currentWeek.metaIndividualsHit.sort(), ["luana", "matheus"]);
});

test("detector enfileira venda, meta individual, virada e meta do time em ordem estável", () => {
  const previousState = {
    cursor: "2026-08-12T12:00:00.000Z",
    initializedAt: "2026-08-12T12:00:00.000Z",
    updatedAt: "2026-08-12T12:00:00.000Z",
    lastLeaders: { closers: "luis", sdrs: "ayres" },
    currentWeek: {
      weekKey: "wk_2026-08-11",
      metaIndividualsHit: [],
      teamMetasHit: [],
    },
    announcedSaleIds: [],
  };
  const weeklyReadModel = makeWeeklyReadModel();
  const team = {
    closers: { actualValue: 16050, targetValue: 16000, progressPct: 100.31 },
    sdrs: { actualValue: 61, targetValue: 100, progressPct: 61 },
  };
  const result = buildCrmLiveEventQueue({
    previousState,
    weeklyReadModel,
    weekTeamSummary: team,
    freshWonBusinesses: [makeBusiness({ id: "deal_3", movedAt: "2026-08-12T12:10:00.000Z", total: 3200, client: "Ana Paula" })],
    monthSummary: { summary: { gap: 8000 } },
    now: new Date("2026-08-12T12:11:00.000Z"),
  });

  assert.equal(result.coldStart, false);
  assert.deepEqual(
    result.events.map((event) => event.type),
    ["sale_closed", "individual_goal_hit", "individual_goal_hit", "leader_changed", "leader_changed", "team_goal_hit"]
  );
  assert.equal(result.events[0].payload.clientName, "Ana Paula");
  assert.equal(result.events[0].payload.weekGap, 0);
  assert.deepEqual(result.nextState.currentWeek.metaIndividualsHit.sort(), ["luana", "matheus"]);
  assert.deepEqual(result.nextState.currentWeek.teamMetasHit, ["closers"]);
  assert.equal(result.nextState.lastLeaders.closers, "matheus");
  assert.equal(result.nextState.lastLeaders.sdrs, "luana");
  assert.ok(result.nextState.announcedSaleIds.includes("deal_3"));
});

test("troca de semana reseta metas e líderes sem disparar falso positivo", () => {
  const previousState = {
    cursor: "2026-08-18T22:00:00.000Z",
    initializedAt: "2026-08-12T12:00:00.000Z",
    updatedAt: "2026-08-18T22:00:00.000Z",
    lastLeaders: { closers: "matheus", sdrs: "luana" },
    currentWeek: {
      weekKey: "wk_2026-08-11",
      metaIndividualsHit: ["matheus", "luana"],
      teamMetasHit: ["closers"],
    },
    announcedSaleIds: ["deal_old"],
  };
  const weeklyReadModel = {
    commercialWeek: { weekKey: "wk_2026-08-19", startDateKey: "2026-08-19", endDateKey: "2026-08-25" },
    progress: {
      closers: [{ personId: "luis", displayName: "Luis Eduardo", role: "closer", actualValue: 0, targetValue: 8000, progressPct: 0 }],
      sdrs: [{ personId: "ayres", displayName: "Ayres André", role: "sdr", actualValue: 0, targetValue: 40, progressPct: 0 }],
    },
  };
  const result = buildCrmLiveEventQueue({
    previousState,
    weeklyReadModel,
    weekTeamSummary: {
      closers: { actualValue: 0, targetValue: 16000, progressPct: 0 },
      sdrs: { actualValue: 0, targetValue: 100, progressPct: 0 },
    },
    freshWonBusinesses: [],
    monthSummary: { summary: { gap: 12000 } },
    now: new Date("2026-08-19T10:00:00.000Z"),
  });

  assert.equal(result.weekRolled, true);
  assert.deepEqual(result.events, []);
  assert.equal(result.nextState.currentWeek.weekKey, "wk_2026-08-19");
  assert.deepEqual(result.nextState.currentWeek.metaIndividualsHit, []);
  assert.deepEqual(result.nextState.currentWeek.teamMetasHit, []);
  assert.equal(result.nextState.lastLeaders.closers, "luis");
  assert.equal(result.nextState.lastLeaders.sdrs, "ayres");
});

test("sale_closed anuncia Outros para vendedor fora de Matheus e Luis", () => {
  const previousState = {
    cursor: "2026-08-12T12:00:00.000Z",
    initializedAt: "2026-08-12T12:00:00.000Z",
    updatedAt: "2026-08-12T12:00:00.000Z",
    lastLeaders: { closers: "matheus", sdrs: "luana" },
    currentWeek: {
      weekKey: "wk_2026-08-11",
      metaIndividualsHit: [],
      teamMetasHit: [],
    },
    announcedSaleIds: [],
  };

  const result = buildCrmLiveEventQueue({
    previousState,
    weeklyReadModel: makeWeeklyReadModel(),
    weekTeamSummary: makeTeamSummary(),
    freshWonBusinesses: [
      makeBusiness({
        id: "deal_outros",
        movedAt: "2026-08-12T12:10:00.000Z",
        total: 2800,
        client: "Cliente Outros",
        closer: "Fábio Camargo",
      }),
    ],
    monthSummary: { summary: { gap: 8000 } },
    now: new Date("2026-08-12T12:11:00.000Z"),
  });

  assert.equal(result.events[0].type, "sale_closed");
  assert.equal(result.events[0].payload.closerName, "Outros");
  assert.equal(result.events[0].payload.isAggregate, true);
});
