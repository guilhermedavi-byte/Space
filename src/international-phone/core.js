// Shared by browser, APIs and maintenance scripts. No provider-specific identities here.
const { parsePhoneNumberFromString, validatePhoneNumberLength, getCountries, getCountryCallingCode, AsYouType } = require('libphonenumber-js/max');
const countries = getCountries();
const clean = value => String(value ?? '').trim();
const flag = country => country && countries.includes(country) ? [...country].map(c => String.fromCodePoint(c.charCodeAt(0) + 127397)).join('') : '';
const parse = (value, country) => {
  try { return parsePhoneNumberFromString(value, { defaultCountry: country, extract: false }); } catch { return undefined; }
};
function inspectPhone(value, { defaultCountry, preferCountry = false } = {}) {
  const raw = clean(value);
  if (!raw) return { state: 'empty', raw, e164: '', country: null };
  // Reject prose, extensions and identity/JID values; formatting punctuation is allowed.
  if (raw.length > 80 || !/^[+\d\s().-]+$/.test(raw)) return { state: 'invalid', raw, e164: '', country: null };
  const digits = raw.replace(/\D/g, '');
  const explicit = raw.startsWith('+');
  const international = parse(explicit ? raw : `+${digits}`);
  const national = defaultCountry && countries.includes(defaultCountry) ? parse(raw, defaultCountry) : undefined;
  const valid = p => p?.isValid() && !p.ext;
  let phone;
  if (explicit) phone = international;
  else if (preferCountry && valid(national)) phone = national;
  else if (valid(international)) {
    // An unlabelled legacy national number can overlap another country's calling code.
    const local = national || parse(raw, 'BR');
    if (valid(local) && local.number !== international.number) return { state: 'ambiguous', raw, e164: '', country: null };
    phone = international;
  } else if (defaultCountry && valid(national)) phone = national;
  else phone = explicit ? international : national;
  if (!valid(phone)) {
    let reason;
    try { reason = validatePhoneNumberLength(explicit ? raw : digits, defaultCountry); } catch {}
    return { state: reason === 'TOO_SHORT' ? 'incomplete' : 'invalid', raw, e164: '', country: null };
  }
  return { state: 'valid', raw, e164: phone.number, country: phone.country || null, callingCode: phone.countryCallingCode,
    national: phone.formatNational(), display: phone.formatInternational(), flag: flag(phone.country) };
}
const normalizePhoneToE164 = (value, options) => inspectPhone(value, options).e164;
const formatPhoneForDisplay = (value, options = {}) => {
  const result = inspectPhone(value, options);
  return result.e164 ? `${options.flag === false || !result.flag ? '' : result.flag + ' '}${result.display}` : clean(value);
};
const phonesMatch = (a, b, options) => {
  const phone = normalizePhoneToE164(a, options);
  return !!phone && phone === normalizePhoneToE164(b, options);
};
function requirePhone(value, options = {}) {
  const result = inspectPhone(value, options);
  if (result.state === 'empty' && !options.required) return '';
  if (!result.e164) throw Object.assign(new Error('Número de telefone inválido.'), { code: 'invalid_phone_number', status: 400 });
  return result.e164;
}
module.exports = { inspectPhone, normalizePhoneToE164, formatPhoneForDisplay, phonesMatch, requirePhone, flag, countries, getCountryCallingCode, AsYouType };
