const { createHash } = require('node:crypto');
const policy = require('../config/attendance-staging-targets.json');

const digest = (value) => createHash('sha256').update(value).digest('hex');
const deny = (reason) => {
  throw Object.assign(new Error(`attendance_environment_${reason}`), { code: `attendance_environment_${reason}`, status: 503 });
};
const required = (env, key) => {
  if (typeof env[key] !== 'string' || !env[key] || env[key] !== env[key].trim()) deny('missing_or_invalid_configuration');
  return env[key];
};
const project = (raw) => {
  let url;
  try { url = new URL(raw); } catch { deny('invalid_url'); }
  if (url.protocol !== 'https:' || url.port || url.username || url.password || url.search || url.hash
    || url.pathname !== '/' || !/^[a-z0-9]{20}\.supabase\.co$/.test(url.hostname)) deny('invalid_url');
  return { ref: url.hostname.split('.')[0], url: url.origin };
};

// Configuration validation, not authentication of the operator. Allowlist changes need review.
// Secret hashes bind opaque keys too; decoding a JWT alone would NOT prove its provenance.
const assertAttendanceTarget = (env = process.env, targets = policy) => {
  if (env.APP_ENV === 'production') return assertAttendanceProductionTarget(env, targets);
  if (env.APP_ENV !== 'staging' || env.SUPABASE_ENV_SCOPE !== 'staging') deny('requires_staging');
  for (const name of ['SPACE_ENV', 'SPACE_APP_ENV']) {
    if (env[name] && env[name] !== 'staging') deny('conflicting_environment');
  }
  for (const name of ['VERCEL_ENV', 'VERCEL_TARGET_ENV']) {
    if (env[name] && !['preview', 'staging'].includes(env[name])) deny('conflicting_environment');
  }
  // NODE_ENV=production is normal in a staging Vercel build; never use it as environment identity.
  const current = project(required(env, 'SUPABASE_URL'));
  const stage = project(required(env, 'SPACE_STAGING_SUPABASE_URL'));
  const prod = project(required(env, 'SPACE_PRODUCTION_SUPABASE_URL'));
  const denied = targets.productionProjectRefSha256;
  if (!Array.isArray(denied) || !denied.length || !denied.includes(digest(prod.ref))) deny('unknown_production_reference');
  if (denied.includes(digest(current.ref)) || current.ref === prod.ref) deny('production_target');
  if (current.ref !== stage.ref || current.ref !== required(env, 'ATTENDANCE_STAGING_PROJECT_REF')) deny('target_mismatch');
  if (env.NEXT_PUBLIC_SUPABASE_URL && project(env.NEXT_PUBLIC_SUPABASE_URL).ref !== current.ref) deny('conflicting_url');
  const matches = (targets.staging || []).filter((entry) => entry.projectRef === current.ref);
  if (matches.length !== 1) deny('target_not_allowlisted');
  const entry = matches[0];
  const key = required(env, 'SUPABASE_SERVICE_ROLE_KEY');
  if (!/^[a-f0-9]{64}$/.test(entry.serviceRoleKeySha256 || '') || digest(key) !== entry.serviceRoleKeySha256) deny('credential_mismatch');
  if (env.SUPABASE_SERVICE_KEY && env.SUPABASE_SERVICE_KEY !== key) deny('credential_mismatch');
  if (!key.startsWith('sb_secret_')) {
    let payload;
    try { payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()); } catch { deny('invalid_service_credential'); }
    if (key.split('.').length !== 3 || payload.role !== 'service_role' || payload.ref !== current.ref
      || !Number.isFinite(payload.exp) || payload.exp <= Date.now() / 1000) deny('invalid_service_credential');
  }
  return { ...current, entry, maskedRef: `${current.ref.slice(0, 3)}…${current.ref.slice(-3)}` };
};

// Temporary executive authorization, scoped to Attendance and the independently pinned main project.
const assertAttendanceProductionTarget = (env, targets = policy) => {
  if (env.ATTENDANCE_ALLOW_PRODUCTION_MUTATIONS !== 'true') deny('production_authorization_required');
  if (env.SUPABASE_ENV_SCOPE !== 'production') deny('conflicting_environment');
  for (const name of ['SPACE_ENV', 'SPACE_APP_ENV', 'VERCEL_ENV', 'VERCEL_TARGET_ENV']) {
    if (env[name] && env[name] !== 'production') deny('conflicting_environment');
  }
  const current = project(required(env, 'SUPABASE_URL'));
  const expected = project(required(env, 'SPACE_PRODUCTION_SUPABASE_URL'));
  const entry = targets.production;
  if (!entry || entry.projectRefSha256 !== digest(current.ref)
    || !targets.productionProjectRefSha256?.includes(digest(current.ref))) deny('target_not_allowlisted');
  if (current.ref !== expected.ref || required(env, 'ATTENDANCE_PRODUCTION_PROJECT_REF') !== current.ref) deny('target_mismatch');
  if (env.SPACE_STAGING_SUPABASE_URL && project(env.SPACE_STAGING_SUPABASE_URL).ref === current.ref) deny('conflicting_url');
  if (env.NEXT_PUBLIC_SUPABASE_URL && project(env.NEXT_PUBLIC_SUPABASE_URL).ref !== current.ref) deny('conflicting_url');
  const key = required(env, 'SUPABASE_SERVICE_ROLE_KEY');
  if (!/^[a-f0-9]{64}$/.test(entry.serviceRoleKeySha256 || '') || digest(key) !== entry.serviceRoleKeySha256
    || (env.SUPABASE_SERVICE_KEY && env.SUPABASE_SERVICE_KEY !== key)) deny('credential_mismatch');
  if (!key.startsWith('sb_secret_')) {
    let payload;
    try { payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()); } catch { deny('invalid_service_credential'); }
    if (key.split('.').length !== 3 || payload.role !== 'service_role' || payload.ref !== current.ref
      || !Number.isFinite(payload.exp) || payload.exp <= Date.now() / 1000) deny('invalid_service_credential');
  }
  return { ...current, entry, environment: 'production', maskedRef: `${current.ref.slice(0, 3)}…${current.ref.slice(-3)}` };
};

const assertAttendanceOperation = (env, options, targets = policy) => {
  const target = assertAttendanceTarget(env, targets);
  const production = target.environment === 'production';
  const scope = production ? 'production' : 'staging';
  if (options.environment !== scope || options.confirm !== true
    || env[production ? 'ATTENDANCE_PRODUCTION_CONFIRM' : 'ATTENDANCE_STAGING_CONFIRM'] !== `${scope}:${target.ref}`) deny('confirmation_required');
  let db;
  try { db = new URL(required(env, production ? 'ATTENDANCE_PRODUCTION_DATABASE_URL' : 'ATTENDANCE_STAGING_DATABASE_URL')); } catch { deny('invalid_database_target'); }
  // Direct connection only: no pooler, custom host, URI options or libpq fallback.
  if (!['postgres:', 'postgresql:'].includes(db.protocol) || db.hostname !== `db.${target.ref}.supabase.co`
    || (db.port && db.port !== '5432') || db.pathname !== '/postgres' || db.username !== 'postgres'
    || !db.password || db.search || db.hash) deny('invalid_database_target');
  let password;
  try { password = decodeURIComponent(db.password); } catch { deny('invalid_database_target'); }
  if (!/^[a-f0-9]{64}$/.test(target.entry.databasePasswordSha256 || '')
    || digest(password) !== target.entry.databasePasswordSha256) deny('database_credential_mismatch');
  return { ...target, database: { host: db.hostname, password } };
};

module.exports = { assertAttendanceTarget, assertAttendanceOperation, digest };
