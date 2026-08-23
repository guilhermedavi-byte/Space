const { getSessionFromRequest } = require("../_lib/session");

const sendRedirect = (res, location, cookie) => {
  res.statusCode = 302;
  if (cookie) res.setHeader("Set-Cookie", cookie);
  res.setHeader("Location", location);
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.end("");
};

const deny = (res, { secure = false, clearCookie, message = "Acesso não autorizado." } = {}) => {
  res.statusCode = 401;
  if (typeof clearCookie === "function") res.setHeader("Set-Cookie", clearCookie({ secure }));
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.end(message);
};

const resolveRole = (session, normalizeRole) => {
  if (!session) return "";
  return typeof normalizeRole === "function" ? normalizeRole(session.role) : String(session.role || "").trim().toLowerCase();
};

async function handleLiveTvPageRequest(req, res, {
  routePath,
  cookiePath = "/",
  invalidTokenMessage = "Token inválido ou revogado.",
  unauthorizedMessage = "Acesso não autorizado.",
  normalizeRole,
  sessionRoles = [],
  isSecureRequest,
  validateEntryToken,
  validateCookieViewer,
  clearCookie,
  buildReadCookie,
  buildCookie,
  cookieName,
  buildHtml,
  buildId,
} = {}) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    res.statusCode = 405;
    res.end("Method Not Allowed");
    return;
  }

  const host = String(req.headers.host || "localhost");
  const url = new URL(req.url || routePath || "/tv/live", `https://${host}`);
  const token = String(url.searchParams.get("token") || "").trim();
  const secure = typeof isSecureRequest === "function" ? isSecureRequest(req) : false;

  if (token) {
    const result = await validateEntryToken(token);
    if (!result.ok) {
      res.statusCode = result.status || 401;
      if (typeof clearCookie === "function") res.setHeader("Set-Cookie", clearCookie({ secure, path: cookiePath }));
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.end(invalidTokenMessage);
      return;
    }
    const cookieToken = buildReadCookie({ tokenId: result.tokenId });
    sendRedirect(
      res,
      routePath,
      buildCookie(cookieName, cookieToken, { secure, path: cookiePath })
    );
    return;
  }

  const session = getSessionFromRequest(req);
  const role = resolveRole(session, normalizeRole);
  const allowedBySession = Array.isArray(sessionRoles) && sessionRoles.includes(role);
  const cookieViewer = allowedBySession ? { ok: true } : await validateCookieViewer(req);
  if (!cookieViewer?.ok) {
    deny(res, { secure, clearCookie: (options) => clearCookie({ ...options, path: cookiePath }), message: unauthorizedMessage });
    return;
  }

  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.end(buildHtml({ buildId }));
}

module.exports = {
  handleLiveTvPageRequest,
};
