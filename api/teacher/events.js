const { readJsonBody, sendJson } = require("../../_lib/http");
const { getSessionFromRequest } = require("../../_lib/session");
const { verifyFirebaseIdToken } = require("../../_lib/firebase-id-token");
const { normalizeStatus } = require("../../_lib/scheduling-core");
const { clampInt, isValidDateKey } = require("../../_lib/scheduling-utils");
const {
  decodeFields,
  firestoreDeleteDocument,
  firestoreGetDocument,
  firestoreListDocuments,
  firestorePatchDocument,
  getBearerTokenFromRequest,
  getDocIdFromName,
} = require("../../_lib/firestore-rest");

const normalizeGuestIds = (raw) => {
  const arr = Array.isArray(raw) ? raw : [];
  return arr.filter((g) => typeof g === "string" && g.trim());
};

const normalizeDocuments = (raw) => {
  const arr = Array.isArray(raw) ? raw : [];
  return arr
    .map((doc) => {
      if (!doc || typeof doc !== "object") return null;
      const id = typeof doc.id === "string" ? doc.id : `doc_${Math.random().toString(16).slice(2)}`;
      const name = typeof doc.name === "string" ? doc.name : "";
      if (!name) return null;
      return {
        id,
        name,
        ext: typeof doc.ext === "string" ? doc.ext : "",
        type: typeof doc.type === "string" ? doc.type : "",
        size: typeof doc.size === "number" ? doc.size : 0,
        dataUrl: typeof doc.dataUrl === "string" ? doc.dataUrl : "",
      };
    })
    .filter(Boolean);
};

const decodeEventFromFirestore = (doc) => {
  if (!doc || typeof doc !== "object") return null;
  const id = getDocIdFromName(doc.name);
  const fields = decodeFields(doc);

  const teacherId = typeof fields.teacherId === "string" ? fields.teacherId : "";
  const dateKey = typeof fields.dateKey === "string" ? fields.dateKey : "";
  const startMin = Number(fields.startMin);
  const endMin = Number(fields.endMin);
  if (!id || !teacherId || !isValidDateKey(dateKey)) return null;
  if (!Number.isFinite(startMin) || !Number.isFinite(endMin) || endMin <= startMin) return null;

  const studentId = fields.studentId == null ? null : typeof fields.studentId === "string" ? fields.studentId : null;
  const studentName = typeof fields.studentName === "string" ? fields.studentName : "";

  const isLesson = Boolean(studentId);

  return {
    id,
    teacherId,
    type: isLesson ? "lesson" : "manual",
    dateKey,
    startMin,
    endMin,
    status: normalizeStatus(fields.status),
    title: isLesson ? studentName || "Aluno" : String(fields.title || ""),
    description: isLesson ? "" : String(fields.description || ""),
    guests: isLesson ? [] : normalizeGuestIds(fields.guests),
    documents: isLesson ? [] : normalizeDocuments(fields.documents),
    studentId,
  };
};

const listTeacherEvents = async ({ teacherId, from, to, idToken }) => {
  const fromKey = isValidDateKey(from) ? String(from) : null;
  const toKey = isValidDateKey(to) ? String(to) : null;

  const res = await firestoreListDocuments({ collectionPath: "events", idToken, pageSize: 1200 });
  if (!res.ok) throw new Error("firestore_list_failed");
  const docs = Array.isArray(res.documents) ? res.documents : Array.isArray(res.data?.documents) ? res.data.documents : [];

  return docs
    .map((doc) => decodeEventFromFirestore(doc))
    .filter(Boolean)
    .filter((evt) => evt.teacherId === teacherId)
    .filter((evt) => {
      if (fromKey && evt.dateKey < fromKey) return false;
      if (toKey && evt.dateKey > toKey) return false;
      return true;
    })
    .sort((a, b) => (a.dateKey === b.dateKey ? a.startMin - b.startMin : a.dateKey.localeCompare(b.dateKey)))
    .map((evt) => ({
      id: evt.id,
      type: evt.type,
      dateKey: evt.dateKey,
      startMin: evt.startMin,
      endMin: evt.endMin,
      status: evt.status,
      title: evt.title,
      description: evt.description,
      guests: evt.guests,
      documents: evt.documents,
    }));
};

