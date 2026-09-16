const crypto = require("crypto");

const clean = (value) => String(value || "").trim();

const normalizeEmail = (value) => {
  const raw = clean(value).toLowerCase();
  if (!raw) return "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw) ? raw : "";
};

const normalizePhone = (value, { defaultCountryCode = "55" } = {}) => {
  const raw = clean(value);
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (raw.startsWith("+")) return `+${digits}`;
  if (defaultCountryCode === "55" && (digits.length === 10 || digits.length === 11) && !digits.startsWith("0")) {
    return `+55${digits}`;
  }
  if (defaultCountryCode === "1" && digits.length === 10 && /^[2-9]/.test(digits)) {
    return `+1${digits}`;
  }
  return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : "";
};

const normalizeCrmContactIdentity = (contact = {}) => ({
  phone: normalizePhone(contact.phone || contact.telefone || contact.whatsapp || contact.normalized_phone || contact.phone_raw),
  email: normalizeEmail(contact.email),
});

const identitiesMatch = (left = {}, right = {}) => {
  const a = normalizeCrmContactIdentity(left);
  const b = normalizeCrmContactIdentity(right);
  if (a.phone && b.phone && a.phone === b.phone) return true;
  if (a.email && b.email && a.email === b.email) return true;
  return false;
};

const stableIdFromKey = (prefix, key, length = 24) => {
  const hash = crypto.createHash("sha256").update(clean(key), "utf8").digest("hex").slice(0, length);
  return `${prefix}_${hash}`;
};

module.exports = {
  identitiesMatch,
  normalizeCrmContactIdentity,
  normalizeEmail,
  normalizePhone,
  stableIdFromKey,
};
