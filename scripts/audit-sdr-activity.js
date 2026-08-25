#!/usr/bin/env node

const { listCollectionAsAdmin } = require("../api/_lib/firestore-admin");

const ACTIVITY_COLLECTION = "sdrActivityEvents";
const USERS_COLLECTION = "users";
const MODULE_START_DATE_KEY = "2026-07-20";
const LOOKBACK_DAYS = 60;
const DUPLICATE_SECOND_WINDOW_MS = 1000;
const DUPLICATE_SUSPICIOUS_WINDOW_MS = 5000;

const normalizeRole = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "admin" || raw === "administrador") return "admin";
  if (raw === "growth") return "growth";
  return raw;
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = { json: false, now: new Date(), lookbackDays: LOOKBACK_DAYS };
  for (let index = 0; index < args.length; index += 1) {
    const arg = String(args[index] || "");
    if (arg === "--json") options.json = true;
    if (arg.startsWith("--now=")) options.now = new Date(arg.slice("--now=".length));
    if (arg.startsWith("--lookback-days=")) options.lookbackDays = Math.max(1, Number(arg.slice("--lookback-days=".length)) || LOOKBACK_DAYS);
  }
  return options;
};

const getSaoPauloDateKey = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const read = (type) => parts.find((part) => part.type === type)?.value || "";
  return `${read("year")}-${read("month")}-${read("day")}`;
};

const addDays = (dateKey, offset) => {
  const date = new Date(`${dateKey}T12:00:00-03:00`);
  date.setDate(date.getDate() + Number(offset || 0));
  return getSaoPauloDateKey(date);
};

