const { FinanceError } = require('../api/_lib/finance-domain');
const policy = require('../config/finance-production-target.json');
const deny = code => { throw new FinanceError(`finance_production_${code}`); };
function assertFinanceProductionTarget(env = process.env, target = policy) {
  if (env.FINANCE_ENV_SCOPE !== 'production' || env.APP_ENV !== 'production'
    || env.SUPABASE_ENV_SCOPE !== 'production') deny('explicit_scope_required');
  for (const name of ['SPACE_APP_ENV', 'SPACE_ENV', 'VERCEL_ENV', 'VERCEL_TARGET_ENV']) {
    if (env[name] && env[name] !== 'production') deny('environment_conflict');
  }
  if (env.SUPABASE_URL !== target.supabaseUrl
    || target.supabaseUrl !== `https://${target.projectRef}.supabase.co`
    || (env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_URL !== target.supabaseUrl)
    || (env.SPACE_PRODUCTION_SUPABASE_URL && env.SPACE_PRODUCTION_SUPABASE_URL !== target.supabaseUrl)) deny('database_mismatch');
  if (env.ASAAS_BASE_URL !== target.asaasBaseUrl || env.ASAAS_BASE_URL !== 'https://api.asaas.com/v3'
    || env.ASAAS_KEY_SCOPE !== 'production' || (env.ASAAS_ENV && env.ASAAS_ENV !== 'production')) deny('asaas_environment_mismatch');
  if (!target.appOrigins.includes(env.SPACE_PUBLIC_BASE_URL)) deny('app_origin_mismatch');
  if (env.VERCEL_PROJECT_ID && env.VERCEL_PROJECT_ID !== target.vercelProjectId) deny('vercel_project_mismatch');
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key || key !== key.trim() || (env.SUPABASE_SERVICE_KEY && env.SUPABASE_SERVICE_KEY !== key)) deny('service_credential_missing_or_conflicting');
  // Claims reject obvious mismatches; successful authentication to the pinned project
  // is still required by the remote precheck. Decoding is not proof of provenance.
  if (!key.startsWith('sb_secret_')) {
    let claims;
    try { claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()); } catch { deny('service_credential_invalid'); }
    if (key.split('.').length !== 3 || claims.ref !== target.projectRef || claims.role !== 'service_role'
      || !Number.isFinite(claims.exp) || claims.exp <= Date.now()/1000) deny('service_credential_invalid');
  }
  if (!env.ASAAS_API_KEY || env.ASAAS_API_KEY !== env.ASAAS_API_KEY.trim()) deny('asaas_credential_missing');
  if (/\$aact_(?:hmlg|sandbox)_/i.test(env.ASAAS_API_KEY)) deny('sandbox_credential');
  return { environment: 'production', project_ref: target.projectRef, supabase_url: target.supabaseUrl,
    asaas_environment: 'production', app_origin: env.SPACE_PUBLIC_BASE_URL, remote_verified: false };
}
function assertFinanceProductionApply(env, flags, target = policy) {
  const verified = assertFinanceProductionTarget(env, target);
  if (!flags.has('--apply') || env.FINANCE_PRODUCTION_APPLY !== 'YES') deny('apply_confirmation_required');
  if (!env.ASAAS_WEBHOOK_TOKEN || env.ASAAS_WEBHOOK_TOKEN.length < 32) deny('webhook_secret_required');
  return verified;
}
module.exports = { assertFinanceProductionTarget, assertFinanceProductionApply };
