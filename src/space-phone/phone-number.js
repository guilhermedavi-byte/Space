const { parsePhoneNumberFromString } = require('libphonenumber-js/min');

const DEFAULT_COUNTRY = 'US';

function normalizeDefaultCountry(value) {
  const raw = String(value || '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(raw) ? raw : DEFAULT_COUNTRY;
}

function normalizePhoneNumber(value, options = {}) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const defaultCountry = normalizeDefaultCountry(options.defaultCountry || (typeof process !== 'undefined' ? process.env?.SPACE_PHONE_DEFAULT_COUNTRY : '') || DEFAULT_COUNTRY);
  const phone = parsePhoneNumberFromString(raw, raw.startsWith('+') ? undefined : defaultCountry);
  if (!phone || !phone.isValid()) return '';
  return phone.number;
}

module.exports = { DEFAULT_COUNTRY, normalizeDefaultCountry, normalizePhoneNumber };
