const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { assertFinanceCertificationTarget: target, assertFinanceCertificationApply: apply, digest } = require('../_lib/finance-certification-environment');
function fixture() {
  const ref = 's'.repeat(20), prod = 'p'.repeat(20);
  const env = {
    APP_ENV: 'staging', SUPABASE_ENV_SCOPE: 'staging', SPACE_APP_ENV: 'staging', VERCEL_ENV: 'preview',
    NODE_ENV: 'production', ASAAS_BASE_URL: 'https://api-sandbox.asaas.com/v3', ASAAS_KEY_SCOPE: 'sandbox',
    N8N_ENV_SCOPE: 'disabled',
    SUPABASE_URL: `https://${ref}.supabase.co`, SPACE_STAGING_SUPABASE_URL: `https://${ref}.supabase.co`,
    SPACE_PRODUCTION_SUPABASE_URL: `https://${prod}.supabase.co`, FINANCE_STAGING_PROJECT_REF: ref,
    SPACE_PUBLIC_BASE_URL: 'https://staging.space.test', SPACE_PRODUCTION_PUBLIC_BASE_URL: 'https://space.test',
    FINANCE_SANDBOX_WEBHOOK_URL: 'https://staging.space.test/api/asaas-webhook',
    SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_synthetic_test_only', ASAAS_API_KEY: 'synthetic_sandbox_test_only',
    ASAAS_WEBHOOK_TOKEN: 'synthetic_webhook_test_only', FINANCE_STAGING_APPLY: 'YES',
  };
  const policy = {productionProjectRefSha256: [digest(prod)], staging: [{
    projectRef: ref, appOrigin: env.SPACE_PUBLIC_BASE_URL, productionOrigins: [env.SPACE_PRODUCTION_PUBLIC_BASE_URL],
    serviceRoleKeySha256: digest(env.SUPABASE_SERVICE_ROLE_KEY), asaasSandboxKeySha256: digest(env.ASAAS_API_KEY),
    webhookTokenSha256: digest(env.ASAAS_WEBHOOK_TOKEN),
  }]};
  return {env, policy};
}
test('certification permits only the reviewed sandbox target and explicit apply', () => {
  const {env, policy} = fixture();
  assert.equal(target(env, policy).asaas_environment, 'sandbox');
  assert.equal(apply(env, new Set(['--apply']), policy).project_ref, env.FINANCE_STAGING_PROJECT_REF);
  assert.throws(() => apply({...env, FINANCE_STAGING_APPLY: ''}, new Set(['--apply']), policy), /apply_confirmation_required/);
  assert.throws(() => apply(env, new Set(), policy), /apply_confirmation_required/);
});
test('production, conflicting aliases, non-allowlisted domains and credentials fail closed', () => {
  const {env, policy} = fixture();
  const cases = [
    {APP_ENV: 'production'}, {APP_ENV: ''}, {SUPABASE_ENV_SCOPE: ''}, {VERCEL_ENV: 'production'},
    {N8N_ENV_SCOPE: 'staging'}, {N8N_BASE_URL: 'https://workflow.production.test'},
    {N8N_PEDAGOGICO_ONBOARDING_URL: 'https://workflow.production.test/hook'}, {CHATWOOT_API_TOKEN: 'synthetic'},
    {STAGING_EMAIL_ALLOWLIST: '*'}, {STAGING_WHATSAPP_ALLOWLIST: '*'}, {STAGING_SMS_ALLOWLIST: '123'},
    {SPACE_APP_ENV: 'production'}, {ASAAS_BASE_URL: 'https://api.asaas.com/v3'}, {ASAAS_KEY_SCOPE: ''},
    {ASAAS_ENV: 'production'}, {SUPABASE_URL: env.SPACE_PRODUCTION_SUPABASE_URL},
    {SPACE_PRODUCTION_SUPABASE_URL: 'https://' + 'q'.repeat(20) + '.supabase.co'},
    {NEXT_PUBLIC_SUPABASE_URL: env.SPACE_PRODUCTION_SUPABASE_URL}, {SUPABASE_SERVICE_KEY: 'different'},
    {SPACE_STAGING_SUPABASE_URL: env.SPACE_PRODUCTION_SUPABASE_URL}, {FINANCE_STAGING_PROJECT_REF: 'other'},
    {SPACE_PUBLIC_BASE_URL: env.SPACE_PRODUCTION_PUBLIC_BASE_URL}, {SPACE_PUBLIC_BASE_URL: 'https://unapproved.test'},
    {SPACE_PRODUCTION_PUBLIC_BASE_URL: 'https://unapproved.test'}, {FINANCE_SANDBOX_WEBHOOK_URL: 'https://space.test/api/asaas-webhook'},
    {SUPABASE_SERVICE_ROLE_KEY: 'other-secret'}, {ASAAS_API_KEY: 'other-secret'}, {ASAAS_WEBHOOK_TOKEN: 'other-secret'},
    {SUPABASE_URL: env.SUPABASE_URL + '/rest/v1'}, {SUPABASE_URL: env.SUPABASE_URL + '?x=1'},
    {SPACE_PUBLIC_BASE_URL: 'https://user:password@staging.space.test'},
  ];
  for (const patch of cases) assert.throws(() => target({...env, ...patch}, policy), /finance_certification_/);
  assert.throws(() => target(env, {...policy, staging: []}), /not_allowlisted/);
  assert.throws(() => target(env, {...policy, staging: [...policy.staging, ...policy.staging]}), /not_allowlisted/);
  assert.throws(() => target(env, {...policy, productionProjectRefSha256: []}), /production_reference_unknown/);
});
test('JWT role/ref/expiry and explicit production Asaas key are checked beyond hashes', () => {
  const {env, policy} = fixture();
  const setKey = claims => {
    const key = 'synthetic.' + Buffer.from(JSON.stringify(claims)).toString('base64url') + '.signature';
    policy.staging[0].serviceRoleKeySha256 = digest(key);
    return {...env, SUPABASE_SERVICE_ROLE_KEY: key};
  };
  const claims = {role: 'service_role', ref: env.FINANCE_STAGING_PROJECT_REF, exp: Date.now() / 1000 + 3600};
  assert.doesNotThrow(() => target(setKey(claims), policy));
  for (const patch of [{role: 'anon'}, {ref: 'wrong'}, {exp: 1}]) {
    assert.throws(() => target(setKey({...claims, ...patch}), policy), /service_credential_invalid/);
  }
  policy.staging[0].serviceRoleKeySha256 = digest(env.SUPABASE_SERVICE_ROLE_KEY);
  const prodKey = '$aact_prod_synthetic'; policy.staging[0].asaasSandboxKeySha256 = digest(prodKey);
  assert.throws(() => target({...env, ASAAS_API_KEY: prodKey}, policy), /production_asaas_credential/);
});
test('actual CLI refuses unapproved inputs before any fetch, including dry-run and health', () => {
  const {env} = fixture();
  for (const args of [['preflight'], ['health'], ['backfill','--dry-run'], ['repair','pay_test','--dry-run'], ['init','--apply','--actor','test']]) {
    const script = `global.fetch=()=>{process.stderr.write('UNEXPECTED_NETWORK');throw Error('network');};require('./scripts/finance-foundation').main(${JSON.stringify(args)}).then(()=>process.exit(2)).catch(e=>{process.stdout.write(e.code);process.exitCode=1;});`;
    const r = spawnSync(process.execPath, ['-e', script], {cwd: require('node:path').join(__dirname, '..'), env, encoding: 'utf8'});
    assert.equal(r.status, 1); assert.equal(r.stdout, 'finance_certification_production_reference_unknown');
    assert.equal(r.stderr, '');
  }
});
