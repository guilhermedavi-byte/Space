const crypto = require("crypto");

const { readJsonBody, sendJson } = require("../_lib/http");
const { resolveAdminRequestAuth } = require("./_lib/admin-request-auth");
const { commitWritesAsAdmin, listCollectionAsAdmin } = require("./_lib/firestore-admin");
const { PROJECT_ID, encodeFields } = require("./_lib/firestore-rest");

const ACTIVITY_COLLECTION = "sdrActivityEvents";
const DAILY_COLLECTION = "sdrDailyStats";
const VALID_CALL_OUTCOMES = new Set(["nao_atendeu", "atendeu", "agendou", "double"]);
const VALID_MEETING_OUTCOMES = new Set(["show", "noshow"]);

const normalizeRole = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "admin" || raw === "administrador") return "admin";
  if (raw === "growth") return "growth";
  return "";
};

const sendError = (res, status, error, message = "") => sendJson(res, status, { error, message: message || error });

const saoPauloDateKey = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
};

const parseDateKey = (value) => {
  const raw = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : "";
};

const addDaysToKey = (dateKey, offset) => {
  const safe = parseDateKey(dateKey) || saoPauloDateKey();
  const date = new Date(`${safe}T12:00:00-03:00`);
  date.setDate(date.getDate() + Number(offset || 0));
  return saoPauloDateKey(date);
};

const buildEventId = () => `sdr_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;

const buildDocumentName = (collection, docId) => {
  const safeCollection = String(collection || "").trim();
  const safeDocId = String(docId || "").trim();
  if (!PROJECT_ID || !safeCollection || !safeDocId) throw new Error("invalid_firestore_document_name");
  return `projects/${PROJECT_ID}/databases/(default)/documents/${safeCollection}/${encodeURIComponent(safeDocId)}`;
};

const buildDailyId = (sdrUid, dateKey) => `${String(sdrUid || "").trim()}_${String(dateKey || "").trim()}`;

const normalizeGrowthUser = (row = {}) => {
  const role = normalizeRole(row?.tipo || row?.role || row?.type);
  if (role !== "growth") return null;
  const uid = String(row?.firestoreDocId || row?.id || row?.uid || "").trim();
  if (!uid) return null;
  return {
    uid,
    nome: String(row?.nome || row?.name || row?.displayName || row?.email || "SDR").trim() || "SDR",
    email: String(row?.email || "").trim().toLowerCase(),
    ativo: row?.ativo !== false,
  };
};

const normalizeEvent = (row = {}) => {
  const id = String(row?.firestoreDocId || row?.id || "").trim();
  const sdrUid = String(row?.sdrUid || "").trim();
  const dateKey = parseDateKey(row?.dateKey);
  const eventType = String(row?.eventType || "").trim();
  const outcome = String(row?.outcome || "").trim();
  if (!id || !sdrUid || !dateKey || row?.deletedAt) return null;
  if (eventType === "call" && VALID_CALL_OUTCOMES.has(outcome)) return { ...row, id, sdrUid, dateKey, eventType, outcome };
  if (eventType === "meeting" && VALID_MEETING_OUTCOMES.has(outcome)) return { ...row, id, sdrUid, dateKey, eventType, outcome };
  return null;
};

const computeStats = (events = []) => {
  const calls = events.filter((event) => event.eventType === "call");
  const meetings = events.filter((event) => event.eventType === "meeting");
  const totalCalls = calls.length;
  const answered = calls.filter((event) => ["atendeu", "agendou", "double"].includes(event.outcome)).length;
  const scheduled = calls.filter((event) => ["agendou", "double"].includes(event.outcome)).length;
  const double = calls.filter((event) => event.outcome === "double").length;
  const shows = meetings.filter((event) => event.outcome === "show").length;
  const noShows = meetings.filter((event) => event.outcome === "noshow").length;
  return {
    totalCalls,
    answered,
    scheduled,
    double,
    shows,
    noShows,
    totalMeetings: shows + noShows,
    answerRate: totalCalls ? (answered / totalCalls) * 100 : 0,
    scheduleRate: answered ? (scheduled / answered) * 100 : 0,
    callToScheduleRate: totalCalls ? (scheduled / totalCalls) * 100 : 0,
    showRate: shows + noShows ? (shows / (shows + noShows)) * 100 : 0,
  };
};

const buildDailyStat = ({ sdrUid, sdrName, sdrEmail, dateKey, events }) => ({
  id: buildDailyId(sdrUid, dateKey),
  sdrUid,
  sdrName: String(sdrName || "SDR").trim() || "SDR",
  sdrEmail: String(sdrEmail || "").trim().toLowerCase(),
  dateKey,
  ...computeStats(events),
  updatedAt: new Date().toISOString(),
});

const summarizeDays = (events, usersByUid) => {
  const grouped = new Map();
  events.forEach((event) => {
    const key = `${event.sdrUid}::${event.dateKey}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(event);
  });
  return [...grouped.entries()].map(([key, rows]) => {
    const [sdrUid, dateKey] = key.split("::");
    const user = usersByUid.get(sdrUid) || {};
    return buildDailyStat({ sdrUid, sdrName: user.nome || rows[0]?.sdrName, sdrEmail: user.email || rows[0]?.sdrEmail, dateKey, events: rows });
  });
};