module.exports = async (req, res) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    sendJson(res, 401, { error: "unauthorized" });
    return;
  }

  if (String(session.role || "") !== "teacher") {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }

  const teacherId = String(session.sub || "");
  if (!teacherId) {
    sendJson(res, 401, { error: "unauthorized" });
    return;
  }

  const idToken = getBearerTokenFromRequest(req);
  if (!idToken) {
    sendJson(res, 401, { error: "missing_id_token" });
    return;
  }

  try {
    const decoded = await verifyFirebaseIdToken(idToken);
    if (decoded.uid !== teacherId) {
      sendJson(res, 401, { error: "invalid_credentials" });
      return;
    }
  } catch (error) {
    sendJson(res, 401, { error: "invalid_credentials" });
    return;
  }

  if (req.method === "GET" || req.method === "HEAD") {
    const host = String(req.headers.host || "localhost");
    const url = new URL(req.url || "/api/teacher/events", `https://${host}`);
    const from = url.searchParams.get("from") || "";
    const to = url.searchParams.get("to") || "";
    try {
      const events = await listTeacherEvents({ teacherId, from, to, idToken });
      sendJson(res, 200, { events });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[api] teacher events list failed", error);
      sendJson(res, 500, { error: "internal_error" });
    }
    return;
  }

  if (req.method === "POST" || req.method === "PUT" || req.method === "DELETE") {
    let body;
    try {
      body = await readJsonBody(req);
    } catch (error) {
      sendJson(res, 400, { error: "invalid_json" });
      return;
    }

    try {
      if (req.method === "POST") {
        const dateKey = String(body?.dateKey || "").trim();
        const startMin = clampInt(body?.startMin, 0, 1440);
        const endMin = clampInt(body?.endMin, 0, 1440);
        const title = String(body?.title || "").trim();
        const description = String(body?.description || "");
        const guests = normalizeGuestIds(body?.guests);
        const documents = normalizeDocuments(body?.documents);

        if (!isValidDateKey(dateKey)) {
          sendJson(res, 400, { error: "invalid_date" });
          return;
        }
        if (endMin <= startMin) {
          sendJson(res, 400, { error: "invalid_time" });
          return;
        }
        if (!title) {
          sendJson(res, 400, { error: "title_required" });
          return;
        }

        const id = `m_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
        const docPath = `events/${encodeURIComponent(id)}`;
        const patch = await firestorePatchDocument({
          docPath,
          idToken,
          data: {
            teacherId,
            studentId: null,
            dateKey,
            startMin,
            endMin,
            status: "agendado",
            createdAt: new Date(),
            title,
            description,
            guests,
            documents,
            kind: "manual",
          },
          updateMaskPaths: [
            "teacherId",
            "studentId",
            "dateKey",
            "startMin",
            "endMin",
            "status",
            "createdAt",
            "title",
            "description",
            "guests",
            "documents",
            "kind",
          ],
        });

        if (!patch.ok) throw new Error("firestore_patch_failed");

        sendJson(res, 200, {
          ok: true,
          event: {
            id,
            type: "manual",
            dateKey,
            startMin,
            endMin,
            status: "agendado",
            title,
            description,
            guests,
            documents,
          },
        });
        return;
      }

      if (req.method === "PUT") {
        const id = String(body?.id || "").trim();
        if (!id) {
          sendJson(res, 400, { error: "id_required" });
          return;
        }

        const docPath = `events/${encodeURIComponent(id)}`;
        const snap = await firestoreGetDocument({ docPath, idToken });
        if (!snap.ok) {
          sendJson(res, snap.status === 404 ? 404 : 500, { error: snap.status === 404 ? "not_found" : "internal_error" });
          return;
        }

        const existingFields = decodeFields(snap.data);
        if (String(existingFields.teacherId || "") !== teacherId) {
          sendJson(res, 403, { error: "forbidden" });
          return;
        }
        if (existingFields.studentId != null) {
          sendJson(res, 403, { error: "forbidden" });
          return;
        }

        const dateKey = String(body?.dateKey || existingFields.dateKey || "").trim();
        const startMin = clampInt(body?.startMin ?? existingFields.startMin, 0, 1440);
        const endMin = clampInt(body?.endMin ?? existingFields.endMin, 0, 1440);
        const title = String(body?.title ?? existingFields.title || "").trim();
        const description = String(body?.description ?? existingFields.description || "");
        const guests = body?.guests ? normalizeGuestIds(body.guests) : normalizeGuestIds(existingFields.guests);
        const documents = body?.documents ? normalizeDocuments(body.documents) : normalizeDocuments(existingFields.documents);

        if (!isValidDateKey(dateKey)) {
          sendJson(res, 400, { error: "invalid_date" });
          return;
        }
        if (endMin <= startMin) {
          sendJson(res, 400, { error: "invalid_time" });
          return;
        }
        if (!title) {
          sendJson(res, 400, { error: "title_required" });
          return;
        }

        const patch = await firestorePatchDocument({
          docPath,
          idToken,
          data: {
            dateKey,
            startMin,
            endMin,
            title,
            description,
            guests,
            documents,
            updatedAt: new Date(),
          },
          updateMaskPaths: ["dateKey", "startMin", "endMin", "title", "description", "guests", "documents", "updatedAt"],
        });

        if (!patch.ok) throw new Error("firestore_patch_failed");

        sendJson(res, 200, {
          ok: true,
          event: {
            id,
            type: "manual",
            dateKey,
            startMin,
            endMin,
            status: normalizeStatus(existingFields.status),
            title,
            description,
            guests,
            documents,
          },
        });
        return;
      }

      if (req.method === "DELETE") {
        const id = String(body?.id || "").trim();
        if (!id) {
          sendJson(res, 400, { error: "id_required" });
          return;
        }

        const docPath = `events/${encodeURIComponent(id)}`;
        const snap = await firestoreGetDocument({ docPath, idToken });
        if (!snap.ok) {
          sendJson(res, snap.status === 404 ? 404 : 500, { error: snap.status === 404 ? "not_found" : "internal_error" });
          return;
        }

        const existingFields = decodeFields(snap.data);
        if (String(existingFields.teacherId || "") !== teacherId) {
          sendJson(res, 403, { error: "forbidden" });
          return;
        }
        if (existingFields.studentId != null) {
          sendJson(res, 403, { error: "forbidden" });
          return;
        }

        const del = await firestoreDeleteDocument({ docPath, idToken });
        if (!del.ok) throw new Error("firestore_delete_failed");
        sendJson(res, 200, { ok: true });
        return;
      }

      sendJson(res, 405, { error: "method_not_allowed" });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[api] teacher events mutate failed", error);
      sendJson(res, 500, { error: "internal_error" });
    }
  }

  res.setHeader("Allow", "GET, HEAD, POST, PUT, DELETE");
  sendJson(res, 405, { error: "method_not_allowed" });
};
