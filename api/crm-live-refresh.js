const { sendJson } = require("../_lib/http");
const { getSessionFromRequest } = require("../_lib/session");
const { requireAdminPermission } = require("./_lib/admin-permissions");
const { runCrmLiveRefresh } = require("./_lib/crm-live-refresh");

const constantTimeEqual = (left, right) => {
  const a = Buffer.from(String(left || ""), "utf8");
  const b = Buffer.from(String(right || ""), "utf8");
  if (a.length !== b.length || a.length === 0) return false;
  return require("crypto").timingSafeEqual(a, b);
};

const normalizeRole = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "admin" || raw === "administrador") return "admin";
  if (raw === "growth") return "growth";
  return "";
};

const canRunRefresh = async (req) => {
  const configured = String(process.env.CRON_SECRET || process.env.CRM_LIVE_REFRESH_SECRET || "").trim();
  const provided = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (configured && constantTimeEqual(provided, configured)) return { ok: true, actor: "cron" };
  const session = getSessionFromRequest(req);
  const role = normalizeRole(session?.role);
  if (role === "admin") {
    const guard = await requireAdminPermission(req, "comercial.crmLive");
    if (!guard.ok) return { ok: false, status: guard.status || 403, error: guard.body?.error || "forbidden" };
    return { ok: true, actor: String(session?.email || session?.sub || role) };
  }
  if (role === "growth") return { ok: true, actor: String(session?.email || session?.sub || role) };
  return { ok: false, status: configured ? 401 : 503, error: configured ? "unauthorized" : "crm_live_refresh_not_configured" };
};

module.exports = async (req, res) => {
  if (!["GET", "POST", "HEAD"].includes(req.method || "")) {
    res.setHeader("Allow", "GET, POST, HEAD");
    return sendJson(res, 405, { error: "method_not_allowed" });
  }
  const auth = await canRunRefresh(req);
  if (!auth.ok) return sendJson(res, auth.status, { error: auth.error });
  try {
    const result = await runCrmLiveRefresh({ owner: auth.actor });
    return sendJson(res, result.skipped ? 202 : 200, result);
  } catch (error) {
    return sendJson(res, error?.status || 500, {
      error: error?.code || error?.message || "crm_live_refresh_failed",
      message: "Não foi possível atualizar o CRM Live agora. O último snapshot válido permanece disponível.",
    });
  }
};