const getAuthorizedSession = async (req) => {
  const auth = await resolveAdminRequestAuth(req, { logPrefix: "[sdr-metrics]" });
  if (!auth.ok) return { ok: false, status: auth.status, body: auth.body };
  const role = normalizeRole(auth.session?.role);
  if (role !== "growth" && role !== "admin") {
    return { ok: false, status: 403, body: { error: "forbidden", message: "Acesso restrito ao time Growth." } };
  }
  return { ok: true, session: auth.session, profile: auth.profile, role };
};

const listSdrData = async ({ session, days = 30 } = {}) => {
  const safeDays = Math.max(1, Math.min(Number(days) || 30, 120));
  const todayKey = saoPauloDateKey();
  const fromKey = addDaysToKey(todayKey, -(safeDays - 1));
  const [userRows, eventRows] = await Promise.all([
    listCollectionAsAdmin("users", { pageSize: 1000 }),
    listCollectionAsAdmin(ACTIVITY_COLLECTION, { pageSize: 1000 }).catch(() => []),
  ]);
  const users = userRows.map(normalizeGrowthUser).filter(Boolean);
  const usersByUid = new Map(users.map((user) => [user.uid, user]));
  const events = eventRows
    .map(normalizeEvent)
    .filter(Boolean)
    .filter((event) => event.dateKey >= fromKey && event.dateKey <= todayKey)
    .sort((a, b) => String(a.createdAt || a.time || "").localeCompare(String(b.createdAt || b.time || "")));
  const ownUid = String(session?.sub || "").trim();
  const ownEvents = events.filter((event) => event.sdrUid === ownUid);
  const todayEvents = ownEvents.filter((event) => event.dateKey === todayKey);
  const dailyStats = summarizeDays(events, usersByUid);
  const ownDays = dailyStats.filter((row) => row.sdrUid === ownUid).sort((a, b) => String(b.dateKey).localeCompare(String(a.dateKey)));
  const team = users
    .filter((user) => user.ativo)
    .map((user) => {
      const userStats = dailyStats.filter((row) => row.sdrUid === user.uid);
      const today = userStats.find((row) => row.dateKey === todayKey) || buildDailyStat({ sdrUid: user.uid, sdrName: user.nome, sdrEmail: user.email, dateKey: todayKey, events: [] });
      const weekStart = addDaysToKey(todayKey, -6);
      const weekEvents = events.filter((event) => event.sdrUid === user.uid && event.dateKey >= weekStart && event.dateKey <= todayKey);
      return {
        uid: user.uid,
        nome: user.nome,
        email: user.email,
        today,
        week: computeStats(weekEvents),
      };
    })
    .sort((a, b) => (b.today.scheduled || 0) - (a.today.scheduled || 0) || (b.week.scheduled || 0) - (a.week.scheduled || 0) || String(a.nome).localeCompare(String(b.nome), "pt-BR"));
  return {
    ok: true,
    todayKey,
    fromKey,
    user: { uid: ownUid, nome: session?.name || usersByUid.get(ownUid)?.nome || "SDR", email: session?.email || usersByUid.get(ownUid)?.email || "" },
    events: ownEvents,
    todayEvents,
    days: ownDays,
    team,
  };
};

