const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  resolvePeriodRange,
  summarizeActivityEvents,
  summarizeDailyRows,
  normalizeActivityEvent,
} = require("../api/_lib/admin-commercial-sdr-activity");

test("resolvePeriodRange monta hoje, semana e mês em São Paulo", () => {
  const base = new Date("2026-07-29T12:00:00-03:00");
  assert.deepEqual(resolvePeriodRange({ period: "today", now: base }), {
    period: "today",
    fromKey: "2026-07-29",
    toKey: "2026-07-29",
    todayKey: "2026-07-29",
  });
  assert.deepEqual(resolvePeriodRange({ period: "week", now: base }), {
    period: "week",
    fromKey: "2026-07-23",
    toKey: "2026-07-29",
    todayKey: "2026-07-29",
  });
  assert.deepEqual(resolvePeriodRange({ period: "month", now: base }), {
    period: "month",
    fromKey: "2026-06-30",
    toKey: "2026-07-29",
    todayKey: "2026-07-29",
  });
});

test("summarizeDailyRows recalcula taxas a partir dos totais agregados", () => {
  const summary = summarizeDailyRows([
    { totalCalls: 10, answered: 4, scheduled: 2, shows: 1, noShows: 1, totalMeetings: 2, double: 0 },
    { totalCalls: 20, answered: 10, scheduled: 5, shows: 2, noShows: 0, totalMeetings: 2, double: 1 },
  ]);
  assert.equal(summary.totalCalls, 30);
  assert.equal(summary.answered, 14);
  assert.equal(summary.scheduled, 7);
  assert.equal(summary.shows, 3);
  assert.equal(summary.noShows, 1);
  assert.equal(summary.totalMeetings, 4);
  assert.equal(summary.answerRate, (14 / 30) * 100);
  assert.equal(summary.scheduleRate, (7 / 14) * 100);
  assert.equal(summary.callToScheduleRate, (7 / 30) * 100);
  assert.equal(summary.showRate, (3 / 7) * 100);
});

test("Agendado para Feito usa eventos históricos e preserva agendamentos", () => {
  const rows = [
    ...Array.from({ length: 10 }, (_, index) => ({ id: `scheduled-${index}`, eventType: "call", outcome: "agendou" })),
    ...Array.from({ length: 5 }, (_, index) => ({ id: `show-${index}`, eventType: "meeting", outcome: "show" })),
    ...Array.from({ length: 2 }, (_, index) => ({ id: `noshow-${index}`, eventType: "meeting", outcome: "noshow" })),
  ];
  const summary = summarizeActivityEvents(rows);
  assert.equal(summary.scheduled, 10);
  assert.equal(summary.shows, 5);
  assert.equal(summary.noShows, 2);
  assert.equal(summary.showRate, 50);
});

test("Agendado para Feito retorna zero sem agendamentos", () => {
  const summary = summarizeActivityEvents([{ id: "show-only", eventType: "meeting", outcome: "show" }]);
  assert.equal(summary.scheduled, 0);
  assert.equal(summary.shows, 1);
  assert.equal(summary.showRate, 0);
});

test("Pré-Vendas renderiza reuniões feitas e conversão total e por SDR", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "script.js"), "utf8");
  const activitySource = fs.readFileSync(path.join(__dirname, "..", "api", "_lib", "admin-commercial-sdr-activity.js"), "utf8");
  assert.match(source, /label: "Reuniões feitas",[\s\S]*value: summary\.shows/);
  assert.match(source, /label: "Agendado → Feito",[\s\S]*value: formatCommercialSdrActivityPct\(summary\.showRate/);
  assert.match(source, /String\(Number\(row\.shows \|\| 0\)\)/);
  assert.match(source, /formatCommercialSdrActivityPct\(row\.showRate \|\| 0\)/);
  assert.match(source, /\["scheduled", "shows", "showRate", "callToScheduleRate", "totalCalls"\]/);
  assert.match(activitySource, /filterByRange\(normalizedEvents, range\.fromKey, range\.toKey, \(row\) => row\.dateKey\)/);
});

test("normalizeActivityEvent ignora deletados e marca horário local do evento", () => {
  assert.equal(
    normalizeActivityEvent({
      id: "x",
      sdrUid: "u1",
      dateKey: "2026-07-29",
      eventType: "call",
      outcome: "agendou",
      deletedAt: "2026-07-29T10:00:00Z",
    }),
    null
  );
  const event = normalizeActivityEvent({
    id: "y",
    sdrUid: "u1",
    sdrName: "SDR Teste",
    sdrEmail: "sdr@example.com",
    dateKey: "2026-07-29",
    eventType: "call",
    outcome: "agendou",
    time: "2026-07-29T17:15:00.000Z",
    createdAt: "2026-07-29T17:15:00.000Z",
    source: "manual_day",
  });
  assert.equal(event.localDateKey, "2026-07-29");
  assert.equal(event.localTime, "14:15");
  assert.equal(event.source, "manual_day");
});
