const crypto = require("crypto");

/*
  Google service account helper (server-side).

  This is used for webhooks (e.g. ZapSign) where we don't have a Firebase user ID token,
  but we still need to update Firestore from a Vercel serverless function.

  Configure on Vercel (recommended):
  - GOOGLE_CLIENT_EMAIL
  - GOOGLE_PRIVATE_KEY   (replace newlines with \n)

  Alternative (also supported):
  - FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY
  - FIREBASE_SERVICE_ACCOUNT_JSON (full JSON string)
*/

const TOKEN_URL = "https://oauth2.googleapis.com/token";

let cachedToken = {
  scope: "",
  accessToken: "",
  expiresAt: 0,
};

const base64Url = (input) =>
  Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const loadServiceAccount = () => {
  const jsonRaw =
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON ||
    process.env.FIREBASE_SERVICE_ACCOUNT ||
    "";

  if (jsonRaw) {
    try {
      const parsed = JSON.parse(String(jsonRaw));
      const email = String(parsed.client_email || "").trim();
      const key = String(parsed.private_key || "").trim();
      if (email && key) return { clientEmail: email, privateKey: key };
    } catch (error) {
      // ignore
    }
  }

  const email =
    String(process.env.GOOGLE_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL || process.env.FIREBASE_SERVICE_ACCOUNT_EMAIL || "").trim();
  let key = String(process.env.GOOGLE_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY || process.env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY || "").trim();
  if (!email || !key) return null;

  // Vercel envs often store newlines as `\n`.
  key = key.replace(/\\n/g, "\n");
  return { clientEmail: email, privateKey: key };
};

const signJwt = ({ header, payload, privateKey }) => {
  const encodedHeader = base64Url(JSON.stringify(header));
  const encodedPayload = base64Url(JSON.stringify(payload));
  const data = Buffer.from(`${encodedHeader}.${encodedPayload}`, "utf8");
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(data);
  signer.end();
  const signature = signer.sign(privateKey);
  const encodedSig = base64Url(signature);
  return `${encodedHeader}.${encodedPayload}.${encodedSig}`;
};

const requestForm = async (url, body) => {
  const formBody = typeof body === "string" ? body : String(body || "");
  if (typeof fetch === "function") {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formBody,
    });
    const text = await res.text().catch(() => "");
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (error) {
      data = null;
    }
    return { ok: res.ok, status: res.status, data };
  }

  return new Promise((resolve, reject) => {
    // eslint-disable-next-line global-require
    const https = require("https");
    const parsed = new URL(url);
    const req = https.request(
      parsed,
      { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" } },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const status = Number(res.statusCode) || 0;
          const ok = status >= 200 && status < 300;
          const text = Buffer.concat(chunks).toString("utf8");
          let data = null;
          try {
            data = text ? JSON.parse(text) : null;
          } catch (error) {
            data = null;
          }
          resolve({ ok, status, data });
        });
      }
    );
    req.on("error", reject);
    req.write(formBody);
    req.end();
  });
};

const getGoogleAccessToken = async ({ scope }) => {
  const wantedScope = String(scope || "").trim();
  if (!wantedScope) throw new Error("missing_scope");

  const now = Date.now();
  if (cachedToken.accessToken && cachedToken.scope === wantedScope && cachedToken.expiresAt > now + 30_000) {
    return { accessToken: cachedToken.accessToken, expiresAt: cachedToken.expiresAt };
  }

  const sa = loadServiceAccount();
  if (!sa) throw new Error("missing_service_account");

  const iat = Math.floor(now / 1000);
  const exp = iat + 60 * 60;

  const assertion = signJwt({
    header: { alg: "RS256", typ: "JWT" },
    payload: {
      iss: sa.clientEmail,
      scope: wantedScope,
      aud: TOKEN_URL,
      iat,
      exp,
    },
    privateKey: sa.privateKey,
  });

  const params = new URLSearchParams();
  params.set("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer");
  params.set("assertion", assertion);

  const res = await requestForm(TOKEN_URL, params.toString());
  if (!res.ok) throw new Error("oauth_token_failed");

  const token = String(res.data?.access_token || "").trim();
  const expiresIn = Number(res.data?.expires_in) || 0;
  if (!token) throw new Error("oauth_token_missing");

  cachedToken = {
    scope: wantedScope,
    accessToken: token,
    expiresAt: now + Math.max(60_000, expiresIn * 1000),
  };

  return { accessToken: cachedToken.accessToken, expiresAt: cachedToken.expiresAt };
};

module.exports = { getGoogleAccessToken };

