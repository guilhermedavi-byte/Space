const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { assertAttendanceTarget, assertAttendanceOperation, digest } = require('../_lib/attendance-environment');
const { run, assertReview, parseArguments, readEnvironment, assertObjects } = require('../scripts/attendance-staging');

const stage = 'abcdefghijklmnopqrst', prod = 'zyxwvutsrqponmlkjihg';
const key = 'sb_secret_synthetic_test_only';
const policy = { productionProjectRefSha256: [digest(prod)], staging: [{ projectRef: stage,
  serviceRoleKeySha256: digest(key), databasePasswordSha256: digest('synthetic-password') }] };
const environment = () => ({ APP_ENV: 'staging', SUPABASE_ENV_SCOPE: 'staging', NODE_ENV: 'production', VERCEL_ENV: 'preview',
  SUPABASE_URL: `https://${stage}.supabase.co`, SPACE_STAGING_SUPABASE_URL: `https://${stage}.supabase.co`,
  SPACE_PRODUCTION_SUPABASE_URL: `https://${prod}.supabase.co`, SUPABASE_SERVICE_ROLE_KEY: key,
  ATTENDANCE_STAGING_PROJECT_REF: stage, ATTENDANCE_STAGING_CONFIRM: `staging:${stage}`,
  ATTENDANCE_STAGING_DATABASE_URL: `postgresql://postgres:synthetic-password@db.${stage}.supabase.co:5432/postgres` });
const options = { environment: 'staging', confirm: true };
const check = (env, config = policy) => assertAttendanceOperation(env, options, config);

