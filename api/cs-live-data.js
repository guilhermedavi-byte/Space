const { sendJson } = require("../_lib/http");
const { getSessionFromRequest } = require("../_lib/session");
const { getCsLiveProvider } = require("./_lib/cs-live-provider");
const { getCsLiveBuildId } = require("./_lib/cs-live-build");
const { validateCookieViewer } = require("./_lib/cs-live-auth");

const normalizeRole = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "admin" || raw === "administrador") return "admin";
  if (raw === "teacher" || raw === "professor") return "teacher";
  if (raw === "pedagogico" || raw === "pedagógico") return "pedagogico";
  return "";
};

const canReadViaSession = (req) => {
  const session = getSessionFromRequest(req);
  const role = normalizeRole(session?.role);
  if (role === "admin" || role === "teacher" || role === "pedagogico") return { ok: true, mode: "session", session };
  return null;
};

module.exports = async (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return sendJson(res, 405, { error: "method_not_allowed" });
  }

  const bySession = canReadViaSession(req);
  const auth = bySession || await validateCookieViewer(req);
  if (!auth?.ok) return sendJson(res, auth?.status || 401, { error: auth?.error || "unauthorized" });

  try {
    const provider = getCsLiveProvider();
    const snapshot = await provider.getSnapshot();
    return sendJson(res, 200, {
      ...snapshot,
      stale: false,
      staleAgeMinutes: 0,
      snapshotGeneratedAt: String(snapshot.generatedAt || ""),
      buildId: getCsLiveBuildId(),
    });
  } catch (error) {
    return sendJson(res, 500, {
      error: "cs_live_payload_failed",
      message: error?.message || "Não foi possível montar o payload do CS Live agora.",
    });
  }
};
