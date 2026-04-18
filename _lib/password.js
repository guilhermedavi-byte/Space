const crypto = require("crypto");

const safeEqual = (a, b) => {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) return false;
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};

const verifyPassword = (password, passwordHash) => {
  const raw = String(passwordHash || "");
  const parts = raw.split("$");
  // pbkdf2$sha256$210000$saltB64$hashB64
  if (parts.length !== 5) return false;
  const [kind, algo, iterationsRaw, saltB64, hashB64] = parts;
  if (kind !== "pbkdf2") return false;
  const iterations = Number(iterationsRaw);
  if (!Number.isFinite(iterations) || iterations < 50_000) return false;

  let salt;
  let expected;
  try {
    salt = Buffer.from(String(saltB64 || ""), "base64");
    expected = Buffer.from(String(hashB64 || ""), "base64");
  } catch (error) {
    return false;
  }
  if (!salt.length || !expected.length) return false;

  const derived = crypto.pbkdf2Sync(String(password || ""), salt, iterations, expected.length, algo);
  return safeEqual(derived, expected);
};

module.exports = { verifyPassword };

