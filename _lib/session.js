const crypto = require("crypto");

const COOKIE_NAME = "space_session";

const base64url = (input) => {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(String(input), "utf8");
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
};

const decodeBase64urlJson = (b64url) => {
  const padded = String(b64url || "").replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (padded.length % 4)) % 4;
  const withPad = padded + "=".repeat(padLen);
  const raw = Buffer.from(withPad, "base64").toString("utf8");
  return JSON.parse(raw);
};

const getSecret = () => {
  const env = process.env.SPACE_AUTH_SECRET;
  if (env && env.length >= 16) return env;
  // Dev fallback (do not use in production).
  return "space_dev_secret_change_me_please";
};

const signJwt = (payload) => {
  const header = { alg: "HS256", typ: "JWT" };
  const headerPart = base64url(JSON.stringify(header));
  const payloadPart = base64url(JSON.stringify(payload));
  const data = `${headerPart}.${payloadPart}`;
  const signature = crypto.createHmac("sha256", getSecret()).update(data).digest();
  return `${data}.${base64url(signature)}`;
};

const verifyJwt = (token) => {
  const raw = String(token || "");
  const parts = raw.split(".");
  if (parts.length !== 3) return null;
  const [headerPart, payloadPart, sigPart] = parts;
  if (!headerPart || !payloadPart || !sigPart) return null;
  let header;
  let payload;
  try {
    header = decodeBase64urlJson(headerPart);
    payload = decodeBase64urlJson(payloadPart);
  } catch (error) {
    return null;
  }
  if (!header || header.alg !== "HS256") return null;

  const data = `${headerPart}.${payloadPart}`;
  const expected = base64url(crypto.createHmac("sha256", getSecret()).update(data).digest());
  try {
    const expectedBuf = Buffer.from(expected, "utf8");
    const sigBuf = Buffer.from(sigPart, "utf8");
    if (expectedBuf.length !== sigBuf.length) return null;
    if (!crypto.timingSafeEqual(expectedBuf, sigBuf)) return null;
  } catch (error) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload && typeof payload.exp === "number" && payload.exp < now) return null;
  return payload || null;
};

const parseCookies = (req) => {
  const header = String(req.headers.cookie || "");
  const pairs = header.split(";").map((p) => p.trim()).filter(Boolean);
  const out = {};
  for (const pair of pairs) {
    const idx = pair.indexOf("=");
    if (idx < 0) continue;
    const k = pair.slice(0, idx).trim();
    const v = pair.slice(idx + 1).trim();
    out[k] = decodeURIComponent(v);
  }
  return out;
};

const isSecureRequest = (req) => {
  const forwarded = String(req.headers["x-forwarded-proto"] || "").toLowerCase();
  if (forwarded) return forwarded === "https";
  return false;
};

const buildSessionCookie = (token, { maxAgeSeconds, secure = false } = {}) => {
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.max(0, Number(maxAgeSeconds) || 0)}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
};

const buildClearCookie = ({ secure = false } = {}) => {
  const parts = [`${COOKIE_NAME}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (secure) parts.push("Secure");
  return parts.join("; ");
};

const getSessionFromRequest = (req) => {
  const cookies = parseCookies(req);
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  const payload = verifyJwt(token);
  if (!payload) return null;
  return payload;
};

const createSessionForUser = (user) => {
  const now = Math.floor(Date.now() / 1000);
  const maxAgeSeconds = 7 * 24 * 60 * 60;
  const payload = {
    sub: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
    iat: now,
    exp: now + maxAgeSeconds,
  };
  const token = signJwt(payload);
  return { token, maxAgeSeconds, payload };
};

module.exports = {
  COOKIE_NAME,
  buildSessionCookie,
  buildClearCookie,
  getSessionFromRequest,
  createSessionForUser,
  isSecureRequest,
};
