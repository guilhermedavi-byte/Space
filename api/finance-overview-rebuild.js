const { getSessionFromRequest } = require('../_lib/session');
const { canAccessFinance } = require('./_lib/finance-integrations');
const { rebuildOverviewMonths, rebuildIfInvalidated, closeStaleOverviewInvalidations, saoPauloMonth } = require('./_lib/finance-overview-rebuild');

const readBody = async req => { const chunks=[]; for await (const c of req) chunks.push(Buffer.from(c)); return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); };
const authCron = req => {
  const configured = String(process.env.CRON_SECRET || '').trim();
  const provided = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  return configured && provided && configured === provided;
};

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  const send = (status, data) => { res.statusCode = status; res.end(JSON.stringify(data)); };
  if (!['GET','POST'].includes(req.method)) { res.setHeader('Allow','GET, POST'); return send(405,{error:'method_not_allowed'}); }
  const cron = authCron(req);
  const user = cron ? { role:'system' } : getSessionFromRequest(req);
  if (!user) return send(401,{error:'unauthorized'});
  if (!cron && !canAccessFinance(user)) return send(403,{error:'forbidden'});
  if (process.env.FINANCE_FOUNDATION_ENABLED !== 'true') return send(503,{error:'finance_foundation_disabled'});
  try {
    const url = new URL(req.url || '/', 'https://space.invalid');
    const body = req.method === 'POST' ? await readBody(req).catch(()=>({})) : {};
    const month = String(body.month || url.searchParams.get('month') || saoPauloMonth()).slice(0,7);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return send(400,{error:'finance_month_invalid'});
    const cleanup = await closeStaleOverviewInvalidations(process.env.FINANCE_CONNECTION_ID).catch(()=>({closed:0}));
    const force = cron || body.force === true || url.searchParams.get('force') === '1';
    const result = force
      ? await rebuildOverviewMonths({ months:[month], reason: cron ? 'daily_calendar_rebuild' : 'manual_or_stale_rebuild' })
      : await rebuildIfInvalidated({ month });
    return send(200,{ok:true, month, cleanup, ...result});
  } catch (error) {
    console.warn('[finance-overview-rebuild] failed', JSON.stringify({ error:error?.message || 'finance_overview_rebuild_failed' }));
    return send(503,{error:'finance_overview_rebuild_failed'});
  }
};
