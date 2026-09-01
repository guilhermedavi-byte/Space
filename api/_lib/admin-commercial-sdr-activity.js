const { listCollectionAsAdmin, queryCollectionByDateRangeAsAdmin } = require("./firestore-admin");

const ACTIVITY_COLLECTION = "sdrActivityEvents";
const TIME_ZONE = "America/Sao_Paulo";
const VALID_CALL_OUTCOMES = new Set(["nao_atendeu", "atendeu", "agendou", "double"]);
const VALID_MEETING_OUTCOMES = new Set(["show", "noshow"]);

const safeString = (value) => (value == null ? "" : String(value).trim());

const normalizeRole = (value) => {
  const raw = safeString(value).toLowerCase();
  if (raw === "growth") return "growth";
  if (raw === "admin" || raw === "administrador") return "admin";
  return "";
};

const saoPauloDateKey = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
};

const parseDateKey = (value) => {
  const raw = safeString(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : "";
};

const addDaysToKey = (dateKey, offset) => {
  const safeDateKey = parseDateKey(dateKey) || saoPauloDateKey();
  const date = new Date(`${safeDateKey}T12:00:00-03:00`);
  date.setDate(date.getDate() + Number(offset || 0));
  return saoPauloDateKey(date);
};

const countRangeDaysInclusive = (fromKey, toKey) => {
  const from = parseDateKey(fromKey);
  const to = parseDateKey(toKey);
  if (!from || !to) return 1;
  const fromDate = new Date(`${from}T12:00:00-03:00`);
  const toDate = new Date(`${to}T12:00:00-03:00`);
  const diff = Math.round((toDate.getTime() - fromDate.getTime()) / 86_400_000);
  return Math.max(1, diff + 1);
};

const formatLocalDateTimeParts = (isoString) => {
  const raw = safeString(isoString);
  if (!raw) return { dateKey: "", time: "" };
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return { dateKey: "", time: "" };
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("sv-SE", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
  return {
    dateKey: `${parts.year || ""}-${parts.month || ""}-${parts.day || ""}`.replace(/^--$/, ""),
    time: `${parts.hour || ""}:${parts.minute || ""}`.replace(/^:$/, ""),
  };
};

const normalizeGrowthUser = (row = {}) => {
  const role = normalizeRole(row?.tipo || row?.role || row?.type);
  if (role !== "growth") return null;
  const uid = safeString(row?.firestoreDocId || row?.id || row?.uid);
  if (!uid) return null;
  return {
    uid,
    nome: safeString(row?.nome || row?.name || row?.displayName || row?.email) || "SDR",
    email: safeString(row?.email).toLowerCase(),
    ativo: row?.ativo !== false,
  };
};

const normalizeActivityEvent = (row = {}) => {
  const id = safeString(row?.firestoreDocId || row?.id);
  const sdrUid = safeString(row?.sdrUid);
  const dateKey = parseDateKey(row?.dateKey);
  const eventType = safeString(row?.eventType);
  const outcome = safeString(row?.outcome);
  if (!id || !sdrUid || !dateKey || row?.deletedAt) return null;
  if (eventType === "call" && !VALID_CALL_OUTCOMES.has(outcome)) return null;
  if (eventType === "meeting" && !VALID_MEETING_OUTCOMES.has(outcome)) return null;
  const local = formatLocalDateTimeParts(row?.time || row?.createdAt);
  return {
    id,
    firestoreDocId: safeString(row?.firestoreDocId),
    sdrUid,
    sdrName: safeString(row?.sdrName) || "SDR",
    sdrEmail: safeString(row?.sdrEmail).toLowerCase(),
    dateKey,
    eventType,
    outcome,
    time: safeString(row?.time),
    createdAt: safeString(row?.createdAt),
    source: safeString(row?.source) || "sdr_panel",
    localDateKey: local.dateKey || dateKey,
    localTime: local.time,
  };
};

const summarizeDailyRows = (rows = []) => {
  const base = (Array.isArray(rows) ? rows : []).reduce(
    (acc, row) => {
      acc.totalCalls += Math.max(0, Number(row?.totalCalls || 0));
      acc.answered += Math.max(0, Number(row?.answered || 0));
      acc.scheduled += Math.max(0, Number(row?.scheduled || 0));
      acc.double += Math.max(0, Number(row?.double || 0));
      acc.shows += Math.max(0, Number(row?.shows || 0));
      acc.noShows += Math.max(0, Number(row?.noShows || 0));
      acc.totalMeetings += Math.max(0, Number(row?.totalMeetings || 0));
      return acc;
    },
    { totalCalls: 0, answered: 0, scheduled: 0, double: 0, shows: 0, noShows: 0, totalMeetings: 0 }
  );
  return {
    ...base,
    answerRate: base.totalCalls ? (base.answered / base.totalCalls) * 100 : 0,
    scheduleRate: base.answered ? (base.scheduled / base.answered) * 100 : 0,
    callToScheduleRate: base.totalCalls ? (base.scheduled / base.totalCalls) * 100 : 0,
    showRate: base.scheduled ? (base.shows / base.scheduled) * 100 : 0,
  };
};

const summarizeActivityEvents = (rows = []) => {
  const base = (Array.isArray(rows) ? rows : []).reduce(
    (acc, row) => {
      const type = safeString(row?.eventType);
      const outcome = safeString(row?.outcome);
      if (type === "call") {
        acc.totalCalls += 1;
        if (outcome === "atendeu" || outcome === "agendou" || outcome === "double") acc.answered += 1;
        if (outcome === "agendou" || outcome === "double") {
          acc.scheduled += 1;
          if (outcome === "double") acc.double += 1;
        }
      }
      if (type === "meeting") {
        acc.totalMeetings += 1;
        if (outcome === "show") acc.shows += 1;
        if (outcome === "noshow") acc.noShows += 1;
      }
      return acc;
    },
    { totalCalls: 0, answered: 0, scheduled: 0, double: 0, shows: 0, noShows: 0, totalMeetings: 0 }
  );
  return summarizeDailyRows([base]);
};

const resolvePeriodRange = ({ period = "today", from = "", to = "", now = new Date() } = {}) => {
  const todayKey = saoPauloDateKey(now);
  const normalized = ["today", "week", "month", "custom"].includes(safeString(period)) ? safeString(period) : "today";
  if (normalized === "custom") {
    const fromKey = parseDateKey(from);
    const toKey = parseDateKey(to);
    if (fromKey && toKey && fromKey <= toKey) return { period: normalized, fromKey, toKey, todayKey };
    return { period: normalized, fromKey: todayKey, toKey: todayKey, todayKey };
  }
  if (normalized === "week") return { period: normalized, fromKey: addDaysToKey(todayKey, -6), toKey: todayKey, todayKey };
  if (normalized === "month") return { period: normalized, fromKey: addDaysToKey(todayKey, -29), toKey: todayKey, todayKey };
  return { period: "today", fromKey: todayKey, toKey: todayKey, todayKey };
};

const resolvePreviousRange = ({ period = "today", fromKey = "", toKey = "", todayKey = "" } = {}) => {
  const normalizedPeriod = ["today", "week", "month", "custom"].includes(safeString(period)) ? safeString(period) : "today";
  const safeFrom = parseDateKey(fromKey) || parseDateKey(todayKey) || saoPauloDateKey();
  const safeTo = parseDateKey(toKey) || safeFrom;
  if (normalizedPeriod === "today") {
    const prevKey = addDaysToKey(safeFrom, -1);
    return { period: normalizedPeriod, fromKey: prevKey, toKey: prevKey };
  }
  if (normalizedPeriod === "week") {
    return { period: normalizedPeriod, fromKey: addDaysToKey(safeFrom, -7), toKey: addDaysToKey(safeTo, -7) };
  }
  if (normalizedPeriod === "month") {
    return { period: normalizedPeriod, fromKey: addDaysToKey(safeFrom, -30), toKey: addDaysToKey(safeTo, -30) };
  }
  const span = countRangeDaysInclusive(safeFrom, safeTo);
  const previousTo = addDaysToKey(safeFrom, -1);
  const previousFrom = addDaysToKey(previousTo, -(span - 1));
  return { period: normalizedPeriod, fromKey: previousFrom, toKey: previousTo };
};

const filterByRange = (rows, fromKey, toKey, getKey) =>
  (Array.isArray(rows) ? rows : []).filter((row) => {
    const key = parseDateKey(getKey(row));
    return key && key >= fromKey && key <= toKey;
  });

const compareEventsDesc = (a, b) => {
  const dateA = safeString(a?.localDateKey || a?.dateKey);
  const dateB = safeString(b?.localDateKey || b?.dateKey);
  if (dateA !== dateB) return dateB.localeCompare(dateA);
  const timeA = safeString(a?.localTime);
  const timeB = safeString(b?.localTime);
  if (timeA !== timeB) return timeB.localeCompare(timeA);
  return safeString(b?.createdAt || b?.time).localeCompare(safeString(a?.createdAt || a?.time));
};

const loadAdminCommercialSdrActivity = async ({ period = "today", from = "", to = "" } = {}) => {
  const range = resolvePeriodRange({ period, from, to });
  const previousRange = resolvePreviousRange(range);
  const combinedFromKey = previousRange.fromKey < range.fromKey ? previousRange.fromKey : range.fromKey;
  const combinedToKey = previousRange.toKey > range.toKey ? previousRange.toKey : range.toKey;
  const [userRows, eventRows] = await Promise.all([
    listCollectionAsAdmin("users", { pageSize: 1000 }),
    queryCollectionByDateRangeAsAdmin(ACTIVITY_COLLECTION, {
      dateField: "dateKey",
      from: combinedFromKey,
      to: combinedToKey,
    }).catch(() => []),
  ]);
  const users = userRows.map(normalizeGrowthUser).filter(Boolean);
  const usersByUid = new Map(users.map((user) => [user.uid, user]));
  const knownUids = new Set(users.map((user) => user.uid));
  const normalizedEvents = eventRows.map(normalizeActivityEvent).filter((row) => row && knownUids.has(row.sdrUid));
  const events = filterByRange(normalizedEvents, range.fromKey, range.toKey, (row) => row.localDateKey || row.dateKey);
  const previousEvents = filterByRange(normalizedEvents, previousRange.fromKey, previousRange.toKey, (row) => row.localDateKey || row.dateKey);

  const summaries = users
    .map((user) => {
      const safeUid = safeString(user?.uid);
      const matchedUser = usersByUid.get(safeUid) || {};
      const rows = events.filter((row) => row.sdrUid === safeUid);
      const summary = summarizeActivityEvents(rows);
      return {
        sdrUid: safeUid,
        sdrName: safeString(matchedUser.nome || rows[0]?.sdrName) || "SDR",
        sdrEmail: safeString(matchedUser.email || rows[0]?.sdrEmail).toLowerCase(),
        ativo: matchedUser.ativo !== false,
        ...summary,
      };
    })
    .sort(
      (a, b) =>
        Number(b.scheduled || 0) - Number(a.scheduled || 0) ||
        Number(b.totalCalls || 0) - Number(a.totalCalls || 0) ||
        safeString(a.sdrName).localeCompare(safeString(b.sdrName), "pt-BR")
    );

  const enrichedEvents = events
    .map((event) => ({
      ...event,
      sdrName: safeString(usersByUid.get(event.sdrUid)?.nome || event.sdrName) || "SDR",
      sdrEmail: safeString(usersByUid.get(event.sdrUid)?.email || event.sdrEmail).toLowerCase(),
      isRetroactive: safeString(event.source) === "manual_day",
    }))
    .sort(compareEventsDesc);

  return {
    ok: true,
    filters: range,
    summary: summarizeActivityEvents(events),
    previousSummary: summarizeActivityEvents(previousEvents),
    previousFilters: previousRange,
    sdrs: summaries,
    events: enrichedEvents,
    sourceTotals: {
      users: users.length,
      dailyRows: 0,
      eventRows: enrichedEvents.length,
    },
  };
};

module.exports = {
  ACTIVITY_COLLECTION,
  addDaysToKey,
  loadAdminCommercialSdrActivity,
  normalizeActivityEvent,
  resolvePeriodRange,
  resolvePreviousRange,
  summarizeActivityEvents,
  summarizeDailyRows,
};
