const { readJsonBody, sendJson } = require("../../_lib/http");
const { getSessionFromRequest } = require("../../_lib/session");
const { verifyFirebaseIdToken } = require("../../_lib/firebase-id-token");
const {
  decodeFields,
  firestoreGetDocument,
  firestoreListDocuments,
  firestorePatchDocument,
  getBearerTokenFromRequest,
  getDocIdFromName,
} = require("../../_lib/firestore-rest");

const listActiveTeachers = async ({ idToken }) => {
  const res = await firestoreListDocuments({ collectionPath: "users", idToken, pageSize: 800 });
  if (!res.ok) throw new Error("firestore_list_failed");
  const docs = Array.isArray(res.documents) ? res.documents : Array.isArray(res.data?.documents) ? res.data.documents : [];

  return docs
    .map((doc) => {
      if (!doc || typeof doc !== "object") return null;
      const id = getDocIdFromName(doc.name);
      const fields = decodeFields(doc);
      const name = String(fields?.nome || "").trim();
      const type = String(fields?.tipo || "").trim().toLowerCase();
      const active = typeof fields?.ativo === "boolean" ? fields.ativo : true;
      if (type !== "teacher" || !active) return null;
      if (!id || !name) return null;
      return { id, name };
    })
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
};

const getRankingOrder = async ({ idToken }) => {
  const docPath = "config/teacherRanking";
  const snap = await firestoreGetDocument({ docPath, idToken });
  if (!snap.ok) {
    if (snap.status === 404) return [];
    throw new Error("firestore_get_failed");
  }
  const fields = decodeFields(snap.data);
  return Array.isArray(fields?.order) ? fields.order.filter((id) => typeof id === "string") : [];
};

const validateOrder = (teacherIds, order) => {
  if (!Array.isArray(order)) return { ok: false, error: "invalid_order" };
  const ids = order.filter((id) => typeof id === "string");
  if (ids.length !== order.length) return { ok: false, error: "invalid_order" };
  const set = new Set(ids);
  if (set.size !== ids.length) return { ok: false, error: "duplicate_ids" };
  const missing = teacherIds.filter((id) => !set.has(id));
  const unknown = ids.filter((id) => !teacherIds.includes(id));
  if (missing.length || unknown.length) return { ok: false, error: "order_mismatch" };
  return { ok: true, order: ids };
};

module.exports = async (req, res) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    sendJson(res, 401, { error: "unauthorized" });
    return;
  }

  if (String(session.role || "") !== "admin") {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }

  const adminId = String(session.sub || "");
  const idToken = getBearerTokenFromRequest(req);
  if (!adminId || !idToken) {
    sendJson(res, 401, { error: "unauthorized" });
    return;
  }

  try {
    const decoded = await verifyFirebaseIdToken(idToken);
    if (decoded.uid !== adminId) {
      sendJson(res, 401, { error: "invalid_credentials" });
      return;
    }
  } catch (error) {
    sendJson(res, 401, { error: "invalid_credentials" });
    return;
  }

  if (req.method === "GET" || req.method === "HEAD") {
    try {
      const teachers = await listActiveTeachers({ idToken });
      const teacherIds = teachers.map((t) => t.id);
      const storedOrder = await getRankingOrder({ idToken });
      const deduped = [];
      const seen = new Set();
      storedOrder.forEach((id) => {
        if (!teacherIds.includes(id)) return;
        if (seen.has(id)) return;
        seen.add(id);
        deduped.push(id);
      });
      teacherIds.forEach((id) => {
        if (seen.has(id)) return;
        seen.add(id);
        deduped.push(id);
      });
      sendJson(res, 200, { teachers, order: deduped });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[api] admin ranking get failed", error);
      sendJson(res, 500, { error: "internal_error" });
    }
    return;
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, HEAD, POST");
    sendJson(res, 405, { error: "method_not_allowed" });
    return;
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    sendJson(res, 400, { error: "invalid_json" });
    return;
  }

  try {
    const teachers = await listActiveTeachers({ idToken });
    const teacherIds = teachers.map((t) => t.id);
    const validated = validateOrder(teacherIds, body?.order);
    if (!validated.ok) {
      sendJson(res, 400, { error: validated.error });
      return;
    }

    const docPath = "config/teacherRanking";
    const patch = await firestorePatchDocument({
      docPath,
      idToken,
      data: {
        order: validated.order,
        updatedAt: new Date(),
      },
      updateMaskPaths: ["order", "updatedAt"],
    });

    if (!patch.ok) {
      throw new Error("firestore_patch_failed");
    }

    sendJson(res, 200, { ok: true });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[api] admin ranking save failed", error);
    sendJson(res, 500, { error: "internal_error" });
  }
};