const enumerateDateKeys = ({ from, to }) => {
  const rows = [];
  let cursor = from;
  while (cursor <= to) {
    rows.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return rows;
};

const safeDate = (value) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const normalizeEvent = (row = {}) => ({
  firestoreDocId: String(row.firestoreDocId || row.id || "").trim(),
  id: String(row.id || row.firestoreDocId || "").trim(),
  clientRequestId: String(row.clientRequestId || "").trim(),
  sdrUid: String(row.sdrUid || "").trim(),
  sdrEmail: String(row.sdrEmail || "").trim().toLowerCase(),
  sdrName: String(row.sdrName || "").trim(),
  dateKey: String(row.dateKey || "").trim(),
  eventType: String(row.eventType || "").trim(),
  outcome: String(row.outcome || "").trim(),
  time: String(row.time || "").trim(),
  createdAt: String(row.createdAt || "").trim(),
  source: String(row.source || "").trim(),
  deletedAt: String(row.deletedAt || "").trim(),
  raw: row,
});

const findOwnerKey = (event) => String(event.sdrUid || event.sdrEmail || "missing_owner").trim();

const main = async () => {
  const options = parseArgs();
  const todayKey = getSaoPauloDateKey(options.now);
  const fromKey = addDays(todayKey, -(options.lookbackDays - 1));
  const calendar = enumerateDateKeys({ from: fromKey, to: todayKey });

  const [eventRows, userRows] = await Promise.all([
    listCollectionAsAdmin(ACTIVITY_COLLECTION, { pageSize: 1000 }),
    listCollectionAsAdmin(USERS_COLLECTION, { pageSize: 1000 }),
  ]);

  const growthUsers = userRows
    .filter((row) => normalizeRole(row?.tipo || row?.role || row?.type) === "growth")
    .map((row) => ({
      uid: String(row?.firestoreDocId || row?.id || row?.uid || "").trim(),
      email: String(row?.email || "").trim().toLowerCase(),
      nome: String(row?.nome || row?.name || row?.displayName || row?.email || "SDR").trim(),
      ativo: row?.ativo !== false,
    }))
    .filter((row) => row.uid || row.email);

  const peopleByKey = new Map();
  growthUsers.forEach((user) => {
    if (user.uid) peopleByKey.set(user.uid, user);
    if (user.email) peopleByKey.set(user.email, user);
  });

  const events = eventRows.map(normalizeEvent);
  const validTypes = new Set(["call", "meeting"]);
  const validOutcomesByType = {
    call: new Set(["nao_atendeu", "atendeu", "agendou", "double"]),
    meeting: new Set(["show", "noshow"]),
  };

  const invalidEvents = [];
  const futureEvents = [];
  const preModuleEvents = [];
  const activeEvents = [];
  let latestEvent = null;

  events.forEach((event) => {
    const ownerKey = findOwnerKey(event);
    const eventDate = safeDate(event.createdAt || event.time);
    const inferredDateKey = eventDate ? getSaoPauloDateKey(eventDate) : "";
    const ownerKnown = Boolean((event.sdrUid && peopleByKey.has(event.sdrUid)) || (event.sdrEmail && peopleByKey.has(event.sdrEmail)));
    const hasInvalidShape =
      !event.id || !event.eventType || !event.outcome || !event.dateKey || (!event.sdrUid && !event.sdrEmail) || !validTypes.has(event.eventType) || !validOutcomesByType[event.eventType]?.has(event.outcome);
    if (hasInvalidShape || !ownerKnown) {
      invalidEvents.push({
        id: event.id,
        sdrUid: event.sdrUid,
        sdrEmail: event.sdrEmail,
        dateKey: event.dateKey,
        inferredDateKey,
        eventType: event.eventType,
        outcome: event.outcome,
        deletedAt: event.deletedAt,
        reason: [
          !event.id ? "missing_id" : "",
          !event.dateKey ? "missing_dateKey" : "",
          !event.eventType ? "missing_eventType" : "",
          event.eventType && !validTypes.has(event.eventType) ? "unknown_eventType" : "",
          !event.outcome ? "missing_outcome" : "",
          event.eventType && event.outcome && !validOutcomesByType[event.eventType]?.has(event.outcome) ? "invalid_outcome" : "",
          !event.sdrUid && !event.sdrEmail ? "missing_owner" : "",
          !ownerKnown ? "unknown_owner" : "",
        ].filter(Boolean),
      });
    }
    if (event.dateKey && event.dateKey > todayKey) futureEvents.push(event);
    if (event.dateKey && event.dateKey < MODULE_START_DATE_KEY) preModuleEvents.push(event);
    if (!event.deletedAt) activeEvents.push(event);
    if (!latestEvent || String(event.createdAt || event.time || "") > String(latestEvent.createdAt || latestEvent.time || "")) {
      latestEvent = event;
    }
  });

  const totalsBySdrByDay = {};
  const holesBySdr = {};
  growthUsers.forEach((user) => {
    const key = user.uid || user.email;
    totalsBySdrByDay[key] = { sdrUid: user.uid, sdrEmail: user.email, sdrName: user.nome, days: {} };
    calendar.forEach((dateKey) => {
      totalsBySdrByDay[key].days[dateKey] = { totalEvents: 0, calls: 0, meetings: 0, nao_atendeu: 0, atendeu: 0, agendou: 0, show: 0, noshow: 0 };
    });
  });

  activeEvents.forEach((event) => {
    if (!event.dateKey || event.dateKey < fromKey || event.dateKey > todayKey) return;
    const key = event.sdrUid && totalsBySdrByDay[event.sdrUid] ? event.sdrUid : event.sdrEmail && totalsBySdrByDay[event.sdrEmail] ? event.sdrEmail : "";
    if (!key) return;
    const bucket = totalsBySdrByDay[key].days[event.dateKey];
    if (!bucket) return;
    bucket.totalEvents += 1;
    if (event.eventType === "call") bucket.calls += 1;
    if (event.eventType === "meeting") bucket.meetings += 1;
    if (bucket[event.outcome] !== undefined) bucket[event.outcome] += 1;
  });

  Object.entries(totalsBySdrByDay).forEach(([key, row]) => {
    holesBySdr[key] = {
      sdrUid: row.sdrUid,
      sdrEmail: row.sdrEmail,
      sdrName: row.sdrName,
      missingDateKeys: calendar.filter((dateKey) => Number(row.days?.[dateKey]?.totalEvents || 0) === 0),
    };
  });

  const duplicateGroups = new Map();
  const suspiciousGroups = new Map();
  activeEvents
    .slice()
    .sort((a, b) => String(a.createdAt || a.time || "").localeCompare(String(b.createdAt || b.time || "")))
    .forEach((event) => {
      const timestamp = safeDate(event.createdAt || event.time);
      if (!timestamp) return;
      const secondKey = new Date(Math.floor(timestamp.getTime() / 1000) * 1000).toISOString();
      const dedupeKey = [event.sdrUid || event.sdrEmail, event.eventType, event.outcome, secondKey].join("::");
      const secondBucket = duplicateGroups.get(dedupeKey) || [];
      secondBucket.push({ id: event.id, clientRequestId: event.clientRequestId, createdAt: event.createdAt || event.time, dateKey: event.dateKey });
      duplicateGroups.set(dedupeKey, secondBucket);

      const suspiciousKey = [event.sdrUid || event.sdrEmail, event.eventType, event.outcome, event.dateKey].join("::");
      const suspiciousBucket = suspiciousGroups.get(suspiciousKey) || [];
      suspiciousBucket.push({ ...event, _ts: timestamp.getTime() });
      suspiciousGroups.set(suspiciousKey, suspiciousBucket);
    });

  const duplicatesSameSecond = Array.from(duplicateGroups.entries())
    .filter(([, rows]) => rows.length > 1)
    .map(([key, rows]) => ({ key, count: rows.length, rows }));

  const suspiciousCloseRepeats = [];
  suspiciousGroups.forEach((rows, key) => {
    const sorted = rows.slice().sort((a, b) => a._ts - b._ts);
    for (let index = 1; index < sorted.length; index += 1) {
      const gapMs = sorted[index]._ts - sorted[index - 1]._ts;
      if (gapMs <= DUPLICATE_SUSPICIOUS_WINDOW_MS) {
        suspiciousCloseRepeats.push({
          key,
          gapMs,
          previous: {
            id: sorted[index - 1].id,
            clientRequestId: sorted[index - 1].clientRequestId,
            createdAt: sorted[index - 1].createdAt || sorted[index - 1].time,
          },
          current: {
            id: sorted[index].id,
            clientRequestId: sorted[index].clientRequestId,
            createdAt: sorted[index].createdAt || sorted[index].time,
          },
        });
      }
    }
  });

  const report = {
    generatedAt: new Date().toISOString(),
    timezone: "America/Sao_Paulo",
    moduleStartDateKey: MODULE_START_DATE_KEY,
    lookback: { fromKey, toKey: todayKey, days: options.lookbackDays },
    totalsBySdrByDay,
    holesBySdr,
    anomalies: {
      invalidEvents,
      futureEvents: futureEvents.map((event) => ({ id: event.id, sdrUid: event.sdrUid, sdrEmail: event.sdrEmail, dateKey: event.dateKey, createdAt: event.createdAt || event.time })),
      preModuleEvents: preModuleEvents.map((event) => ({ id: event.id, sdrUid: event.sdrUid, sdrEmail: event.sdrEmail, dateKey: event.dateKey, createdAt: event.createdAt || event.time })),
    },
    duplicates: {
      sameSecondThresholdMs: DUPLICATE_SECOND_WINDOW_MS,
      suspiciousWindowMs: DUPLICATE_SUSPICIOUS_WINDOW_MS,
      sameSecond: duplicatesSameSecond,
      suspiciousCloseRepeats,
    },
    latestEvent: latestEvent
      ? {
          id: latestEvent.id,
          clientRequestId: latestEvent.clientRequestId,
          sdrUid: latestEvent.sdrUid,
          sdrEmail: latestEvent.sdrEmail,
          sdrName: latestEvent.sdrName,
          dateKey: latestEvent.dateKey,
          eventType: latestEvent.eventType,
          outcome: latestEvent.outcome,
          createdAt: latestEvent.createdAt || latestEvent.time,
          deletedAt: latestEvent.deletedAt || "",
        }
      : null,
    totals: {
      allDocuments: events.length,
      activeDocuments: activeEvents.length,
      invalidDocuments: invalidEvents.length,
      futureDocuments: futureEvents.length,
      preModuleDocuments: preModuleEvents.length,
      duplicateSameSecondGroups: duplicatesSameSecond.length,
      suspiciousCloseRepeatPairs: suspiciousCloseRepeats.length,
    },
  };

  if (options.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }

  const lines = [];
  lines.push(`SDR audit generated at ${report.generatedAt}`);
  lines.push(`Window: ${fromKey} → ${todayKey} (${options.lookbackDays} dias)`);
  lines.push(`Documents: ${report.totals.activeDocuments} ativos / ${report.totals.allDocuments} totais`);
  lines.push(`Invalid: ${report.totals.invalidDocuments} · Future: ${report.totals.futureDocuments} · Pre-module: ${report.totals.preModuleDocuments}`);
  lines.push(`Duplicate groups (same second): ${report.totals.duplicateSameSecondGroups}`);
  lines.push(`Suspicious close repeats (<=${DUPLICATE_SUSPICIOUS_WINDOW_MS}ms): ${report.totals.suspiciousCloseRepeatPairs}`);
  if (report.latestEvent) {
    lines.push(`Latest: ${report.latestEvent.createdAt} · ${report.latestEvent.sdrName || report.latestEvent.sdrEmail || report.latestEvent.sdrUid} · ${report.latestEvent.eventType}/${report.latestEvent.outcome}`);
  }
  Object.values(report.holesBySdr).forEach((row) => {
    lines.push(`Hole count · ${row.sdrName}: ${row.missingDateKeys.length}`);
  });
  process.stdout.write(`${lines.join("\n")}\n`);
};

main().catch((error) => {
  console.error("[audit-sdr-activity] failed", error?.message || error);
  process.exitCode = 1;
});
