const fs = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('node:util');
const { spawnSync } = require('node:child_process');
const { assertAttendanceOperation, digest } = require('../_lib/attendance-environment');
const root = path.resolve(__dirname, '..');
const migrationPath = path.join(root, 'supabase/migrations/202609140001_attendance_foundation.sql');
const inventorySql = fs.readFileSync(path.join(__dirname, 'attendance-schema-inventory.sql'), 'utf8');
const fail = (code) => { throw Object.assign(new Error(code), { code }); };

const parseArguments = (args) => {
  const options = {};
  const allowed = new Set(['mode', 'env-file', 'environment', 'review-file', 'output']);
  for (const arg of args) {
    if (arg === '--confirm-staging' && !options.confirm) { options.confirm = true; continue; }
    const match = /^--([a-z-]+)=(.+)$/.exec(arg);
    if (!match || !allowed.has(match[1]) || Object.hasOwn(options, match[1])) fail('attendance_invalid_arguments');
    options[match[1]] = match[2];
  }
  if (!['preflight', 'inventory', 'apply'].includes(options.mode) || !options['env-file']) fail('attendance_invalid_arguments');
  return options;
};

const readEnvironment = (filename, inherited = process.env) => {
  const raw = fs.readFileSync(filename, 'utf8');
  const env = parseEnv(raw);
  // Reject duplicate keys instead of silently selecting the last credential.
  const keys = [...raw.matchAll(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/gm)].map((m) => m[1]);
  if (new Set(keys).size !== keys.length) fail('attendance_duplicate_env_key');
  for (const [key, value] of Object.entries(inherited)) {
    if (/^(APP_ENV|SPACE_ENV|SPACE_APP_ENV|VERCEL_ENV|VERCEL_TARGET_ENV|SUPABASE_.*|NEXT_PUBLIC_SUPABASE_.*|SPACE_.*SUPABASE_.*|ATTENDANCE_.*)$/.test(key)
      && value && value !== env[key]) fail('attendance_inherited_environment_conflict');
  }
  return env;
};

// Fixed executable/arguments, no shell, URL or password in argv, no inherited libpq configuration.
const executeSql = (target, sql) => {
  const result = spawnSync('psql', ['-X', '-w', '-h', target.database.host, '-p', '5432', '-U', 'postgres', '-d', 'postgres',
    '-v', 'ON_ERROR_STOP=1', '-Atq'], {
    input: sql, encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024,
    env: { PATH: process.env.PATH, PGPASSWORD: target.database.password, PGSSLMODE: 'verify-full',
      PGSSLROOTCERT: 'system', PGCONNECT_TIMEOUT: '10', PGAPPNAME: 'attendance_staging_validation' },
  });
  if (result.error || result.status !== 0) fail('attendance_sql_failed_check_private_server_logs');
  target.warningCount = (target.warningCount || 0) + (result.stderr.match(/^WARNING:/gm) || []).length;
  // Never print raw database error/context or SQL input containing data.
  return result.stdout.trim();
};

const assertReview = (review, target, inventory, migration, now = Date.now()) => {
  const age = now - Date.parse(review?.reviewedAt);
  if (review?.approved !== true || review?.outboxConsumersIsolated !== true || review?.projectRef !== target.ref
    || review?.inventorySha256 !== digest(inventory) || review?.migrationSha256 !== digest(migration)
    || !Number.isFinite(age) || age < 0 || age > 86400000) fail('attendance_schema_review_required');
};

const tables = ['connections', 'teams', 'attendance_members', 'team_members', 'channels', 'channel_teams', 'contacts',
  'contact_identities', 'channel_contact_state', 'conversations', 'conversation_participants', 'messages', 'conversation_reads', 'conversation_events'];
const rpcs = ['attendance_ingest_message', 'attendance_append_message', 'attendance_update_conversation',
  'attendance_mark_read', 'attendance_get_conversation', 'attendance_list_conversations'];
const assertObjects = (raw) => {
  const inventory = JSON.parse(raw);
  if (!tables.every((name) => (inventory.relations || []).some((r) => r.name === name && r.kind === 'r' && r.rls))
    || !rpcs.every((name) => (inventory.functions || []).some((f) => f.name === name && f.definer
      && f.config?.includes('search_path=pg_catalog, public')))) fail('attendance_post_apply_verification_failed');
};

const run = (args, deps = {}) => {
  const options = parseArguments(args);
  const env = readEnvironment(options['env-file'], deps.inherited || process.env);
  const target = assertAttendanceOperation(env, options, deps.policy);
  const report = { timestamp: new Date().toISOString(), mode: options.mode, environment: 'staging',
    projectRef: target.maskedRef, migration: path.basename(migrationPath), remoteWrites: false };
  if (options.mode === 'preflight') return { ...report, status: 'configuration_verified_only' };
  const sql = deps.executeSql || executeSql;
  const before = sql(target, inventorySql);
  JSON.parse(before);
  if (options.mode === 'inventory') {
    if (!options.output) fail('attendance_private_output_required');
    fs.writeFileSync(options.output, before, { mode: 0o600, flag: 'wx' });
    return { ...report, status: 'inventory_saved_review_required', warningCount: target.warningCount || 0, inventorySha256: digest(before) };
  }
  if (!options['review-file'] || !options.output) fail('attendance_schema_review_required');
  if (fs.existsSync(options.output)) fail('attendance_output_already_exists');
  const migration = fs.readFileSync(migrationPath, 'utf8');
  assertReview(JSON.parse(fs.readFileSync(options['review-file'], 'utf8')), target, before, migration);
  // Only this fixed reviewed migration can run. No arbitrary SQL path or command passthrough.
  sql(target, migration);
  const after = sql(target, inventorySql);
  fs.writeFileSync(options.output, after, { mode: 0o600, flag: 'wx' });
  assertObjects(after);
  return { ...report, status: 'applied_objects_verified_remote_homologation_still_required', remoteWrites: true,
    warningCount: target.warningCount || 0, migrationSha256: digest(migration), inventorySha256: digest(after) };
};

if (require.main === module) {
  try { process.stdout.write(`${JSON.stringify(run(process.argv.slice(2)))}\n`); }
  catch (error) {
    const code = /^attendance_[a-z_]+$/.test(error.code || '') ? error.code : 'attendance_staging_failed';
    process.stderr.write(`${JSON.stringify({ timestamp: new Date().toISOString(), status: 'blocked_or_failed', error: code,
      gate: 'NO-GO', note: 'If apply started, inspect schema before retry; failure does not prove rollback.' })}\n`);
    process.exitCode = 1;
  }
}
module.exports = { run, parseArguments, readEnvironment, assertReview, assertObjects };
