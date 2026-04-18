const { sendJson } = require("../../_lib/http");
const { getSessionFromRequest } = require("../../_lib/session");
const { verifyFirebaseIdToken } = require("../../_lib/firebase-id-token");
const { DEFAULT_CONFIG } = require("../../_lib/scheduling-firestore");
const { clampInt, isValidDateKey, timeToMinutes, toUtcMsForDateKeyAndMinutes } = require("../../_lib/scheduling-utils");
const {
  decodeFields,
  firestoreDeleteDocument,
  firestoreGetDocument,
  firestoreListDocuments,
  getBearerTokenFromRequest,
  getDocIdFromName,
} = require("../../_lib/firestore-rest");

const normalizeRole = (role) => {
  const raw = String(role || "").trim().toLowerCase();
  if (raw === "admin" || raw === "administrador") return "admin";
  if (raw === "teacher" || raw === "professor") return "teacher";
  if (raw === "student" || raw === "aluno") return "student";
  return "";
};

const parseIdFromRequest = (req) => {
  if (req && req.query && typeof req.query.id === "string") return String(req.query.id || "").trim();
  const host = String(req?.headers?.host || "localhost");
  const url = new URL(req?.url || "", `https://${host}`);
  const parts = url.pathname.split("/").filter(Boolean);
  return String(parts[parts.length - 1] || "").trim();
};

const parseMode = (req) => {
  const host = String(req?.headers?.host || "localhost");
  const url = new URL(req?.url || "", `https://${host}`);
  const mode = String(url.searchParams.get("mode") || "").trim().toLowerCase();
  return mode === "future" ? "future" : "single";
};

const decodeAulaCore = (doc) => {
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
  const grupoRecorrenciaId = typeof fields.grupoRecorrenciaId === "string" ? fields.grupoRecorrenciaId : "";
  const criadoPor = typeof fields.criadoPor === "string" ? fields.criadoPor : "";

  if (!professorId) return null;
  if (!isValidDateKey(dateKey)) return null;
  if (!Number.isFinite(startMin) || !Number.isFinite(endMin) || endMin <= startMin) return null;

  const startMs = toUtcMsForDateKeyAndMinutes(dateKey, startMin, { tzOffsetMinutes: DEFAULT_CONFIG.tzOffsetMinutes });
  return {
    id,
    professorId,
    alunoId,
    dateKey,
    startMin,
    endMin,
    startMs: startMs || 0,
    grupoRecorrenciaId: grupoRecorrenciaId || null,
    criadoPor,
  };
};

module.exports = async (req, res) => {
  if (req.method !== "DELETE") {
    res.setHeader("Allow", "DELETE");
    sendJson(res, 405, { error: "method_not_allowed" });
    return;
  }

  const session = getSessionFromRequest(req);
  if (!session) {
    sendJson(res, 401, { error: "unauthorized" });
    return;
  }

  const role = normalizeRole(session.role);
  if (role !== "admin" && role !== "teacher") {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }

  const requesterId = String(session.sub || "");
  const idToken = getBearerTokenFromRequest(req);
  if (!requesterId || !idToken) {
    sendJson(res, 401, { error: "unauthorized" });
    return;
  }

  try {
    const decoded = await verifyFirebaseIdToken(idToken);
    if (decoded.uid !== requesterId) {
      sendJson(res, 401, { error: "invalid_credentials" });
      return;
    }
  } catch (error) {
    sendJson(res, 401, { error: "invalid_credentials" });
    return;
  }

  const id = parseIdFromRequest(req);
  if (!id) {
    sendJson(res, 400, { error: "id_required" });
    return;
  }

  const mode = parseMode(req);

  try {
    const docPath = `aulas/${encodeURIComponent(id)}`;
    const snap = await firestoreGetDocument({ docPath, idToken });
    if (!snap.ok) {
      sendJson(res, snap.status === 404 ? 404 : 500, { error: snap.status === 404 ? "not_found" : "internal_error" });
      return;
    }

    const evt = decodeAulaCore(snap.data);
    if (!evt) {
      sendJson(res, 404, { error: "not_found" });
      return;
    }

    if (role === "teacher") {
      if (evt.professorId !== requesterId) {
        sendJson(res, 403, { error: "forbidden" });
        return;
      }
      if (evt.criadoPor !== "professor") {
        sendJson(res, 403, { error: "forbidden" });
        return;
      }
    }

    if (mode !== "future" || !evt.grupoRecorrenciaId) {
      const del = await firestoreDeleteDocument({ docPath, idToken });
      if (!del.ok) throw new Error("firestore_delete_failed");
      sendJson(res, 200, { ok: true, deleted: 1 });
      return;
    }

    const resList = await firestoreListDocuments({ collectionPath: "aulas", idToken, pageSize: 2000 });
    if (!resList.ok) throw new Error("firestore_list_failed");
    const docs = Array.isArray(resList.documents)
      ? resList.documents
      : Array.isArray(resList.data?.documents)
        ? resList.data.documents
        : [];

    const toDelete = docs
      .map((doc) => decodeAulaCore(doc))
      .filter(Boolean)
      .filter((row) => row.grupoRecorrenciaId === evt.grupoRecorrenciaId)
      .filter((row) => (row.startMs || 0) >= (evt.startMs || 0));

    // Teachers can only delete their own series.
    if (role === "teacher") {
      if (toDelete.some((row) => row.professorId !== requesterId || row.criadoPor !== "professor")) {
        sendJson(res, 403, { error: "forbidden" });
        return;
      }
    }

    let deleted = 0;
    for (const row of toDelete) {
      const del = await firestoreDeleteDocument({ docPath: `aulas/${encodeURIComponent(row.id)}`, idToken });
      if (del.ok) deleted += 1;
    }

    sendJson(res, 200, { ok: true, deleted });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[api] schedule events delete failed", error);
    sendJson(res, 500, { error: "internal_error" });
  }
};

