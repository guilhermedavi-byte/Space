const { readJsonBody, sendJson } = require("../../../_lib/http");
const { getSessionFromRequest } = require("../../../_lib/session");
const { verifyFirebaseIdToken } = require("../../../_lib/firebase-id-token");
const { DEFAULT_CONFIG } = require("../../../_lib/scheduling-firestore");
const {
  clampInt,
  getDayOfWeekFromDateKey,
  isValidDateKey,
  minutesToTime,
  timeToMinutes,
  toUtcMsForDateKeyAndMinutes,
} = require("../../../_lib/scheduling-utils");
const {
  decodeFields,
  firestoreGetDocument,
  firestorePatchDocument,
  getBearerTokenFromRequest,
  getDocIdFromName,
} = require("../../../_lib/firestore-rest");

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
  // /api/schedule/reschedule/<id>/resolve
  const idx = parts.lastIndexOf("reschedule");
  if (idx >= 0 && parts[idx + 1]) return String(parts[idx + 1] || "").trim();
  // fallback
  return String(parts[parts.length - 2] || "").trim();
};

const parseMinutes = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return clampInt(value, 0, 1440);
  const str = typeof value === "string" ? value.trim() : "";
  if (!str) return null;
  const parsed = timeToMinutes(str);
  return Number.isFinite(parsed) ? clampInt(parsed, 0, 1440) : null;
};

const DOW_TO_KEY = {
  0: "dom",
  1: "seg",
  2: "ter",
  3: "qua",
  4: "qui",
  5: "sex",
  6: "sab",
};

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

  const role = normalizeRole(session.role);
  if (role !== "admin") {
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

  const id = parseIdFromRequest(req);
  if (!id) {
    sendJson(res, 400, { error: "id_required" });
    return;
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    sendJson(res, 400, { error: "invalid_json" });
    return;
  }

  const acao = String(body?.acao || "").trim().toLowerCase();
  const motivoResposta = String(body?.motivo || "").trim();
  if (acao !== "aprovar" && acao !== "recusar") {
    sendJson(res, 400, { error: "invalid_action" });
    return;
  }

  const requestPath = `reagendamentos/${encodeURIComponent(id)}`;
  let reqFields;
  try {
    const snap = await firestoreGetDocument({ docPath: requestPath, idToken });
    if (!snap.ok) {
      sendJson(res, snap.status === 404 ? 404 : 500, { error: snap.status === 404 ? "not_found" : "internal_error" });
      return;
    }
    reqFields = decodeFields(snap.data);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[api] reschedule resolve load failed", error);
    sendJson(res, 500, { error: "internal_error" });
    return;
  }

  const currentStatus = String(reqFields?.status || "").trim().toLowerCase() || "pendente";
  if (currentStatus !== "pendente") {
    sendJson(res, 400, { error: "already_resolved" });
    return;
  }

  const aulaId = typeof reqFields?.aulaId === "string" ? reqFields.aulaId : "";
  if (!aulaId) {
    sendJson(res, 400, { error: "aula_required" });
    return;
  }

  const aulaPath = `aulas/${encodeURIComponent(aulaId)}`;

  const patchReq = {
    status: acao === "aprovar" ? "aprovado" : "recusado",
    resolvidoEm: new Date(),
    resolvidoPor: adminId,
    motivoResposta: motivoResposta || null,
  };

  try {
    // If approved, allow passing a new date/time.
    if (acao === "aprovar") {
      const dateKey = String(body?.dateKey || body?.novaDataKey || "").trim();
      const startMin = parseMinutes(body?.startMin ?? body?.horaInicio ?? body?.novaHoraInicio ?? body?.startTime);
      const endMin = parseMinutes(body?.endMin ?? body?.horaFim ?? body?.novaHoraFim ?? body?.endTime);

      if (dateKey && isValidDateKey(dateKey) && Number.isFinite(startMin) && Number.isFinite(endMin) && endMin > startMin) {
        const startMs = toUtcMsForDateKeyAndMinutes(dateKey, startMin, { tzOffsetMinutes: DEFAULT_CONFIG.tzOffsetMinutes });
        const dow = getDayOfWeekFromDateKey(dateKey);
        const diaSemana = dow == null ? "" : DOW_TO_KEY[dow] || "";
        const data = startMs ? new Date(startMs) : new Date();

        await firestorePatchDocument({
          docPath: aulaPath,
          idToken,
          data: {
            dateKey,
            startMin,
            endMin,
            data,
            diaSemana,
            horaInicio: minutesToTime(startMin),
            horaFim: minutesToTime(endMin),
            status: "agendada",
            atualizadoEm: new Date(),
          },
          updateMaskPaths: ["dateKey", "startMin", "endMin", "data", "diaSemana", "horaInicio", "horaFim", "status", "atualizadoEm"],
        });

        patchReq.novoDateKey = dateKey;
        patchReq.novaHoraInicio = minutesToTime(startMin);
        patchReq.novaHoraFim = minutesToTime(endMin);
      } else {
        // Still mark the request as approved, but keep the aula unchanged.
        await firestorePatchDocument({
          docPath: aulaPath,
          idToken,
          data: { status: "agendada", atualizadoEm: new Date() },
          updateMaskPaths: ["status", "atualizadoEm"],
        }).catch(() => null);
      }
    } else {
      // Rejected: keep aula as scheduled (admin may handle separately), but clear the reschedule flag.
      await firestorePatchDocument({
        docPath: aulaPath,
        idToken,
        data: { status: "agendada", atualizadoEm: new Date() },
        updateMaskPaths: ["status", "atualizadoEm"],
      }).catch(() => null);
    }

    const patch = await firestorePatchDocument({
      docPath: requestPath,
      idToken,
      data: patchReq,
      updateMaskPaths: Object.keys(patchReq),
    });
    if (!patch.ok) throw new Error("firestore_patch_failed");

    sendJson(res, 200, { ok: true, status: patchReq.status });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[api] reschedule resolve failed", error);
    sendJson(res, 500, { error: "internal_error" });
  }
};

