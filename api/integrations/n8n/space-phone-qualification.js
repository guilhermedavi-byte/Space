const { readJsonBody, sendJson } = require('../../_lib/http');
const n8n = require('../../_lib/space-phone-n8n');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const auth = n8n.assertN8nAuth(req);
  if (!auth.ok) return sendJson(res, auth.status, auth.body);
  try {
    if (req.method === 'GET') {
      const url = new URL(req.url || '/api/integrations/n8n/space-phone-qualification', 'https://space.local');
      return sendJson(res, 200, await n8n.getQualificationPayload({ callId: url.searchParams.get('callId') }));
    }
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return sendJson(res, 405, { error: 'method_not_allowed' });
    }
    const body = await readJsonBody(req).catch(() => null);
    if (!body || typeof body !== 'object') return sendJson(res, 400, { error: 'invalid_json' });
    const action = n8n.clean(body.action);
    if (action === 'save_ai_qualification') return sendJson(res, 200, await n8n.saveAiQualification({ callId: body.callId, qualification: body.qualification || {} }));
    if (action === 'claim_datacrazy_handoff') return sendJson(res, 200, await n8n.claimDatacrazyHandoff({ callId: body.callId }));
    if (action === 'mark_datacrazy_failed') return sendJson(res, 200, await n8n.markDatacrazyFailed({ callId: body.callId }));
    if (action === 'mark_datacrazy_synced') return sendJson(res, 200, await n8n.markDatacrazySynced({ callId: body.callId, sync: body.sync || {} }));
    return sendJson(res, 400, { error: 'invalid_action' });
  } catch (error) {
    const status = Number(error?.status) || 500;
    console.error('[n8n-space-phone-qualification]', { code: n8n.publicError(error), status });
    return sendJson(res, status, { error: n8n.publicError(error) });
  }
};
