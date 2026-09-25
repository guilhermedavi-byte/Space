const crypto = require("crypto");

const clean = (value) => String(value || "").trim();

const normalizeEmail = (value) => {
  const raw = clean(value).toLowerCase();
  if (!raw) return "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw) ? raw : "";
};

const { normalizePhoneToE164 } = require('../../src/international-phone/core');
const normalizePhone = (value, { defaultCountryCode = '55', defaultCountry } = {}) => normalizePhoneToE164(value, {
  defaultCountry: defaultCountry || ({'55':'BR','1':'US','351':'PT'})[defaultCountryCode], preferCountry: true,
});

const normalizeCrmContactIdentity = (contact = {}) => ({
  phone: normalizePhone(contact.phone || contact.telefone || contact.whatsapp || contact.normalized_phone || contact.phone_raw, { defaultCountry: contact.countryCode || contact.country_code }),
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
