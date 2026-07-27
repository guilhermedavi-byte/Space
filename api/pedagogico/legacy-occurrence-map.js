const fs = require('fs');
const path = require('path');
const { sendJson } = require('../_lib/http');
const { resolveAdminRequestAuth } = require('../_lib/admin-request-auth');

const LEGACY_MAP_PATH = path.join(process.cwd(), 'data', 'legacy-occurrence-map.generated.json');

module.exports = async (req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.setHeader('Allow', 'GET, HEAD');
    return sendJson(res, 405, { error: 'method_not_allowed' });
  }

  const auth = await resolveAdminRequestAuth(req, { logPrefix: '[api] pedagogico legacy occurrence map auth' });
  if (!auth.ok) return sendJson(res, auth.status, auth.body);
  if (auth.session?.role !== 'admin') return sendJson(res, 403, { error: 'admin_only' });

  try {
    if (!fs.existsSync(LEGACY_MAP_PATH)) {
      return sendJson(res, 404, { error: 'legacy_occurrence_map_not_found', rows: [] });
    }
    const payload = JSON.parse(fs.readFileSync(LEGACY_MAP_PATH, 'utf8'));
    const rows = Array.isArray(payload?.rows) ? payload.rows : [];
    return sendJson(res, 200, {
      ok: true,
      generatedAt: payload?.generatedAt || null,
      rows,
    });
  } catch (error) {
    console.error('[pedagogico] legacy occurrence map failed', error);
    return sendJson(res, 500, {
      error: 'legacy_occurrence_map_failed',
      rows: [],
    });
  }
};
