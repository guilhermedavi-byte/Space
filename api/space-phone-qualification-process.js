const crypto = require('node:crypto');
const { sendJson } = require('./_lib/http');
const { processPendingQualifications } = require('./_lib/space-phone-n8n');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'method_not_allowed' });
  const secret = String(process.env.CRON_SECRET || '').trim();
  const expected = Buffer.from(`Bearer ${secret}`);
  const supplied = Buffer.from(String(req.headers.authorization || ''));
  if (!secret || expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) return sendJson(res, 401, { error: 'unauthorized' });
  try {
    const result = await processPendingQualifications();
    return sendJson(res, result.ok ? 200 : 503, result);
  } catch {
    return sendJson(res, 503, { error: 'qualification_processing_unavailable' });
  }
};
