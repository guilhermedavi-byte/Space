const { readJsonBody, sendJson } = require("../_lib/http");
const { getSessionFromRequest } = require("../_lib/session");
const { normalizeStatus } = require("../_lib/scheduling-core");
const { verifyFirebaseIdToken } = require("../_lib/firebase-id-token");
const {
  decodeFields,
  firestoreGetDocument,
  firestorePatchDocument,
  getBearerTokenFromRequest,
} = require("../_lib/firestore-rest");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    sendJson(res, 405, { error: "method_not_allowed" });
    return;
  }

  const session = getSessionFromRequest(req);
  if (!session) {
    sendJson(res, 401, { error: "unauthorized" });
    return;
  }

  if (String(session.role || "") !== "student") {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }

  const studentId = String(session.sub || "");
  const idToken = getBearerTokenFromRequest(req);
  if (!studentId || !idToken) {
    sendJson(res, 401, { error: "unauthorized" });
    return;
  }

  try {
    const decoded = await verifyFirebaseIdToken(idToken);
    if (decoded.uid !== studentId) {
      sendJson(res, 401, { error: "invalid_credentials" });
      return;
    }
  } catch (error) {
    sendJson(res, 401, { error: "invalid_credentials" });
    return;
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    sendJson(res, 400, { error: "invalid_json" });
    return;
  }

  const eventId = String(body?.id || "").trim();
  if (!studentId || !eventId) {
    sendJson(res, 400, { error: "invalid_request" });
    return;
  }

  try {
    const docPath = `events/${encodeURIComponent(eventId)}`;
    const snap = await firestoreGetDocument({ docPath, idToken });
    if (!snap.ok) {
      sendJson(res, snap.status === 404 ? 404 : 500, { error: snap.status === 404 ? "not_found" : "internal_error" });
      return;
    }

    const fields = decodeFields(snap.data);
    if (String(fields.studentId || "") !== studentId) {
      sendJson(res, 404, { error: "not_found" });
      return;
    }

    if (normalizeStatus(fields.status) === "cancelado") {
      sendJson(res, 200, { ok: true });
      return;
    }

    const patch = await firestorePatchDocument({
      docPath,
      idToken,
      data: { status: "cancelado", cancelledAt: new Date() },
      updateMaskPaths: ["status", "cancelledAt"],
    });

    if (!patch.ok) throw new Error("firestore_patch_failed");
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[api] schedule cancel failed", error);
    sendJson(res, 500, { error: "internal_error" });
    return;
  }

  sendJson(res, 200, { ok: true });
};
