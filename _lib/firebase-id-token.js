const crypto = require("crypto");

const PROJECT_ID = "plataforma-space";
const ISSUER = `https://securetoken.google.com/${PROJECT_ID}`;
const CERTS_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

let cachedCerts = null;
let cachedCertsExpiresAt = 0;

const base64UrlToBuffer = (value) => {
  const raw = String(value || "");
  const padded = raw + "=".repeat((4 - (raw.length % 4)) % 4);
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64");
};

const decodeJwtSegment = (segment) => {
  try {
    return JSON.parse(base64UrlToBuffer(segment).toString("utf8"));
  } catch (error) {
    return null;
  }
};

const fetchJson = async (url) => {
  if (typeof fetch === "function") {
    const res = await fetch(url);
    if (!res.ok) throw new Error("fetch_failed");
    const cacheControl = String(res.headers.get("cache-control") || "");
    const match = cacheControl.match(/max-age=(\d+)/);
    const maxAgeSeconds = match ? Number(match[1]) : 0;
    const data = await res.json();
    return { data, maxAgeSeconds };
  }

  // Fallback for runtimes without fetch.
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line global-require
    const https = require("https");
    https
      .get(url, (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          try {
            if (res.statusCode < 200 || res.statusCode >= 300) {
              reject(new Error("fetch_failed"));
              return;
            }
            const body = Buffer.concat(chunks).toString("utf8");
            const data = JSON.parse(body);
            const cacheControl = String(res.headers["cache-control"] || "");
            const match = cacheControl.match(/max-age=(\d+)/);
            const maxAgeSeconds = match ? Number(match[1]) : 0;
            resolve({ data, maxAgeSeconds });
          } catch (error) {
            reject(error);
          }
        });
      })
      .on("error", reject);
  });
};

const getFirebaseCerts = async () => {
  const now = Date.now();
  if (cachedCerts && now < cachedCertsExpiresAt) {
    return cachedCerts;
  }

  const { data, maxAgeSeconds } = await fetchJson(CERTS_URL);
  if (!data || typeof data !== "object") throw new Error("invalid_certs");

  cachedCerts = data;
  const ttl = Number.isFinite(maxAgeSeconds) && maxAgeSeconds > 0 ? maxAgeSeconds * 1000 : 6 * 60 * 60 * 1000;
  cachedCertsExpiresAt = now + ttl;
  return cachedCerts;
};

const verifyJwtSignature = ({ token, cert }) => {
  const [headerB64, payloadB64, sigB64] = String(token || "").split(".");
  if (!headerB64 || !payloadB64 || !sigB64) return false;
  const signature = base64UrlToBuffer(sigB64);
  const data = Buffer.from(`${headerB64}.${payloadB64}`, "utf8");
  const verifier = crypto.createVerify("RSA-SHA256");
  verifier.update(data);
  verifier.end();
  return verifier.verify(cert, signature);
};

const verifyFirebaseIdToken = async (idToken) => {
  const token = String(idToken || "").trim();
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("invalid_token");
  }

  const header = decodeJwtSegment(parts[0]);
  const payload = decodeJwtSegment(parts[1]);
  if (!header || !payload) {
    throw new Error("invalid_token");
  }

  const kid = typeof header.kid === "string" ? header.kid : "";
  if (!kid) {
    throw new Error("invalid_token");
  }

  const certs = await getFirebaseCerts();
  const cert = certs[kid];
  if (typeof cert !== "string" || !cert) {
    throw new Error("unknown_kid");
  }

  const ok = verifyJwtSignature({ token, cert });
  if (!ok) {
    throw new Error("invalid_signature");
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (payload.aud !== PROJECT_ID) throw new Error("invalid_aud");
  if (payload.iss !== ISSUER) throw new Error("invalid_iss");
  if (typeof payload.sub !== "string" || !payload.sub) throw new Error("invalid_sub");
  if (typeof payload.exp !== "number" || payload.exp <= nowSec) throw new Error("expired");

  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  if (!email) throw new Error("missing_email");

  return {
    uid: payload.sub,
    email,
  };
};

module.exports = { verifyFirebaseIdToken };

