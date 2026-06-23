const crypto = require("crypto");
const { getSessionFromRequest } = require("../../_lib/session");
const { sendJson } = require("../../_lib/http");
const { requireGrowthAccess } = require("../../_lib/growth-copilot");
const { applyCors } = require("../../_lib/security");

const signToken = (payload) => {
  const secret = String(process.env.SPACE_AUTH_SECRET || "");
  if (secret.length < 16) throw new Error("space_auth_secret_not_configured");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
};

module.exports = async (req, res) => {
  try {
    if (req.method === "OPTIONS") {
      applyCors(req, res);
      res.statusCode = 204;
      res.end("");
      return;
    }
    applyCors(req, res);

    const session = getSessionFromRequest(req);
    requireGrowthAccess(session);
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      sendJson(res, 405, { error: "method_not_allowed" });
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + 20 * 60;
    const sessionId = `sc_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;
    const token = signToken({
      sub: session.sub,
      role: session.role,
      email: session.email,
      scope: "growth_sales_copilot",
      sessionId,
      iat: now,
      exp: expiresAt,
    });

    sendJson(res, 200, {
      token,
      sessionId,
      expiresAt,
      apiBaseUrl: process.env.SPACE_PUBLIC_BASE_URL || "https://space-three-sand.vercel.app",
    });
  } catch (error) {
    console.error("[api] growth copilot realtime-token failed", error);
    sendJson(res, error.status || 500, { error: error.message || "growth_copilot_realtime_token_failed" });
  }
};
