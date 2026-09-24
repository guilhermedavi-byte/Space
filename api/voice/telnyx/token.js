const {
  assertVoiceAccess,
  createTelnyxCredentialToken,
  loadVoiceIdentity,
  mapErrorStatus,
  sendJson,
} = require('../../_lib/space-phone');

const createHandler = ({ authResolver, permissionResolver, supabase, fetchImpl } = {}) => async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'method_not_allowed' });
  }
  const auth = await assertVoiceAccess(req, { authResolver, permissionResolver });
  if (!auth?.ok) return sendJson(res, auth.status || 403, auth.body || { error: 'forbidden' });
  try {
    const identity = await loadVoiceIdentity(auth.session.sub, { supabase });
    if (!identity?.telnyx_credential_id) return sendJson(res, 409, { error: 'voice_identity_not_configured' });
    const token = await createTelnyxCredentialToken({ credentialId: identity.telnyx_credential_id, fetchImpl });
    return sendJson(res, 200, {
      login_token: token,
      identity: {
        provider: 'telnyx',
        caller_id_configured: Boolean(identity.caller_id || process.env.TELNYX_DEFAULT_FROM_NUMBER),
      },
    });
  } catch (error) {
    const status = Math.min(599, Math.max(400, mapErrorStatus(error)));
    return sendJson(res, status, { error: error.message || 'space_phone_token_failed' });
  }
};

module.exports = createHandler();
module.exports.createHandler = createHandler;
