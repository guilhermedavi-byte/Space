const {
  assertVoiceAccess,
  createVoiceCall,
  loadVoiceIdentity,
  mapErrorStatus,
  normalizePhoneNumber,
  sendJson,
  updateVoiceCall,
} = require('../_lib/space-phone');

const readJsonBody = async req => new Promise(resolve => {
  const chunks = [];
  req.on('data', chunk => chunks.push(chunk));
  req.on('end', () => {
    if (!chunks.length) return resolve({});
    try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')) || {}); }
    catch { resolve(null); }
  });
  req.on('error', () => resolve(null));
});

const createHandler = ({ authResolver, permissionResolver, supabase } = {}) => async (req, res) => {
  if (!['POST', 'PATCH'].includes(req.method)) {
    res.setHeader('Allow', 'POST, PATCH');
    return sendJson(res, 405, { error: 'method_not_allowed' });
  }
  const auth = await assertVoiceAccess(req, { authResolver, permissionResolver });
  if (!auth?.ok) return sendJson(res, auth.status || 403, auth.body || { error: 'forbidden' });
  const body = await readJsonBody(req);
  if (!body) return sendJson(res, 400, { error: 'invalid_json' });
  try {
    if (req.method === 'PATCH') {
      const updated = await updateVoiceCall({ session: auth.session, callId: body.call_id, patch: body, supabase });
      return sendJson(res, 200, { call: updated });
    }
    const toNumber = normalizePhoneNumber(body.phoneNumber || body.to_number);
    if (!toNumber) return sendJson(res, 400, { error: 'invalid_phone_number' });
    const identity = await loadVoiceIdentity(auth.session.sub, { supabase });
    if (!identity?.telnyx_credential_id) return sendJson(res, 409, { error: 'voice_identity_not_configured' });
    const call = await createVoiceCall({ session: auth.session, identity, toNumber, context: body.context || body, supabase });
    return sendJson(res, 200, {
      call: {
        id: call.id,
        status: call.status,
        from_number: call.from_number,
        to_number: call.to_number,
        lead_id: call.lead_id,
        opportunity_id: call.opportunity_id,
      },
    });
  } catch (error) {
    const status = Math.min(599, Math.max(400, mapErrorStatus(error)));
    return sendJson(res, status, { error: error.message || 'space_phone_call_failed' });
  }
};

module.exports = createHandler();
module.exports.createHandler = createHandler;