const writeDailyStat = (stat) => ({
  update: {
    name: buildDocumentName(DAILY_COLLECTION, stat.id),
    fields: encodeFields(stat).fields,
  },
});

const refreshDailyStatWrite = async ({ sdrUid, dateKey, sdrName, sdrEmail }) => {
  const rows = await listCollectionAsAdmin(ACTIVITY_COLLECTION, { pageSize: 1000 }).catch(() => []);
  const events = rows
    .map(normalizeEvent)
    .filter(Boolean)
    .filter((event) => event.sdrUid === sdrUid && event.dateKey === dateKey);
  const stat = buildDailyStat({ sdrUid, sdrName, sdrEmail, dateKey, events });
  const response = await commitWritesAsAdmin({ writes: [writeDailyStat(stat)] });
  if (!response.ok) {
    const error = new Error("daily_stat_write_failed");
    error.status = response.status;
    error.details = response.data || response.text || null;
    throw error;
  }
  return stat;
};

const handleWrite = async ({ req, session }) => {
  const body = await readJsonBody(req);
  const action = String(body?.action || "").trim();
  const sdrUid = String(session?.sub || "").trim();
  const sdrName = String(session?.name || "SDR").trim() || "SDR";
  const sdrEmail = String(session?.email || "").trim().toLowerCase();
  // SEGURANÇA: sdrUid SEMPRE vem da sessão autenticada. Qualquer sdrUid enviado no body é ignorado.
  if (!sdrUid) return { status: 401, body: { error: "unauthenticated" } };

  const dateKey = parseDateKey(body?.dateKey) || saoPauloDateKey();
  const nowIso = new Date().toISOString();
  const writes = [];

  if (action === "log_call" || action === "log_meeting") {
    const outcome = String(body?.outcome || "").trim();
    const eventType = action === "log_call" ? "call" : "meeting";
    if (eventType === "call" && !VALID_CALL_OUTCOMES.has(outcome)) return { status: 400, body: { error: "invalid_outcome" } };
    if (eventType === "meeting" && !VALID_MEETING_OUTCOMES.has(outcome)) return { status: 400, body: { error: "invalid_outcome" } };
    const id = buildEventId();
    writes.push({
      update: {
        name: buildDocumentName(ACTIVITY_COLLECTION, id),
        fields: encodeFields({ id, sdrUid, sdrName, sdrEmail, dateKey, eventType, outcome, time: nowIso, createdAt: nowIso, source: "sdr_panel" }).fields,
      },
    });
  } else if (action === "undo_last") {
    const eventType = String(body?.eventType || "call").trim() === "meeting" ? "meeting" : "call";
    const rows = await listCollectionAsAdmin(ACTIVITY_COLLECTION, { pageSize: 1000 }).catch(() => []);
    const last = rows
      .map(normalizeEvent)
      .filter(Boolean)
      .filter((event) => event.sdrUid === sdrUid && event.dateKey === dateKey && event.eventType === eventType)
      .sort((a, b) => String(b.createdAt || b.time || "").localeCompare(String(a.createdAt || a.time || "")))[0];
    if (!last) return { status: 200, body: { ok: true, skipped: "nothing_to_undo" } };
    writes.push({
      update: {
        name: buildDocumentName(ACTIVITY_COLLECTION, last.id),
        fields: encodeFields({ deletedAt: nowIso, deletedBy: sdrUid }).fields,
      },
      updateMask: { fieldPaths: ["deletedAt", "deletedBy"] },
      currentDocument: { exists: true },
    });
  } else if (action === "manual_day") {
    const total = Math.max(0, Math.floor(Number(body?.totalCalls) || 0));
    const answered = Math.max(0, Math.min(total, Math.floor(Number(body?.answered) || 0)));
    const scheduled = Math.max(0, Math.min(answered, Math.floor(Number(body?.scheduled) || 0)));
    const existing = await listCollectionAsAdmin(ACTIVITY_COLLECTION, { pageSize: 1000 }).catch(() => []);
    existing
      .map(normalizeEvent)
      .filter(Boolean)
      .filter((event) => event.sdrUid === sdrUid && event.dateKey === dateKey && event.eventType === "call")
      .forEach((event) => {
        writes.push({
          update: { name: buildDocumentName(ACTIVITY_COLLECTION, event.id), fields: encodeFields({ deletedAt: nowIso, deletedBy: sdrUid }).fields },
          updateMask: { fieldPaths: ["deletedAt", "deletedBy"] },
          currentDocument: { exists: true },
        });
      });
    for (let index = 0; index < scheduled; index += 1) {
      const id = buildEventId();
      writes.push({ update: { name: buildDocumentName(ACTIVITY_COLLECTION, id), fields: encodeFields({ id, sdrUid, sdrName, sdrEmail, dateKey, eventType: "call", outcome: "agendou", time: `${dateKey}T12:00:00-03:00`, createdAt: nowIso, source: "manual_day" }).fields } });
    }
    for (let index = 0; index < answered - scheduled; index += 1) {
      const id = buildEventId();
      writes.push({ update: { name: buildDocumentName(ACTIVITY_COLLECTION, id), fields: encodeFields({ id, sdrUid, sdrName, sdrEmail, dateKey, eventType: "call", outcome: "atendeu", time: `${dateKey}T12:00:00-03:00`, createdAt: nowIso, source: "manual_day" }).fields } });
    }
    for (let index = 0; index < total - answered; index += 1) {
      const id = buildEventId();
      writes.push({ update: { name: buildDocumentName(ACTIVITY_COLLECTION, id), fields: encodeFields({ id, sdrUid, sdrName, sdrEmail, dateKey, eventType: "call", outcome: "nao_atendeu", time: `${dateKey}T12:00:00-03:00`, createdAt: nowIso, source: "manual_day" }).fields } });
    }
  } else {
    return { status: 400, body: { error: "invalid_action" } };
  }

  if (writes.length) {
    const response = await commitWritesAsAdmin({ writes });
    if (!response.ok) return { status: response.status || 500, body: { error: "sdr_write_failed", errorDetail: response.data || response.text || null } };
  }
  const stat = await refreshDailyStatWrite({ sdrUid, dateKey, sdrName, sdrEmail });
  return { status: 200, body: { ok: true, stat } };
};

module.exports = async (req, res) => {
  try {
    const auth = await getAuthorizedSession(req);
    if (!auth.ok) return sendJson(res, auth.status, auth.body);

    if (req.method === "GET") {
      const host = String(req.headers.host || "localhost");
      const url = new URL(req.url || "/api/sdr-metrics", `https://${host}`);
      const payload = await listSdrData({ session: auth.session, days: Number(url.searchParams.get("days") || 30) });
      sendJson(res, 200, payload);
      return;
    }

    if (req.method === "POST") {
      const result = await handleWrite({ req, session: auth.session });
      sendJson(res, result.status, result.body);
      return;
    }

    res.setHeader("Allow", "GET, POST");
    sendJson(res, 405, { error: "method_not_allowed" });
  } catch (error) {
    console.error("[sdr-metrics] failed", error);
    sendError(res, error.status || 500, error.message || "sdr_metrics_failed", "Não foi possível processar o painel SDR agora.");
  }
};
