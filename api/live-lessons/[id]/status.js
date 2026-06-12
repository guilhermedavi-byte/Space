const { readJsonBody, sendJson } = require("../../_lib/http");
const { getSessionFromRequest } = require("../../_lib/session");
const { fetchLessonById, canEditLesson, patchLesson, normalizeRole } = require("../../_lib/live-lessons");

const labelForStatus = (status) => {
  const s = String(status || "").toLowerCase();
  if (s === "ao_vivo") return "Ao vivo";
  if (s === "pendente_registro") return "Pendente de registro";
  if (s === "realizada") return "Realizada";
  if (s === "falta") return "Falta";
  if (s === "remarcada") return "Remarcada";
  if (s === "cancelada") return "Cancelada";
  if (s === "aguardando_inicio") return "Aguardando inicio";
  return "Agendada";
};

const getRouteId = (req) => {
  const fromQuery = String(req.query?.id || "").trim();
  if (fromQuery) return fromQuery;
  const match = String(req.url || "").match(/\/live-lessons\/([^/?#]+)\/status/);
  return match ? decodeURIComponent(match[1]) : "";
};

module.exports = async (req, res) => {
  if (req.method !== "POST" && req.method !== "PATCH") {
    res.setHeader("Allow", "POST, PATCH");
    sendJson(res, 405, { error: "method_not_allowed" });
    return;
  }

  const session = getSessionFromRequest(req);
  if (!session) {
    sendJson(res, 401, { error: "unauthorized" });
    return;
  }
  if (normalizeRole(session.role) !== "teacher") {
    sendJson(res, 403, { error: "teacher_only" });
    return;
  }

  const id = getRouteId(req);
  const body = await readJsonBody(req).catch(() => null);
  const status = String(body?.status_aula || "").trim().toLowerCase();
  const allowed = new Set(["agendada", "aguardando_inicio", "ao_vivo", "realizada", "falta", "remarcada", "cancelada", "pendente_registro"]);
  if (!id || !allowed.has(status)) {
    sendJson(res, 400, { error: "invalid_payload" });
    return;
  }

  try {
    const lesson = await fetchLessonById(id);
    if (!lesson) {
      sendJson(res, 404, { error: "not_found" });
      return;
    }
    if (!canEditLesson(session, lesson)) {
      sendJson(res, 403, { error: "forbidden" });
      return;
    }
    const updated = await patchLesson(id, { status_aula: status });
    sendJson(res, 200, { lesson: updated, label: labelForStatus(status) });
  } catch (error) {
    console.error("[api] live lesson status failed", error);
    sendJson(res, 500, { error: "status_failed" });
  }
};
