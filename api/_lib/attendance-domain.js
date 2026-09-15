const { assertEnvironmentIsolation } = require('../../_lib/runtime-env');

const fail = (code = 'attendance_invalid_request', status = 422) => {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  throw error;
};
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const uuid = (value) => {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) fail();
  return value;
};
const text = (value, max = 128) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max) fail();
  return value;
};
const integer = (value, min, max) => {
  if (!Number.isSafeInteger(value) || value < min || value > max) fail();
  return value;
};
const only = (value, keys) => {
  if (!object(value) || Object.keys(value).some((key) => !keys.includes(key))) fail();
  return value;
};
const metadata = (value = {}) => {
  if (!object(value) || Buffer.byteLength(JSON.stringify(value)) > 8192) fail('attendance_invalid_metadata');
  for (const [key, item] of Object.entries(value)) {
    if (/(token|secret|password|authorization|credential|api.?key)/i.test(key) || Array.isArray(item)) fail('attendance_invalid_metadata');
    if (object(item)) metadata(item);
  }
  return value;
};

// Narrower than the platform guard: foundation is staging-only until explicitly promoted.
const assertAttendanceEnvironment = (env = process.env) => {
  if (env.ATTENDANCE_FOUNDATION_ENABLED !== 'true') fail('attendance_foundation_disabled', 409);
  const clean = (value) => String(value || '').trim().replace(/\/+$/, '');
  const current = clean(env.SUPABASE_URL);
  if (env.APP_ENV !== 'staging' || env.SUPABASE_ENV_SCOPE !== 'staging' || !current
    || current !== clean(env.SPACE_STAGING_SUPABASE_URL) || !clean(env.SPACE_PRODUCTION_SUPABASE_URL)
    || current === clean(env.SPACE_PRODUCTION_SUPABASE_URL)) fail('attendance_staging_not_verified', 503);
  assertEnvironmentIsolation(env);
};

const validateMessage = (input) => {
  only(input, ['client_request_id', 'direction', 'kind', 'content', 'reply_to_message_id', 'metadata']);
  text(input.client_request_id);
  const direction = input.direction || 'outbound';
  if (!['outbound', 'internal'].includes(direction)) fail();
  const kind = input.kind || 'text';
  if (!/^[a-z][a-z0-9_]{0,63}$/.test(kind) || !object(input.content)
    || Buffer.byteLength(JSON.stringify(input.content)) > 65536) fail();
  if (kind === 'text') text(input.content.text, 16000);
  if (input.reply_to_message_id != null) uuid(input.reply_to_message_id);
  return { ...input, direction, kind, metadata: metadata(input.metadata) };
};

const validateInbound = (input) => {
  only(input, ['connection_id', 'channel_id', 'provider', 'external_message_id', 'external_event_id', 'external_contact_id',
    'identifier_type', 'display_name', 'phone_raw', 'country_calling_code', 'external_conversation_id', 'external_reply_to_id',
    'kind', 'content', 'provider_timestamp', 'metadata']);
  uuid(input.connection_id); uuid(input.channel_id);
  for (const key of ['provider', 'external_message_id', 'external_contact_id']) text(input[key], 256);
  if (input.external_event_id != null) text(input.external_event_id, 512);
  if (input.phone_raw != null && (typeof input.phone_raw !== 'string' || input.phone_raw.length > 64)) fail();
  if (input.provider_timestamp != null && !Number.isFinite(Date.parse(input.provider_timestamp))) fail();
  if (!object(input.content) || Buffer.byteLength(JSON.stringify(input.content)) > 65536) fail();
  return { ...input, metadata: metadata(input.metadata) };
};

const validateCommand = (input, { allowIdentity = false } = {}) => {
  const fields = {
    assignment: ['team_id', 'assigned_user_uid'], status: ['status'], metadata: ['metadata'],
    identity: ['resolution_state', 'internal_source', 'internal_person_type', 'internal_person_id', 'resolution_origin'],
  };
  if (!object(input) || !fields[input.action] || (input.action === 'identity' && !allowIdentity)) fail();
  only(input, ['action', 'client_action_id', 'expected_version', ...fields[input.action]]);
  text(input.client_action_id); integer(input.expected_version, 1, Number.MAX_SAFE_INTEGER);
  if (input.action === 'assignment') {
    if (input.team_id != null) uuid(input.team_id);
    if (input.assigned_user_uid != null) text(input.assigned_user_uid);
    if (!Object.hasOwn(input, 'assigned_user_uid')) fail();
  }
  if (input.action === 'status' && !['open', 'pending', 'resolved'].includes(input.status)) fail();
  if (input.action === 'metadata') metadata(input.metadata);
  return input;
};

module.exports = { fail, uuid, text, integer, only, metadata, assertAttendanceEnvironment, validateMessage, validateInbound, validateCommand };
