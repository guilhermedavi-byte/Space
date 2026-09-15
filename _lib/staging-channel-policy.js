// Staging defaults to no recipients. Call this at the sending boundary of any future channel.
const fields = {
  email: 'STAGING_EMAIL_ALLOWLIST', whatsapp: 'STAGING_WHATSAPP_ALLOWLIST',
  sms: 'STAGING_SMS_ALLOWLIST', admin: 'STAGING_ADMIN_EMAIL_ALLOWLIST',
};
const normalize = (channel, value) => ['email', 'admin'].includes(channel) ? value.trim().toLowerCase() : value.trim();
function stagingChannelPolicy(env = process.env) {
  const lists = {};
  for (const [channel, field] of Object.entries(fields)) {
    const values = String(env[field] || '').split(',').map(value => normalize(channel, value)).filter(Boolean);
    const valid = ['email', 'admin'].includes(channel) ? /^[^\s@*]+@[^\s@*]+\.[^\s@*]+$/ : /^\+[1-9][0-9]{7,14}$/;
    if (values.some(value => !valid.test(value))) throw new Error('staging_channel_allowlist_invalid');
    lists[channel] = [...new Set(values)];
  }
  return lists;
}
function assertStagingRecipientAllowed(channel, recipient, env = process.env) {
  if (env.APP_ENV !== 'staging' || !Object.hasOwn(fields, channel) || typeof recipient !== 'string'
    || !stagingChannelPolicy(env)[channel].includes(normalize(channel, recipient))) {
    throw new Error('staging_recipient_not_allowed');
  }
}
module.exports = { stagingChannelPolicy, assertStagingRecipientAllowed };
