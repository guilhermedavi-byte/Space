const { sendJson } = require("./_lib/http");
const { getSessionFromRequest } = require("./_lib/session");
const { listCollectionAsAdmin } = require("./_lib/firestore-admin");
const { isMentionableUser, normalizeRole, normalizeUser } = require("./_lib/notification-service");

const safeText = (value) => String(value || "").trim();
const normalizeSearchText = (value) =>
  safeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const canUseMentions = (session) => {
  const role = normalizeRole(session?.role);
  return Boolean(session?.sub && ["admin", "teacher", "growth", "FINANCE"].includes(role));
};

module.exports = async (req, res) => {
  const session = getSessionFromRequest(req);
  if (!session) return sendJson(res, 401, { error: "unauthorized" });
  if (!canUseMentions(session)) return sendJson(res, 403, { error: "forbidden" });
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { error: "method_not_allowed" });
  }
  const host = String(req.headers.host || "localhost");
  const url = new URL(req.url || "/api/mentions", `https://${host}`);
  const q = normalizeSearchText(url.searchParams.get("q"));
  const limit = Math.max(1, Math.min(Number(url.searchParams.get("limit")) || 8, 20));
  try {
    const rows = await listCollectionAsAdmin("users", { pageSize: 1500, decorate: false });
    const users = rows
      .filter(isMentionableUser)
      .map(normalizeUser)
      .filter((user) => {
        if (!q) return true;
        return normalizeSearchText(`${user.displayName} ${user.email}`).includes(q);
      })
      .sort((a, b) => a.displayName.localeCompare(b.displayName, "pt-BR"))
      .slice(0, limit)
      .map((user) => ({
        id: user.id,
        displayName: user.displayName,
        email: user.email,
        role: user.role,
        photoURL: user.photoURL,
      }));
    return sendJson(res, 200, { users });
  } catch (error) {
    console.error("[api] mentions failed", error);
    return sendJson(res, 500, { error: "mentions_failed" });
  }
};
