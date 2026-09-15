const { createHash } = require('node:crypto');
const { FinanceError } = require('../api/_lib/finance-domain');
const policy = require('../config/finance-staging-targets.json');
const { stagingChannelPolicy } = require('./staging-channel-policy');
const digest = value => createHash('sha256').update(value).digest('hex');
const deny = reason => { throw new FinanceError(`finance_certification_${reason}`); };
const required = (env, key) => {
  const value = env[key];
  if (typeof value !== 'string' || !value || value !== value.trim()) deny('configuration_missing');
  return value;
};
const origin = value => {
  let u;
  try { u = new URL(value); } catch { deny('url_invalid'); }
  if (u.protocol !== 'https:' || u.port || u.username || u.password || u.search || u.hash || u.pathname !== '/') deny('url_invalid');
  return u.origin;
};
const project = value => {
  const url = origin(value), host = new URL(url).hostname;
  if (!/^[a-z0-9]{20}\.supabase\.co$/.test(host)) deny('database_url_invalid');
  return { url, ref: host.split('.')[0] };
};
// Offline, reviewed allowlist: never enroll the target or its credentials from the command's env.
// A matching hash binds secret provenance; a decoded JWT by itself is not proof of staging.
function assertFinanceCertificationTarget(env = process.env, targets = policy) {
  if (env.APP_ENV !== 'staging' || env.SUPABASE_ENV_SCOPE !== 'staging') deny('staging_required');
  for (const key of ['SPACE_APP_ENV', 'SPACE_ENV']) if (env[key] && env[key] !== 'staging') deny('environment_conflict');
  for (const key of ['VERCEL_ENV', 'VERCEL_TARGET_ENV']) if (env[key] && !['preview', 'staging'].includes(env[key])) deny('environment_conflict');
  if (env.ASAAS_BASE_URL !== 'https://api-sandbox.asaas.com/v3' || env.ASAAS_KEY_SCOPE !== 'sandbox'
    || (env.ASAAS_ENV && env.ASAAS_ENV !== 'sandbox')) deny('sandbox_required');
  // Financial staging does not need any messaging/workflow integration.
  if (env.N8N_ENV_SCOPE !== 'disabled' || Object.entries(env).some(([key, value]) =>
    value && (/^N8N_.*(?:URL|TOKEN|SECRET)$/.test(key)
      || /^(?:CHATWOOT_API_TOKEN|CRM_API_KEY|ZAPSIGN_API_TOKEN|TWILIO_AUTH_TOKEN|RESEND_API_KEY|SENDGRID_API_KEY)$/.test(key)))) {
    deny('outbound_integrations_must_be_disabled');
  }
  try { stagingChannelPolicy(env); } catch { deny('channel_allowlist_invalid'); }
  const current = project(required(env, 'SUPABASE_URL'));
  const staging = project(required(env, 'SPACE_STAGING_SUPABASE_URL'));
  const production = project(required(env, 'SPACE_PRODUCTION_SUPABASE_URL'));
  const denied = targets.productionProjectRefSha256 || [];
  if (!denied.includes(digest(production.ref))) deny('production_reference_unknown');
  if (denied.includes(digest(current.ref)) || current.ref === production.ref) deny('production_database');
  if (current.ref !== staging.ref || current.ref !== required(env, 'FINANCE_STAGING_PROJECT_REF')) deny('database_mismatch');
  if (env.NEXT_PUBLIC_SUPABASE_URL && project(env.NEXT_PUBLIC_SUPABASE_URL).ref !== current.ref) deny('database_mismatch');
  const matches = (targets.staging || []).filter(entry => entry.projectRef === current.ref);
  if (matches.length !== 1) deny('target_not_allowlisted');
  const entry = matches[0];
  const appOrigin = origin(required(env, 'SPACE_PUBLIC_BASE_URL'));
  const productionOrigin = origin(required(env, 'SPACE_PRODUCTION_PUBLIC_BASE_URL'));
  if (!Array.isArray(entry.productionOrigins) || !entry.productionOrigins.includes(productionOrigin)) deny('production_domain_unknown');
  if (entry.productionOrigins.includes(appOrigin)) deny('production_domain');
  if (appOrigin !== entry.appOrigin) deny('domain_not_allowlisted');
  if (required(env, 'FINANCE_SANDBOX_WEBHOOK_URL') !== `${appOrigin}/api/asaas-webhook`) deny('webhook_target_mismatch');
  for (const [key, field] of [
    ['SUPABASE_SERVICE_ROLE_KEY', 'serviceRoleKeySha256'],
    ['ASAAS_API_KEY', 'asaasSandboxKeySha256'],
    ['ASAAS_WEBHOOK_TOKEN', 'webhookTokenSha256'],
  ]) {
    const value = required(env, key);
    if (!/^[a-f0-9]{64}$/.test(entry[field] || '') || digest(value) !== entry[field]) deny('credential_mismatch');
  }
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (env.SUPABASE_SERVICE_KEY && env.SUPABASE_SERVICE_KEY !== serviceKey) deny('credential_mismatch');
  if (!serviceKey.startsWith('sb_secret_')) {
    let claims;
    try { claims = JSON.parse(Buffer.from(serviceKey.split('.')[1], 'base64url').toString()); } catch { deny('service_credential_invalid'); }
    if (serviceKey.split('.').length !== 3 || claims.role !== 'service_role' || claims.ref !== current.ref
      || !Number.isFinite(claims.exp) || claims.exp <= Date.now() / 1000) deny('service_credential_invalid');
  }
  // A declared production key is rejected even if mistakenly entered into an allowlist.
  if (/\$aact_prod_/i.test(env.ASAAS_API_KEY)) deny('production_asaas_credential');
  return { project_ref: current.ref, supabase_url: current.url, asaas_environment: 'sandbox', app_origin: appOrigin };
}
function assertFinanceCertificationApply(env, flags, targets = policy) {
  const target = assertFinanceCertificationTarget(env, targets);
  if (!flags.has('--apply') || env.FINANCE_STAGING_APPLY !== 'YES') deny('apply_confirmation_required');
  return target;
}
module.exports = { assertFinanceCertificationTarget, assertFinanceCertificationApply, digest };
