const { readJsonBody, sendJson } = require("../_lib/http");
const { getSessionFromRequest } = require("../_lib/session");
const { normalizeRole } = require("../_lib/live-lessons");
const { triggerContractSignedOnboarding, listOnboarding } = require("../_lib/pedagogico-n8n");

const isAdmin = (session) => normalizeRole(session?.role) === "admin";

module.exports = async (req, res) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    sendJson(res, 401, { error: "unauthorized" });
    return;
  }
  if (!isAdmin(session)) {
    sendJson(res, 403, { error: "admin_only" });
    return;
  }

  if (req.method === "GET") {
    try {
      const rows = await listOnboarding({ limit: req.query?.limit || 300 });
      sendJson(res, 200, { ok: true, onboarding: rows });
    } catch (error) {
      console.error("[pedagogico] onboarding list failed", error);
      sendJson(res, 500, { error: "onboarding_list_failed" });
    }
    return;
  }

  if (req.method === "POST") {
    const body = await readJsonBody(req).catch(() => null);
    if (!body || typeof body !== "object") {
      sendJson(res, 400, { error: "invalid_json" });
      return;
    }
    const status = String(body.status_contrato || body.status || "").trim().toLowerCase();
    if (status && !["assinado", "signed"].includes(status)) {
      sendJson(res, 200, { ok: true, ignored: true, reason: "contract_not_signed" });
      return;
    }
    try {
      const result = await triggerContractSignedOnboarding(body, { source: "platform" });
      sendJson(res, 200, {
        ok: true,
        ...result,
        warning: result?.n8n?.configured === false ? "Webhook de onboarding não configurado" : undefined,
      });
    } catch (error) {
      console.error("[pedagogico] onboarding trigger failed", error);
      sendJson(res, 500, { error: error?.code || "onboarding_trigger_failed" });
    }
    return;
  }

  res.setHeader("Allow", "GET, POST");
  sendJson(res, 405, { error: "method_not_allowed" });
};
