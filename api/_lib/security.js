const crypto = require("crypto");

const firstHeader = (req, names) => {
  for (const name of names) {
    const value = String(req?.headers?.[name] || "").trim();
    if (value) return value;
  }
  return "";
};

const timingSafeTextEqual = (left, right) => {
  const a = Buffer.from(String(left || ""), "utf8");
  const b = Buffer.from(String(right || ""), "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

const getRequestSecret = (req) => {
  const bearer = String(req?.headers?.authorization || "").match(/^Bearer\s+(.+)$/i);
  const headerSecret = firstHeader(req, [
    "asaas-access-token",
    "x-asaas-token",
    "x-zapsign-token",
    "x-zapsign-signature",
    "x-webhook-secret",
  ]);
  if (headerSecret) return headerSecret;
  if (bearer?.[1]) return String(bearer[1]).trim();

  try {
    const host = String(req?.headers?.host || "localhost");
    const url = new URL(req?.url || "/", `https://${host}`);
    return String(url.searchParams.get("token") || url.searchParams.get("secret") || "").trim();
  } catch {
    return "";
  }
};

const validateWebhookSecret = (req, configuredSecret) => {
  const expected = String(configuredSecret || "").trim();
  if (!expected) return { ok: false, error: "webhook_secret_not_configured", status: 503 };
  const received = getRequestSecret(req);
  if (!received || !timingSafeTextEqual(received, expected)) {
    return { ok: false, error: "invalid_webhook_secret", status: 401 };
  }
  return { ok: true };
};

const applyCors = (req, res) => {
  const origin = String(req?.headers?.origin || "").trim();
  const configured = String(process.env.SPACE_PUBLIC_BASE_URL || "").replace(/\/+$/, "");
  const allowed = new Set([
    "https://plataforma.spaceschoolbr.com",
    "https://spaceschoolbr.com",
    configured,
  ]);
  const safeOrigin =
    allowed.has(origin) || /^chrome-extension:\/\/[a-p]{32}$/i.test(origin)
      ? origin
      : "https://plataforma.spaceschoolbr.com";
  res.setHeader("Access-Control-Allow-Origin", safeOrigin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Copilot-Token");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
};

module.exports = {
  applyCors,
  timingSafeTextEqual,
  validateWebhookSecret,
};
