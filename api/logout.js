const { sendJson } = require("./_lib/http");
const { buildClearCookie, isSecureRequest } = require("./_lib/session");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "method_not_allowed" });
  }

  const cookie = buildClearCookie({ secure: isSecureRequest(req) });
  res.setHeader("Set-Cookie", cookie);
  return sendJson(res, 200, { ok: true });
};