test('produção somente com autorização exata, target conhecido, fingerprint e sinais coerentes', () => {
  const config = { ...policy, production: { projectRefSha256: digest(prod), serviceRoleKeySha256: digest(key),
    databasePasswordSha256: digest('synthetic-password') } };
  const env = { APP_ENV: 'production', SUPABASE_ENV_SCOPE: 'production', VERCEL_ENV: 'production',
    ATTENDANCE_ALLOW_PRODUCTION_MUTATIONS: 'true', ATTENDANCE_PRODUCTION_PROJECT_REF: prod,
    SUPABASE_URL: `https://${prod}.supabase.co`, SPACE_PRODUCTION_SUPABASE_URL: `https://${prod}.supabase.co`,
    SUPABASE_SERVICE_ROLE_KEY: key, ATTENDANCE_PRODUCTION_CONFIRM: `production:${prod}`,
    ATTENDANCE_PRODUCTION_DATABASE_URL: `postgresql://postgres:synthetic-password@db.${prod}.supabase.co/postgres` };
  const operation = e => assertAttendanceOperation(e, { environment: 'production', confirm: true }, config);
  assert.equal(operation(env).environment, 'production');
  for (const patch of [{ ATTENDANCE_ALLOW_PRODUCTION_MUTATIONS: undefined }, { ATTENDANCE_ALLOW_PRODUCTION_MUTATIONS: 'TRUE' },
    { SUPABASE_URL: `https://${stage}.supabase.co` }, { SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_wrong' },
    { ATTENDANCE_PRODUCTION_PROJECT_REF: stage }, { VERCEL_ENV: 'preview' }, { SPACE_APP_ENV: 'staging' },
    { SUPABASE_ENV_SCOPE: 'staging' }, { SPACE_PRODUCTION_SUPABASE_URL: `https://${stage}.supabase.co` },
    { ATTENDANCE_PRODUCTION_CONFIRM: `production:${stage}` }, { NEXT_PUBLIC_SUPABASE_URL: `https://${stage}.supabase.co` },
    { ATTENDANCE_PRODUCTION_DATABASE_URL: `postgresql://postgres:wrong@db.${prod}.supabase.co/postgres` }]) {
    assert.throws(() => operation({ ...env, ...patch }), /attendance_environment_/);
  }
  assert.throws(() => assertAttendanceTarget(env, policy), /target_not_allowlisted/);
  assert.throws(() => assertAttendanceOperation(env, options, config), /confirmation_required/);
  assert.throws(() => parseArguments(['--mode=apply','--env-file=x','--environment=production','--confirm-staging']));
});

test('staging allowlisted, credenciais vinculadas e confirmação permitem; NODE_ENV não identifica ambiente', () => {
  assert.equal(check(environment()).ref, stage);
  const env = environment(); delete env.VERCEL_ENV;
  assert.equal(check(env).ref, stage);
});

for (const [name, patch] of [
  ['production', { APP_ENV: 'production' }],
  ['staging flag com env production', { APP_ENV: 'production', ATTENDANCE_FOUNDATION_ENABLED: 'true' }],
  ['env staging com URL production', { SUPABASE_URL: `https://${prod}.supabase.co` }],
  ['production Vercel com APP_ENV staging', { VERCEL_ENV: 'production' }],
  ['production target Vercel', { VERCEL_TARGET_ENV: 'production' }],
  ['conflito SPACE_APP_ENV', { SPACE_APP_ENV: 'production' }],
  ['conflito SPACE_ENV', { SPACE_ENV: 'production' }],
  ['project ref desconhecido', { ATTENDANCE_STAGING_PROJECT_REF: prod }],
  ['URL pública production', { NEXT_PUBLIC_SUPABASE_URL: `https://${prod}.supabase.co` }],
  ['credencial diferente', { SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_production_fake' }],
  ['fallback credencial diferente', { SUPABASE_SERVICE_KEY: 'other' }],
  ['database production', { ATTENDANCE_STAGING_DATABASE_URL: `postgresql://postgres:synthetic-password@db.${prod}.supabase.co/postgres` }],
  ['senha database diferente', { ATTENDANCE_STAGING_DATABASE_URL: `postgresql://postgres:wrong@db.${stage}.supabase.co/postgres` }],
  ['database options injection', { ATTENDANCE_STAGING_DATABASE_URL: `postgresql://postgres:synthetic-password@db.${stage}.supabase.co/postgres?host=production` }],
  ['confirmação diferente', { ATTENDANCE_STAGING_CONFIRM: `staging:${prod}` }],
  ['host malicioso com sufixo', { SUPABASE_URL: `https://${stage}.supabase.co.attacker.invalid` }],
  ['URL userinfo', { SUPABASE_URL: `https://user@${stage}.supabase.co` }],
]) test(`fail-closed: ${name}`, () => assert.throws(() => check({ ...environment(), ...patch }), /attendance_environment_/));

test('cada variável obrigatória ausente bloqueia', () => {
  for (const key of Object.keys(environment()).filter((k) => !['NODE_ENV', 'VERCEL_ENV'].includes(k))) {
    const env = environment(); delete env[key];
    assert.throws(() => check(env), /attendance_environment_/, key);
  }
  assert.throws(() => check({}), /attendance_environment_/);
});

test('allowlist vazia/duplicada e denylist ausente ou produção renomeada bloqueiam', () => {
  for (const config of [{ ...policy, staging: [] }, { ...policy, staging: [policy.staging[0], policy.staging[0]] },
    { ...policy, productionProjectRefSha256: [] }]) assert.throws(() => check(environment(), config));
  assert.throws(() => check({ ...environment(), SPACE_PRODUCTION_SUPABASE_URL: 'https://aaaaaaaaaaaaaaaaaaaa.supabase.co' }));
  assert.throws(() => check(environment(), { ...policy, productionProjectRefSha256: [...policy.productionProjectRefSha256, digest(stage)] }));
});

test('JWT requer fingerprint administrativo, role e ref corretos, validade; decode não é autenticação', () => {
  const jwt = (payload) => `e30.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.testsignature`;
  for (const payload of [{ ref: prod, role: 'service_role', exp: 9999999999 }, { ref: stage, role: 'anon', exp: 9999999999 },
    { ref: stage, role: 'service_role', exp: 1 }]) {
    const value = jwt(payload);
    assert.throws(() => assertAttendanceTarget({ ...environment(), SUPABASE_SERVICE_ROLE_KEY: value },
      { ...policy, staging: [{ ...policy.staging[0], serviceRoleKeySha256: digest(value) }] }));
  }
});

test('runner bloqueia antes de SQL, mesmo com --confirm-staging e --mode=apply', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'attendance-guard-'));
  try {
    const filename = path.join(dir, 'env');
    const env = { ...environment(), VERCEL_ENV: 'production' };
    fs.writeFileSync(filename, Object.entries(env).map(([k, v]) => `${k}=${v}`).join('\n'));
    let calls = 0;
    const args = ['--mode=apply', `--env-file=${filename}`, '--environment=staging', '--confirm-staging'];
    assert.throws(() => run(args, { inherited: {}, policy, executeSql: () => { calls++; } }));
    assert.equal(calls, 0);
    const result = spawnSync(process.execPath, [path.join(__dirname, '../scripts/attendance-staging.js'), ...args], { encoding: 'utf8', env: {} });
    assert.equal(result.status, 1);
    assert.doesNotMatch(result.stderr, /synthetic-password|sb_secret_|supabase\.co/);
    assert.match(result.stderr, /NO-GO/);
    fs.writeFileSync(filename, 'APP_ENV=staging\nAPP_ENV=production');
    assert.throws(() => readEnvironment(filename, {}), /duplicate_env_key/);
    fs.writeFileSync(filename, 'APP_ENV=staging');
    assert.throws(() => readEnvironment(filename, { APP_ENV: 'production' }), /inherited_environment_conflict/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('CLI aceita somente operações conhecidas e confirmação explícita', () => {
  for (const args of [[], ['--mode=cleanup', '--env-file=x'], ['--mode=apply', '--env-file=x', '--sql=evil'],
    ['--mode=preflight', '--env-file=x', '--env-file=y']]) assert.throws(() => parseArguments(args));
  assert.throws(() => assertAttendanceOperation(environment(), { environment: 'staging' }, policy), /confirmation_required/);
});

test('aplicar exige revisão recente do catálogo exato, alvo e migration exatos, consumidores isolados', () => {
  const now = Date.now();
  const review = { approved: true, outboxConsumersIsolated: true, projectRef: stage, reviewedAt: new Date(now).toISOString(),
    inventorySha256: digest('inventory'), migrationSha256: digest('migration') };
  assertReview(review, { ref: stage }, 'inventory', 'migration', now);
  for (const patch of [{ approved: false }, { outboxConsumersIsolated: false }, { projectRef: prod },
    { reviewedAt: 'invalid' }, { reviewedAt: new Date(now - 86400001).toISOString() },
    { inventorySha256: digest('drift') }, { migrationSha256: digest('different') }]) {
    assert.throws(() => assertReview({ ...review, ...patch }, { ref: stage }, 'inventory', 'migration', now));
  }
  assert.throws(() => assertObjects('{}'), /post_apply_verification_failed/);
});

test('runner exige revisão antes da escrita e faz verificação após migration; preflight é offline', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'attendance-runner-'));
  try {
    const envFile = path.join(dir, 'env'), reviewFile = path.join(dir, 'review.json'), output = path.join(dir, 'after.json');
    fs.writeFileSync(envFile, Object.entries(environment()).map(([k, v]) => `${k}=${v}`).join('\n'));
    const args = [`--env-file=${envFile}`, '--environment=staging', '--confirm-staging'];
    let calls = [];
    const announcements = [];
    const deps = { inherited: {}, policy, executeSql: (_target, sql) => { calls.push(sql); return '{}'; },
      announce: (value) => { assert.equal(calls.length, 1, 'anúncio ocorre após inventário e antes da mutation'); announcements.push(value); } };
    assert.equal(run(['--mode=preflight', ...args], deps).status, 'configuration_verified_only');
    assert.equal(calls.length, 0);
    assert.throws(() => run(['--mode=apply', ...args], deps), /schema_review_required/);
    assert.equal(calls.length, 1);
    assert.match(calls[0], /begin read only;/);
    const migration = fs.readFileSync(path.join(__dirname, '../supabase/migrations/202609140001_attendance_foundation.sql'), 'utf8');
    fs.writeFileSync(reviewFile, JSON.stringify({ approved: true, outboxConsumersIsolated: true, projectRef: stage,
      reviewedAt: new Date().toISOString(), inventorySha256: digest('{}'), migrationSha256: digest(migration) }));
    calls = [];
    assert.throws(() => run(['--mode=apply', ...args, `--review-file=${reviewFile}`, `--output=${output}`], deps), /post_apply_verification_failed/);
    assert.equal(calls.length, 3);
    assert.equal(announcements.length, 1);
    assert.equal(announcements[0].productionGuardPassed, true);
    assert.equal(announcements[0].SPACE_ENV, 'staging');
    assert.ok(!JSON.stringify(announcements).includes(stage));
    assert.ok(!JSON.stringify(announcements).includes(key));
    assert.ok(!JSON.stringify(announcements).includes('synthetic-password'));
    assert.equal(calls[1], migration, 'somente migration fixa revisada é passada ao executor');
    assert.match(calls[2], /begin read only;/);
    assert.ok(fs.existsSync(output), 'inventário pós-apply preservado mesmo quando insuficiente');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
