const { readJsonBody, sendJson } = require('../_lib/http');
const { resolveAdminRequestAuth } = require('./_lib/admin-request-auth');
const { commitWritesAsAdmin } = require('./_lib/firestore-admin');
const { PROJECT_ID, encodeFields } = require('./_lib/firestore-rest');
const { loadAdminCommercialSdrActivity, addDaysToKey } = require('./_lib/admin-commercial-sdr-activity');

const TIME_ZONE = 'America/Sao_Paulo';
const FAVORITES_COLLECTION = 'sdrCallFavorites';

const clean = value => String(value == null ? '' : value).trim();
const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const pct = (a, b) => b ? (a / b) * 100 : 0;
const parseDateKey = value => /^\d{4}-\d{2}-\d{2}$/.test(clean(value)) ? clean(value) : '';
const safeId = value => clean(value).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 160);
const todayKey = (now = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = type => parts.find(part => part.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
};
const monthStart = key => `${key.slice(0, 8)}01`;
const lastMonthRange = key => {
  const d = new Date(`${key}T12:00:00-03:00`);
  d.setDate(1); d.setMonth(d.getMonth() - 1);
  const first = todayKey(d);
  const last = new Date(`${first}T12:00:00-03:00`); last.setMonth(last.getMonth() + 1); last.setDate(0);
  return { from: first, to: todayKey(last) };
};
const weekStart = (key, offset = 0) => {
  const d = new Date(`${key}T12:00:00-03:00`);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1 + offset);
  return todayKey(d);
};
const resolveRange = ({ period = 'last7', from = '', to = '', now = new Date() } = {}) => {
  const today = todayKey(now);
  const p = clean(period) || 'last7';
  if (p === 'custom') {
    const f = parseDateKey(from); const t = parseDateKey(to);
    if (f && t && f <= t) return { period: p, fromKey: f, toKey: t };
  }
  if (p === 'today') return { period: p, fromKey: today, toKey: today };
  if (p === 'yesterday') { const y = addDaysToKey(today, -1); return { period: p, fromKey: y, toKey: y }; }
  if (p === 'this_week') return { period: p, fromKey: weekStart(today), toKey: today };
  if (p === 'last_week') return { period: p, fromKey: weekStart(today, -7), toKey: addDaysToKey(weekStart(today), -1) };
  if (p === 'last30') return { period: p, fromKey: addDaysToKey(today, -29), toKey: today };
  if (p === 'this_month') return { period: p, fromKey: monthStart(today), toKey: today };
  if (p === 'last_month') { const r = lastMonthRange(today); return { period: p, fromKey: r.from, toKey: r.to }; }
  return { period: 'last7', fromKey: addDaysToKey(today, -6), toKey: today };
};
const firestoreDocName = (collection, id) => {
  if (!PROJECT_ID) throw Object.assign(new Error('missing_project_id'), { status: 503 });
  return `projects/${PROJECT_ID}/databases/(default)/documents/${collection}/${encodeURIComponent(id)}`;
};
const outcomeLabel = outcome => ({ nao_atendeu: 'Não atendida', atendeu: 'Atendida', agendou: 'Agendamento', double: 'Agendamento', show: 'Show', noshow: 'No-show' }[clean(outcome)] || clean(outcome) || 'Sem resultado');
const normalizeResult = event => {
  if (event.eventType === 'meeting') return event.outcome === 'show' ? 'show' : event.outcome === 'noshow' ? 'noshow' : 'none';
  if (event.outcome === 'agendou' || event.outcome === 'double') return 'scheduled';
  return 'none';
};
const normalizeCall = event => ({
  id: clean(event.id),
  dateKey: clean(event.dateKey || event.localDateKey),
  time: clean(event.localTime),
  sdrUid: clean(event.sdrUid),
  sdrName: clean(event.sdrName) || 'SDR',
  sdrEmail: clean(event.sdrEmail),
  leadName: '',
  phone: '',
  durationSeconds: null,
  status: event.eventType === 'meeting' ? 'meeting' : (event.outcome === 'nao_atendeu' ? 'unanswered' : 'connected'),
  outcome: normalizeResult(event),
  outcomeLabel: outcomeLabel(event.outcome),
  recording: null,
  recordingId: '',
  callId: clean(event.id),
  score: null,
  scriptAdherence: null,
  analysisStatus: 'not_recorded',
  transcriptAvailable: false,
  source: clean(event.source) || 'sdr_panel',
});
const buildTimeline = (calls, fromKey, toKey) => {
  if (!parseDateKey(fromKey) || !parseDateKey(toKey) || fromKey > toKey) return [];
  const map = new Map();
  for (let key = fromKey; key <= toKey; key = addDaysToKey(key, 1)) { map.set(key, { dateKey: key, calls: 0, scheduled: 0, shows: 0, sales: 0, score: null }); if (map.size > 370) break; }
  calls.forEach(call => {
    const row = map.get(call.dateKey); if (!row) return;
    if (call.status !== 'meeting') row.calls += 1;
    if (call.outcome === 'scheduled') row.scheduled += 1;
    if (call.outcome === 'show') row.shows += 1;
  });
  return [...map.values()].map(row => ({ ...row, conversion: pct(row.scheduled, row.calls) }));
};
const aggregateSdr = (row = {}, calls = []) => {
  const uid = clean(row.sdrUid || row.uid);
  const own = calls.filter(call => call.sdrUid === uid);
  const totalCalls = own.filter(call => call.status !== 'meeting').length;
  const connected = own.filter(call => call.status === 'connected').length;
  const scheduled = own.filter(call => call.outcome === 'scheduled').length;
  const shows = own.filter(call => call.outcome === 'show').length;
  const noShows = own.filter(call => call.outcome === 'noshow').length;
  return {
    id: uid,
    uid,
    name: clean(row.sdrName || row.nome) || 'SDR',
    email: clean(row.sdrEmail || row.email),
    active: row.ativo !== false,
    calls: totalCalls,
    connected,
    over1m: null,
    over5m: null,
    scheduled,
    callToScheduleRate: pct(scheduled, totalCalls),
    shows,
    noShows,
    showRate: pct(shows, scheduled),
    sales: 0,
    showToSaleRate: null,
    revenue: 0,
    avgScore: null,
    scriptAdherence: null,
    trend: buildTimeline(own, own[own.length - 1]?.dateKey || '', own[0]?.dateKey || '').slice(-8),
  };
};
const buildFunnel = summary => {
  const calls = number(summary.totalCalls);
  const connected = number(summary.answered);
  const relevant = null;
  const scheduled = number(summary.scheduled);
  const shows = number(summary.shows);
  const sales = 0;
  return [
    { key: 'calls', label: 'Ligações', value: calls, rateFromPrevious: null },
    { key: 'connected', label: 'Conectadas', value: connected, rateFromPrevious: pct(connected, calls) },
    { key: 'over1m', label: 'Conversas >1min', value: relevant, rateFromPrevious: null },
    { key: 'scheduled', label: 'Agendamentos', value: scheduled, rateFromPrevious: pct(scheduled, connected || calls) },
    { key: 'shows', label: 'Shows', value: shows, rateFromPrevious: pct(shows, scheduled) },
    { key: 'sales', label: 'Vendas', value: sales, rateFromPrevious: null },
  ];
};
const buildInsights = ({ summary, sdrs }) => {
  const items = [];
  if (!number(summary.totalCalls)) return [{ title: 'Dados insuficientes', detail: 'Nenhuma ligação registrada no período selecionado.' }];
  const best = [...sdrs].sort((a, b) => b.callToScheduleRate - a.callToScheduleRate)[0];
  if (best?.calls) items.push({ title: 'Melhor conversão SDR', detail: `${best.name} converteu ${best.callToScheduleRate.toFixed(1).replace('.', ',')}% das ligações em agendamento no período.` });
  if (summary.scheduled) items.push({ title: 'Show rate', detail: `${summary.shows} shows sobre ${summary.scheduled} agendamentos registrados. Agendamentos futuros não são inferidos nessa fonte.` });
  items.push({ title: 'Análise IA', detail: 'Aguardando calls analisadas pela esteira Telnyx → n8n → IA para gerar coaching, scorecard e objeções detalhadas.' });
  return items;
};
const filterCalls = (calls, { sdr = 'all', status = 'all', score = 'all', result = 'all' } = {}) => calls.filter(call => {
  if (sdr && sdr !== 'all' && call.sdrUid !== sdr) return false;
  if (status === 'connected' && call.status !== 'connected') return false;
  if (status === 'unanswered' && call.status !== 'unanswered') return false;
  if (['over1m', 'over2m', 'over5m', 'over10m'].includes(status)) return false;
  if (score && score !== 'all') return false;
  if (result && result !== 'all') {
    if (result === 'scheduled' && call.outcome !== 'scheduled') return false;
    if (result === 'show' && call.outcome !== 'show') return false;
    if (result === 'noshow' && call.outcome !== 'noshow') return false;
    if (result === 'sale') return false;
    if (result === 'lost' && call.outcome !== 'none') return false;
    if (result === 'none' && call.outcome !== 'none') return false;
  }
  return true;
});
const buildModel = async (query = {}) => {
  const range = resolveRange(query);
  const activity = await loadAdminCommercialSdrActivity({ period: 'custom', from: range.fromKey, to: range.toKey });
  const rawCalls = (activity.events || []).map(normalizeCall);
  const calls = filterCalls(rawCalls, query);
  const summary = {
    totalCalls: calls.filter(c => c.status !== 'meeting').length,
    connected: calls.filter(c => c.status === 'connected').length,
    answered: calls.filter(c => c.status === 'connected').length,
    over1m: null, over2m: null, over5m: null, over10m: null,
    totalDurationSeconds: null,
    avgDurationSeconds: null,
    scheduled: calls.filter(c => c.outcome === 'scheduled').length,
    shows: calls.filter(c => c.outcome === 'show').length,
    noShows: calls.filter(c => c.outcome === 'noshow').length,
    sales: 0,
    revenue: 0,
    avgTicket: null,
    analyzedCalls: 0,
    avgScore: null,
    scriptAdherence: null,
  };
  const sdrs = (activity.sdrs || []).map(row => aggregateSdr(row, rawCalls)).filter(row => !query.sdr || query.sdr === 'all' || row.uid === query.sdr);
  const sdrOptions = (activity.sdrs || []).map(row => ({ uid: clean(row.sdrUid), name: clean(row.sdrName) || 'SDR', email: clean(row.sdrEmail) }));
  const selectedCall = query.callId ? calls.find(call => call.id === query.callId) || null : null;
  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    source: { operational: 'Firestore/sdrActivityEvents', callAnalysis: 'pending_postgres_telnyx_n8n', usesMockData: false },
    filters: { period: range.period, fromKey: range.fromKey, toKey: range.toKey, sdr: query.sdr || 'all', status: query.status || 'all', score: query.score || 'all', result: query.result || 'all' },
    sdrOptions,
    kpis: { ...summary, callToScheduleRate: pct(summary.scheduled, summary.totalCalls), showRate: pct(summary.shows, summary.scheduled), showToSaleRate: null },
    funnel: buildFunnel({ ...summary, totalCalls: summary.totalCalls, answered: summary.connected }),
    timeline: buildTimeline(calls, range.fromKey, range.toKey),
    sdrs,
    ranking: sdrs,
    calls: calls.slice(0, 100),
    callsTotal: calls.length,
    objections: [],
    scorecard: { criteria: [], teamAverage: null, note: 'Aguardando análises IA persistidas.' },
    coaching: sdrs.map(row => ({ sdrUid: row.uid, sdrName: row.name, skill: 'Dados insuficientes', evidence: 'Ainda não há scorecards IA suficientes no período.', recommendation: 'Aguardar processamento das calls pela esteira Telnyx/n8n/IA.' })),
    library: { best: [], review: [], training: [] },
    insights: buildInsights({ summary, sdrs }),
    selectedCall: selectedCall ? { ...selectedCall, transcript: '', analysis: null, scorecard: [], recommendations: [], transcriptStatus: 'Transcrição ausente', analysisText: 'Análise pendente ou indisponível para esta ligação.' } : null,
  };
};
const handleFavorite = async ({ body, session }) => {
  const callId = safeId(body.callId);
  if (!callId) return { status: 422, body: { error: 'invalid_call_id' } };
  const favorite = body.favorite !== false;
  const now = new Date().toISOString();
  const id = callId;
  const payload = { id, callId, favorite, category: clean(body.category || 'treinamento').slice(0, 80), updatedAt: now, updatedBy: clean(session.sub) };
  if (favorite) payload.createdAt = now;
  const response = await commitWritesAsAdmin({ writes: [{ update: { name: firestoreDocName(FAVORITES_COLLECTION, id), fields: encodeFields(payload).fields } }] });
  if (!response.ok) return { status: response.status || 500, body: { error: 'favorite_write_failed' } };
  return { status: 200, body: { ok: true } };
};
const createHandler = ({ build = buildModel, authResolver = resolveAdminRequestAuth } = {}) => async (req, res) => {
  if (!['GET', 'POST', 'HEAD'].includes(req.method)) { res.setHeader('Allow', 'GET, POST, HEAD'); return sendJson(res, 405, { error: 'method_not_allowed' }); }
  try {
    const auth = await authResolver(req, { logPrefix: '[admin-sdr]' });
    if (!auth.ok) return sendJson(res, auth.status, auth.body);
    if (clean(auth.session?.role).toLowerCase() !== 'admin') return sendJson(res, 403, { error: 'admin_only' });
    if (req.method === 'POST') {
      const body = await readJsonBody(req);
      if (clean(body.action) === 'favorite_call') { const result = await handleFavorite({ body, session: auth.session }); return sendJson(res, result.status, result.body); }
      return sendJson(res, 400, { error: 'invalid_action' });
    }
    const host = clean(req.headers.host) || 'localhost';
    const url = new URL(req.url || '/api/admin-sdr', `https://${host}`);
    const payload = await build(Object.fromEntries(url.searchParams.entries()));
    return sendJson(res, 200, payload);
  } catch (error) {
    console.error('[admin-sdr] failed', { status: error?.status || 500, code: error?.code || error?.message || 'admin_sdr_failed' });
    return sendJson(res, error?.status || 500, { error: error?.code || error?.message || 'admin_sdr_failed', message: 'Não foi possível carregar o painel SDR agora.' });
  }
};
module.exports = createHandler();
module.exports.createHandler = createHandler;
module.exports.__private = { resolveRange, buildModel, normalizeCall, filterCalls };
