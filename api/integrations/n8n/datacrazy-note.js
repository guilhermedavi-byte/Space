const { readJsonBody, sendJson } = require('../../_lib/http');
const n8n = require('../../_lib/space-phone-n8n');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const auth = n8n.assertN8nAuth(req);
  if (!auth.ok) return sendJson(res, auth.status, auth.body);
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return sendJson(res, 405, { error: 'method_not_allowed' }); }
  try {
    const body = await readJsonBody(req).catch(() => null);
    if (!body || typeof body !== 'object') return sendJson(res, 400, { error: 'invalid_json' });
    const result = await n8n.datacrazyNote({ callId: body.callId, datacrazyId: body.datacrazyId, note: body.note });
    return sendJson(res, result.status || (result.ok ? 200 : 500), result);
  } catch (error) {
    const status = Number(error?.status) || 500;
    console.error('[n8n-datacrazy-note]', { code: n8n.publicError(error), status });
    return sendJson(res, status, { error: n8n.publicError(error) });
  }
};
