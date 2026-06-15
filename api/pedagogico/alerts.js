const { readJsonBody, sendJson } = require("../_lib/http");
const { getSessionFromRequest } = require("../_lib/session");
const { normalizeRole } = require("../_lib/live-lessons");
const { listAlerts, resolveAlert } = require("../_lib/pedagogico-n8n");

const canUseAlerts = (session) => {
  const role = normalizeRole(session?.role);
  return role === "admin" || role === "teacher";
};

module.exports = async (req, res) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    sendJson(res, 401, { error: "unauthorized" });
    return;
  }
  if (!canUseAlerts(session)) {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }

  if (req.method === "GET") {
    try {
      const alerts = await listAlerts({ limit: req.query?.limit || 300 });
      sendJson(res, 200, { ok: true, alerts });
    } catch (error) {
      console.error("[pedagogico] alerts list failed", error);
      sendJson(res, 500, { error: "alerts_list_failed" });
    }
    return;
  }

  if (req.method === "PATCH" || req.method === "POST") {
    const body = await readJsonBody(req).catch(() => null);
    if (!body?.id) {
      sendJson(res, 400, { error: "missing_alert_id" });
      return;
    }
    try {
      const alert = await resolveAlert({
        id: body.id,
        observacao: body.observacao || body.observacao_resolucao || "",
        resolvedBy: session.name || session.email || session.sub || "",
      });
      sendJson(res, 200, { ok: true, alert });
    } catch (error) {
      console.error("[pedagogico] alert resolve failed", error);
      sendJson(res, 500, { error: "alert_resolve_failed" });
    }
    return;
  }

  res.setHeader("Allow", "GET, POST, PATCH");
  sendJson(res, 405, { error: "method_not_allowed" });
};
