const { sendJson } = require("../_lib/http");
const { getSessionFromRequest } = require("../_lib/session");
const { verifyFirebaseIdToken } = require("../_lib/firebase-id-token");
const { DEFAULT_CONFIG } = require("../_lib/scheduling-firestore");
const { clampInt, isValidDateKey, timeToMinutes, toUtcMsForDateKeyAndMinutes } = require("../_lib/scheduling-utils");
const {
  decodeFields,
  firestoreGetDocument,
  firestoreListDocuments,
  getBearerTokenFromRequest,
  getDocIdFromName,
} = require("../_lib/firestore-rest");

module.exports = async (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    sendJson(res, 405, { error: "method_not_allowed" });
    return;
  }

  const session = getSessionFromRequest(req);
  if (!session) {
    sendJson(res, 401, { error: "unauthorized" });
    return;
  }

  const role = String(session.role || "").trim().toLowerCase();
  const normalizedRole = role === "admin" || role === "teacher" || role === "student" ? role : "";
  if (normalizedRole !== "student" && normalizedRole !== "teacher") {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }

  const userId = String(session.sub || "");
  const idToken = getBearerTokenFromRequest(req);
  if (!userId || !idToken) {
    sendJson(res, 401, { error: "unauthorized" });
    return;
  }

  try {
    const decoded = await verifyFirebaseIdToken(idToken);
    if (decoded.uid !== userId) {
      sendJson(res, 401, { error: "invalid_credentials" });
      return;
    }
  } catch (error) {
    sendJson(res, 401, { error: "invalid_credentials" });
    return;
  }

  const tzOffsetMinutes = DEFAULT_CONFIG.tzOffsetMinutes;
  const now = Date.now();

  let rawAulas = [];
  try {
    const resList = await firestoreListDocuments({ collectionPath: "aulas", idToken, pageSize: 2000 });
    if (!resList.ok) throw new Error("firestore_list_failed");
    const docs = Array.isArray(resList.documents) ? resList.documents : Array.isArray(resList.data?.documents) ? resList.data.documents : [];
    rawAulas = docs
      .map((doc) => {
        if (!doc || typeof doc !== "object") return null;
        const id = getDocIdFromName(doc.name);
        if (!id) return null;
        const fields = decodeFields(doc);

        const professorId = typeof fields.professorId === "string" ? fields.professorId : "";
        const alunoId = fields.alunoId == null ? null : typeof fields.alunoId === "string" ? fields.alunoId : null;

        const dateKey = typeof fields.dateKey === "string" ? fields.dateKey : "";
        const startMinRaw = Number(fields.startMin);
        const endMinRaw = Number(fields.endMin);
        const startMin = Number.isFinite(startMinRaw) ? clampInt(startMinRaw, 0, 1440) : timeToMinutes(fields.horaInicio);
        const endMin = Number.isFinite(endMinRaw) ? clampInt(endMinRaw, 0, 1440) : timeToMinutes(fields.horaFim);
        if (!professorId || !isValidDateKey(dateKey)) return null;
        if (!Number.isFinite(startMin) || !Number.isFinite(endMin) || endMin <= startMin) return null;

        const status = String(fields.status || "").trim().toLowerCase() || "agendada";
        const professorNome = typeof fields.professorNome === "string" ? fields.professorNome.trim() : "";
        const alunoNome = typeof fields.alunoNome === "string" ? fields.alunoNome.trim() : "";
        const grupoRecorrenciaId = typeof fields.grupoRecorrenciaId === "string" ? fields.grupoRecorrenciaId : "";
        const recorrente = typeof fields.recorrente === "boolean" ? fields.recorrente : false;

        return {
          id,
          professorId,
          alunoId,
          dateKey,
          startMin,
          endMin,
          status,
          professorNome: professorNome || null,
          alunoNome: alunoNome || null,
          grupoRecorrenciaId: grupoRecorrenciaId || null,
          recorrente,
        };
      })
      .filter(Boolean);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[api] schedule my-lessons query failed", error);
    sendJson(res, 500, { error: "internal_error" });
    return;
  }

  const filtered = rawAulas
    .filter((evt) => {
      if (normalizedRole === "student") return evt.alunoId === userId;
      return evt.professorId === userId;
    })
    .filter((evt) => evt.status !== "cancelada" && evt.status !== "cancelado")
    .map((evt) => {
      const startMs = toUtcMsForDateKeyAndMinutes(evt.dateKey, evt.startMin, { tzOffsetMinutes });
      const endMs = toUtcMsForDateKeyAndMinutes(evt.dateKey, evt.endMin, { tzOffsetMinutes });
      return startMs && endMs ? { ...evt, startMs, endMs } : null;
    })
    .filter(Boolean)
    .filter((evt) => evt.endMs > now)
    .sort((a, b) => a.startMs - b.startMs);

  // Student view needs rescheduling statuses. We attach the latest request status per aulaId.
  const rescheduleByAula = new Map();
  if (normalizedRole === "student") {
    try {
      const resReq = await firestoreListDocuments({ collectionPath: "reagendamentos", idToken, pageSize: 2000 });
      if (resReq.ok) {
        const docs = Array.isArray(resReq.documents)
          ? resReq.documents
          : Array.isArray(resReq.data?.documents)
            ? resReq.data.documents
            : [];
        docs
          .map((doc) => {
            if (!doc || typeof doc !== "object") return null;
            const id = getDocIdFromName(doc.name);
            if (!id) return null;
            const fields = decodeFields(doc);
            const alunoId = typeof fields.alunoId === "string" ? fields.alunoId : "";
            const aulaId = typeof fields.aulaId === "string" ? fields.aulaId : "";
            const status = String(fields.status || "").trim().toLowerCase() || "pendente";
            const criadoEm = fields.criadoEm instanceof Date ? fields.criadoEm.getTime() : 0;
            if (!alunoId || !aulaId) return null;
            return { id, alunoId, aulaId, status, criadoEm };
          })
          .filter(Boolean)
          .filter((r) => r.alunoId === userId)
          .forEach((r) => {
            const prev = rescheduleByAula.get(r.aulaId);
            if (!prev || (r.criadoEm || 0) >= (prev.criadoEm || 0)) {
              rescheduleByAula.set(r.aulaId, r);
            }
          });
      }
    } catch (error) {
      // ignore
    }
  }

  const nameCache = new Map();
  const getName = async (uid) => {
    const safeId = String(uid || "").trim();
    if (!safeId) return null;
    if (nameCache.has(safeId)) return nameCache.get(safeId);
    try {
      const snap = await firestoreGetDocument({ docPath: `users/${encodeURIComponent(safeId)}`, idToken });
      if (!snap.ok) {
        nameCache.set(safeId, null);
        return null;
      }
      const fields = decodeFields(snap.data);
      const name = typeof fields?.nome === "string" ? fields.nome.trim() : "";
      nameCache.set(safeId, name || null);
      return name || null;
    } catch (error) {
      nameCache.set(safeId, null);
      return null;
    }
  };

  const lessons = [];
  for (const evt of filtered) {
    const professorNome = evt.professorNome || (await getName(evt.professorId));
    const alunoNome = evt.alunoId ? evt.alunoNome || (await getName(evt.alunoId)) : null;
    const reqInfo = normalizedRole === "student" ? rescheduleByAula.get(evt.id) : null;

    lessons.push({
      id: evt.id,
      dateKey: evt.dateKey,
      startMin: evt.startMin,
      endMin: evt.endMin,
      status: evt.status,
      professorId: evt.professorId,
      alunoId: evt.alunoId,
      professor_nome: professorNome || null,
      aluno_nome: alunoNome || null,
      recorrente: Boolean(evt.recorrente),
      grupoRecorrenciaId: evt.grupoRecorrenciaId || null,
      reagendamento: reqInfo
        ? {
            id: reqInfo.id,
            status: reqInfo.status,
          }
        : null,
    });
  }

  sendJson(res, 200, { lessons });
};
