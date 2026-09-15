const test = require('node:test');
const assert = require('node:assert/strict');
const { validateEnvironmentIsolation } = require('../_lib/runtime-env');
const { stagingChannelPolicy, assertStagingRecipientAllowed } = require('../_lib/staging-channel-policy');
const base = () => ({
  APP_ENV: 'staging', SPACE_APP_ENV: 'staging', NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'firebase-stage',
  SPACE_PRODUCTION_FIREBASE_PROJECT_ID: 'firebase-production',
  SUPABASE_URL: 'https://staging.supabase.co', SPACE_STAGING_SUPABASE_URL: 'https://staging.supabase.co',
  SPACE_PRODUCTION_SUPABASE_URL: 'https://production.supabase.co', SUPABASE_ENV_SCOPE: 'staging',
  ASAAS_BASE_URL: 'https://api-sandbox.asaas.com/v3', ASAAS_KEY_SCOPE: 'sandbox', N8N_ENV_SCOPE: 'disabled',
});
test('staging refuses production/unknown Supabase and arbitrary Asaas hosts', () => {
  assert.equal(validateEnvironmentIsolation(base()).ok, true);
  for (const patch of [{SUPABASE_URL:'https://production.supabase.co'}, {SPACE_PRODUCTION_SUPABASE_URL:''},
    {SPACE_STAGING_SUPABASE_URL:''}, {SUPABASE_URL:'https://unknown.supabase.co'}, {SUPABASE_ENV_SCOPE:'production'},
    {ASAAS_BASE_URL:'https://sandbox.attacker.test/v3'}, {ASAAS_BASE_URL:'https://api.asaas.com/v3'}]) {
    assert.equal(validateEnvironmentIsolation({...base(), ...patch}).ok, false);
  }
});
test('disabled n8n rejects live configuration; enabled staging requires exact references', () => {
  for (const patch of [{N8N_BASE_URL:'https://production.test'}, {N8N_WEBHOOK_SECRET:'synthetic'},
    {N8N_PEDAGOGICO_ONBOARDING_URL:'https://production.test/hook'}]) {
    assert.equal(validateEnvironmentIsolation({...base(), ...patch}).ok, false);
  }
  const env={...base(), N8N_ENV_SCOPE:'staging', N8N_BASE_URL:'https://stage.test',
    SPACE_STAGING_N8N_BASE_URL:'https://stage.test', SPACE_PRODUCTION_N8N_BASE_URL:'https://production.test',
    N8N_PEDAGOGICO_ONBOARDING_URL:'https://stage.test/webhook'};
  assert.equal(validateEnvironmentIsolation(env).ok,true);
  for (const patch of [{SPACE_STAGING_N8N_BASE_URL:''},{SPACE_PRODUCTION_N8N_BASE_URL:''},
    {N8N_PEDAGOGICO_ONBOARDING_URL:'https://stage.test.attacker.test/hook'},
    {N8N_PEDAGOGICO_ONBOARDING_URL:'https://production.test/hook'}]) {
    assert.equal(validateEnvironmentIsolation({...env,...patch}).ok,false);
  }
});
test('Firebase staging rejects conflicting service accounts; production rejects staging scopes', () => {
  for(const id of ['firebase-production','unverified-project']) {
    const result=validateEnvironmentIsolation({...base(),GOOGLE_SERVICE_ACCOUNT_JSON_STAGING:JSON.stringify({project_id:id})});
    assert.equal(result.ok,false);
  }
  for(const patch of [{SUPABASE_ENV_SCOPE:'staging'},{FIREBASE_ENV_SCOPE:'staging'},{ASAAS_KEY_SCOPE:'sandbox'}]) {
    assert.equal(validateEnvironmentIsolation({APP_ENV:'production',...patch}).ok,false);
  }
});
test('staging channel allowlists deny empty/unknown/wildcard recipients and require exact matches', () => {
  const env={APP_ENV:'staging'};
  assert.deepEqual(stagingChannelPolicy(env),{email:[],whatsapp:[],sms:[],admin:[]});
  for(const channel of ['email','whatsapp','sms','admin']) assert.throws(()=>assertStagingRecipientAllowed(channel,'someone',env));
  for(const field of ['STAGING_EMAIL_ALLOWLIST','STAGING_WHATSAPP_ALLOWLIST','STAGING_SMS_ALLOWLIST','STAGING_ADMIN_EMAIL_ALLOWLIST']) {
    assert.throws(()=>stagingChannelPolicy({...env,[field]:'*'}));
  }
  const allowed={...env,STAGING_EMAIL_ALLOWLIST:'operator@example.test',STAGING_WHATSAPP_ALLOWLIST:'+15555550123'};
  assert.doesNotThrow(()=>assertStagingRecipientAllowed('email','OPERATOR@example.test',allowed));
  assert.doesNotThrow(()=>assertStagingRecipientAllowed('whatsapp','+15555550123',allowed));
  assert.throws(()=>assertStagingRecipientAllowed('email','other@example.test',allowed));
  assert.throws(()=>assertStagingRecipientAllowed('sms','+15555550123',allowed));
  assert.throws(()=>assertStagingRecipientAllowed('email','operator@example.test',{...allowed,APP_ENV:'production'}));
});
