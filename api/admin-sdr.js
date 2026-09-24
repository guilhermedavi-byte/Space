const { readJsonBody, sendJson } = require('../_lib/http');
const { resolveAdminRequestAuth } = require('./_lib/admin-request-auth');
const { requireResolvedAdminPermission } = require('./_lib/admin-permissions');
const { commitWritesAsAdmin } = require('./_lib/firestore-admin');
const { PROJECT_ID, encodeFields } = require('./_lib/firestore-rest');
const { loadAdminCommercialSdrActivity, addDaysToKey } = require('./_lib/admin-commercial-sdr-activity');
const { supabaseFetch } = require('./_lib/supabase-rest');
const { getCommercialPermissions } = require('./_lib/commercial-permissions');

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

const first = (row, keys, fallback = '') => {
  for (const key of keys) if (row && row[key] != null && clean(row[key]) !== '') return row[key];
  return fallback;
};
const parseMaybeJson = value => {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try { return JSON.parse(String(value)); } catch { return String(value); }
};
const asArray = value => Array.isArray(value) ? value : value && typeof value === 'object' ? Object.values(value) : [];
const localPartsFromIso = value => {
  const raw = clean(value);
  if (!raw) return { dateKey: '', time: '' };
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return { dateKey: parseDateKey(raw.slice(0, 10)), time: raw.slice(11, 16) };
  const parts = Object.fromEntries(new Intl.DateTimeFormat('sv-SE', { timeZone: TIME_ZONE, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12:false }).formatToParts(d).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
  return { dateKey: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
};
const normalizeScorecard = analysis => {
  const src = analysis && typeof analysis === 'object' ? (analysis.criteria || analysis.scorecard || analysis.scores || analysis.dimensions || {}) : {};
  const entries = Array.isArray(src) ? src.map(item => [first(item, ['name','label','criterion','criterio'], ''), item]) : Object.entries(src || {});
  return entries.map(([name, value]) => {
    const score = typeof value === 'object' ? first(value, ['score','value','nota','rating'], null) : value;
    return { name: clean(name), score: Number.isFinite(Number(score)) ? Number(score) : null };
  }).filter(x => x.name);
};
const normalizeList = value => Array.isArray(value) ? value.map(clean).filter(Boolean) : clean(value) ? [clean(value)] : [];
const normalizeAnalysisStatus = value => {
  const raw = clean(value).toLowerCase();
  if (!raw) return 'completed';
  if (raw.includes('transcrib')) return 'transcribing';
  if (raw.includes('analis') || raw.includes('analyz')) return 'analyzing';
  if (raw.includes('erro') || raw.includes('error') || raw.includes('fail')) return 'error';
  if (raw.includes('conclu') || raw.includes('done') || raw.includes('complete') || raw.includes('success')) return 'completed';
  return raw;
};
const normalizeScoredCall = (row = {}) => {
  const analysis = parseMaybeJson(row.analysis ?? null);
  const started = row.started_at || row.created_at || row.ended_at || '';
  const local = localPartsFromIso(started);
  const duration = row.duration_seconds;
  const score = row.score;
  const recordingId = clean(row.recording_id);
  const callLegId = clean(row.call_leg_id);
  const sessionId = clean(row.call_session_id);
  const transcript = Object.prototype.hasOwnProperty.call(row, 'transcript') ? clean(row.transcript) : '';
  const analysisStatus = normalizeAnalysisStatus(score != null ? 'completed' : transcript ? 'analyzing' : 'pending');
  const summary = typeof analysis === 'object' ? clean(first(analysis, ['summary','resumo'], '')) : clean(analysis);
  return {
    id: recordingId,
    sourceKind: 'ai_score',
    dateKey: local.dateKey,
    time: local.time,
    createdAt: clean(row.created_at),
    startedAt: clean(row.started_at),
    endedAt: clean(row.ended_at),
    sdrUid: clean(row.sdr),
    sdrName: clean(row.sdr) || 'SDR',
    leadName: '',
    phone: clean(row.to_number),
    durationSeconds: Number.isFinite(Number(duration)) ? Number(duration) : null,
    score: Number.isFinite(Number(score)) ? Number(score) : null,
    scriptAdherence: null,
    outcome: 'none',
    outcomeLabel: '—',
    recording: clean(row.recording_url),
    recordingId,
    callId: callLegId || sessionId || recordingId,
    callLegId,
    callSessionId: sessionId,
    connectionId: clean(row.connection_id),
    fromNumber: clean(row.from_number),
    toNumber: clean(row.to_number),
    transcriptAvailable: Boolean(transcript),
    transcript,
    analysis,
    status: 'connected',
    analysisStatus,
    scorecard: normalizeScorecard(analysis),
    summary,
    strengths: typeof analysis === 'object' ? normalizeList(first(analysis, ['strengths','pontos_fortes','acertos'], [])) : [],
    weaknesses: typeof analysis === 'object' ? normalizeList(first(analysis, ['weaknesses','pontos_melhoria','erros'], [])) : [],
    recommendations: typeof analysis === 'object' ? normalizeList(first(analysis, ['recommendations','recomendacoes'], [])) : [],
    missedOpportunity: typeof analysis === 'object' ? clean(first(analysis, ['missed_opportunity','best_missed_opportunity','melhor_oportunidade'], '')) : '',
    biggestMistake: typeof analysis === 'object' ? clean(first(analysis, ['biggest_mistake','maior_erro'], '')) : '',
    nextImprovement: typeof analysis === 'object' ? clean(first(analysis, ['next_action','next_improvement','proxima_melhoria'], '')) : '',
  };
};
const SCORE_LIST_SELECT = 'recording_id,call_leg_id,call_session_id,sdr,from_number,to_number,duration_seconds,score,started_at,created_at';
const SCORE_DETAIL_SELECT = 'recording_id,call_leg_id,call_session_id,connection_id,sdr,from_number,to_number,started_at,ended_at,duration_seconds,transcript,score,analysis,recording_url,created_at';
const scoreRangeParams = ({ fromKey = '', toKey = '' } = {}) => {
  const params = [];
  if (parseDateKey(fromKey)) params.push(`created_at=gte.${encodeURIComponent(`${fromKey}T00:00:00-03:00`)}`);
  if (parseDateKey(toKey)) params.push(`created_at=lt.${encodeURIComponent(`${addDaysToKey(toKey, 1)}T00:00:00-03:00`)}`);
  return params.length ? `&${params.join('&')}` : '';
};
const loadScoredCalls = async ({ request = supabaseFetch, limit = 10, offset = 0, fromKey = '', toKey = '' } = {}) => {
  try {
    const safeLimit = Math.max(1, Math.min(Number(limit)||10, 100));
    const safeOffset = Math.max(0, Number(offset)||0);
    // Merge the two sorted streams so null started_at uses created_at before pagination.
    const base = `/sdr_call_scores?select=${SCORE_LIST_SELECT}${scoreRangeParams({ fromKey, toKey })}`;
    const take = safeOffset + safeLimit;
    const results = await Promise.all([
      request(`${base}&started_at=not.is.null&order=started_at.desc,recording_id.desc&limit=${take}`, { timeoutMs: 15000 }),
      request(`${base}&started_at=is.null&order=created_at.desc,recording_id.desc&limit=${take}`, { timeoutMs: 15000 }),
    ]);
    const rows = [...new Map(results.flatMap(res => Array.isArray(res.data) ? res.data : []).map(row => [row.recording_id, row])).values()]
      .sort((a, b) => (Date.parse(b.started_at || b.created_at) || 0) - (Date.parse(a.started_at || a.created_at) || 0) || String(b.recording_id).localeCompare(String(a.recording_id)))
      .slice(safeOffset, safeOffset + safeLimit);
    return { ok: true, table: 'sdr_call_scores', rows, calls: rows.map(normalizeScoredCall).filter(call => call.id), columns: rows[0] ? Object.keys(rows[0]) : [] };
  } catch (error) {
    return { ok: false, table: 'sdr_call_scores', rows: [], calls: [], columns: [], error: String(error.code || error.message || 'sdr_call_scores_unavailable').slice(0, 80) };
  }
};
const loadScoredCallStats = async ({ request = supabaseFetch, limit = 500, fromKey = '', toKey = '' } = {}) => {
  try {
    const res = await request(`/sdr_call_scores?select=${SCORE_LIST_SELECT}${scoreRangeParams({ fromKey, toKey })}&order=created_at.desc&limit=${Math.max(1, Math.min(Number(limit)||500, 1000))}`, { timeoutMs: 15000 });
    const rows = Array.isArray(res.data) ? res.data : [];
    return { ok: true, table: 'sdr_call_scores', rows, calls: rows.map(normalizeScoredCall).filter(call => call.id), columns: rows[0] ? Object.keys(rows[0]) : [] };
  } catch (error) {
    return { ok: false, table: 'sdr_call_scores', rows: [], calls: [], columns: [], error: String(error.code || error.message || 'sdr_call_scores_unavailable').slice(0, 80) };
  }
};
const loadScoredCallDetail = async ({ request = supabaseFetch, recordingId } = {}) => {
  const id = clean(recordingId);
  if (!id) return null;
  const res = await request(`/sdr_call_scores?select=${SCORE_DETAIL_SELECT}&recording_id=eq.${encodeURIComponent(id)}&limit=1`, { timeoutMs: 15000 });
  const row = Array.isArray(res.data) ? res.data[0] : null;
  return row ? normalizeScoredCall(row) : null;
};
const avg = rows => { const nums = rows.map(Number).filter(Number.isFinite); return nums.length ? nums.reduce((a,b)=>a+b,0)/nums.length : null; };

const VOICE_CALL_SELECT = 'id,space_user_uid,space_user_email,lead_name,from_number,to_number,telnyx_call_leg_id,telnyx_call_session_id,status,started_at,answered_at,ended_at,duration_seconds,outcome,callback_at,created_at,updated_at';
const QUALIFICATION_SELECT = 'voice_call_id,status,completed_at,datacrazy_note_id,datacrazy_sync_status,datacrazy_sync_error,context,pain_goal,urgency,decision_investment,key_point';
const voiceRangeParams = ({ fromKey = '', toKey = '' } = {}) => {
  const params = [];
  if (parseDateKey(fromKey)) params.push(`started_at=gte.${encodeURIComponent(`${fromKey}T00:00:00-03:00`)}`);
  if (parseDateKey(toKey)) params.push(`started_at=lt.${encodeURIComponent(`${addDaysToKey(toKey, 1)}T00:00:00-03:00`)}`);
  return params.length ? `&${params.join('&')}` : '';
};
const normalizeVoiceStatus = row => {
  const raw = clean(row.status).toLowerCase();
  const outcome = clean(row.outcome);
  if (['failed', 'error', 'erro'].includes(raw)) return 'failed';
  if (['nao_atendeu', 'ocupado', 'numero_invalido', 'caixa_postal'].includes(outcome)) return 'unanswered';
  if (row.answered_at || row.ended_at || ['completed','connected','answered','ended'].includes(raw)) return 'connected';
  return raw || 'connected';
};
const normalizeVoiceCall = (row = {}) => {
  const started = row.started_at || row.created_at || row.ended_at || '';
  const local = localPartsFromIso(started);
  const sourceOutcome = clean(row.outcome);
  const status = normalizeVoiceStatus(row);
  return {
    id: clean(row.id),
    sourceKind: 'space_phone',
    sourceVoiceCallId: clean(row.id),
    dateKey: local.dateKey,
    time: local.time,
    createdAt: clean(row.created_at),
    startedAt: clean(row.started_at),
    endedAt: clean(row.ended_at),
    sdrUid: clean(row.space_user_uid),
    sdrName: clean(row.space_user_email || row.space_user_uid || 'SDR'),
    sdrEmail: clean(row.space_user_email),
    leadName: clean(row.lead_name),
    phone: clean(row.to_number),
    fromNumber: clean(row.from_number),
    toNumber: clean(row.to_number),
    durationSeconds: Number.isFinite(Number(row.duration_seconds)) ? Number(row.duration_seconds) : null,
    score: null,
    scriptAdherence: null,
    outcome: sourceOutcome === 'agendado' ? 'scheduled' : 'none',
    sourceOutcome,
    outcomeLabel: detailedOutcomeLabel(sourceOutcome),
    recording: '',
    recordingId: '',
    callId: clean(row.id),
    callLegId: clean(row.telnyx_call_leg_id),
    callSessionId: clean(row.telnyx_call_session_id),
    transcriptAvailable: false,
    transcript: '',
    analysis: null,
    status,
    analysisStatus: 'processing',
    scorecard: [],
    summary: '',
    strengths: [],
    weaknesses: [],
    recommendations: [],
    qualificationStatus: 'pending',
    qualificationLabel: 'Pendente',
    handoffLabel: 'Pendente',
    datacrazyStatus: '',
  };
};

const normalizeQualificationStatus = row => {
  if (!row) return { status: 'pending', label: 'Pendente', complete: false, handoffLabel: 'Pendente', datacrazyStatus: '' };
  const status = clean(row.status) || 'draft';
  const required = ['context','pain_goal','urgency','decision_investment','key_point'];
  const complete = ['complete','sent'].includes(status) || required.every(field => clean(row[field]));
  const datacrazyStatus = clean(row.datacrazy_sync_status);
  return {
    status,
    label: complete ? 'Completa ✓' : status === 'review_required' ? 'Revisão IA' : 'Pendente',
    complete,
    handoffLabel: clean(row.datacrazy_note_id) ? 'Enviado ao CRM ✓' : datacrazyStatus === 'blocked_api_audit' ? 'Datacrazy bloqueado' : datacrazyStatus === 'lead_not_found' ? 'Lead não encontrado' : datacrazyStatus === 'lead_ambiguous' ? 'Lead ambíguo' : 'Pendente',
    datacrazyStatus,
  };
};
const loadQualificationMap = async ({ request = supabaseFetch, callIds = [] } = {}) => {
  const ids = [...new Set(callIds.map(clean).filter(Boolean))];
  const map = new Map();
  if (!ids.length) return map;
  try {
    const quoted = ids.map(id => `"${id}"`).join(',');
    const res = await request(`/voice_call_qualifications?select=${QUALIFICATION_SELECT}&voice_call_id=in.(${encodeURIComponent(quoted)})&limit=${Math.min(ids.length, 1000)}`, { timeoutMs: 12000 });
    (Array.isArray(res.data) ? res.data : []).forEach(row => map.set(clean(row.voice_call_id), normalizeQualificationStatus(row)));
  } catch {
    // Qualification table is additive; SDR panel should keep loading if migration is pending.
  }
  return map;
};

const loadVoiceCalls = async ({ request = supabaseFetch, fromKey = '', toKey = '', limit = 500 } = {}) => {
  try {
    const res = await request(`/voice_calls?select=${VOICE_CALL_SELECT}${voiceRangeParams({ fromKey, toKey })}&order=started_at.desc.nullslast,created_at.desc&limit=${Math.max(1, Math.min(Number(limit)||500, 1000))}`, { timeoutMs: 15000 });
    const rows = Array.isArray(res.data) ? res.data : [];
    return { ok: true, rows, calls: rows.map(normalizeVoiceCall).filter(call => call.id), error: null };
  } catch (error) {
    return { ok: false, rows: [], calls: [], error: String(error.code || error.message || 'voice_calls_unavailable').slice(0, 80) };
  }
};
const scoreAnalysisCandidate = (call = {}, score = {}) => {
  if (clean(call.fromNumber) !== clean(score.fromNumber)) return null;
  if (clean(call.toNumber || call.phone) !== clean(score.toNumber || score.phone)) return null;
  const callStarted = Date.parse(call.startedAt || call.createdAt || '');
  const scoreStarted = Date.parse(score.startedAt || score.createdAt || '');
  if (!callStarted || !scoreStarted) return null;
  const startedDeltaSeconds = Math.abs(callStarted - scoreStarted) / 1000;
  if (startedDeltaSeconds > 90) return null;
  const durationDeltaSeconds = Math.abs(number(call.durationSeconds) - number(score.durationSeconds));
  if (call.durationSeconds && score.durationSeconds && durationDeltaSeconds > 5) return null;
  return startedDeltaSeconds + durationDeltaSeconds;
};
const enrichVoiceCall = (call, score) => score ? {
  ...call,
  score: score.score,
  scriptAdherence: score.scriptAdherence,
  recording: score.recording,
  recordingId: score.recordingId,
  callId: call.id,
  callLegId: call.callLegId || score.callLegId,
  callSessionId: call.callSessionId || score.callSessionId,
  transcriptAvailable: score.transcriptAvailable,
  transcript: score.transcript || '',
  analysis: score.analysis,
  analysisStatus: score.analysisStatus === 'completed' ? 'completed' : score.analysisStatus || 'processing',
  scorecard: score.scorecard || [],
  summary: score.summary || '',
  strengths: score.strengths || [],
  weaknesses: score.weaknesses || [],
  recommendations: score.recommendations || [],
  aiSdrName: score.aiSdrName || score.sdrName,
} : call;
const mergeVoiceAndScoreCalls = (voiceCalls = [], scoredCalls = []) => {
  const usedScores = new Set();
  const byLeg = new Map();
  const bySession = new Map();
  scoredCalls.forEach(score => {
    if (score.callLegId) byLeg.set(score.callLegId, score);
    if (score.callSessionId) bySession.set(score.callSessionId, score);
  });
  const merged = voiceCalls.map(call => {
    let score = (call.callLegId && byLeg.get(call.callLegId)) || (call.callSessionId && bySession.get(call.callSessionId));
    if (!score) {
      const candidates = scoredCalls.filter(item => !usedScores.has(item.id)).map(item => ({ item, score: scoreAnalysisCandidate(call, item) })).filter(item => item.score != null).sort((a,b)=>a.score-b.score);
      if (candidates[0] && (!candidates[1] || Math.abs(candidates[0].score - candidates[1].score) > 1)) score = candidates[0].item;
    }
    if (score?.id) usedScores.add(score.id);
    return enrichVoiceCall(call, score);
  });
  scoredCalls.forEach(score => { if (!usedScores.has(score.id)) merged.push(score); });
  return [...new Map(merged.map(call => [call.sourceVoiceCallId ? `voice:${call.sourceVoiceCallId}` : `score:${call.id}`, call])).values()]
    .sort((a,b)=>(Date.parse(b.startedAt || b.createdAt || '') || 0) - (Date.parse(a.startedAt || a.createdAt || '') || 0));
};


const firestoreDocName = (collection, id) => {
  if (!PROJECT_ID) throw Object.assign(new Error('missing_project_id'), { status: 503 });
  return `projects/${PROJECT_ID}/databases/(default)/documents/${collection}/${encodeURIComponent(id)}`;
};
const detailedOutcomeLabel = outcome => ({ nao_atendeu: 'Não atendeu', ocupado: 'Ocupado', numero_invalido: 'Número inválido', caixa_postal: 'Caixa postal', sem_interesse: 'Sem interesse', retornar_depois: 'Retornar', interessado: 'Interessado', agendado: 'Agendado' }[clean(outcome)] || 'Pendente');
const outcomeLabel = outcome => ({ nao_atendeu: 'Não atendida', atendeu: 'Atendida', agendou: 'Agendamento', double: 'Agendamento', show: 'Show', noshow: 'No-show' }[clean(outcome)] || detailedOutcomeLabel(outcome) || 'Sem resultado');
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
const normalizePersonKey = value => clean(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const personTokens = value => normalizePersonKey(value).split(/\s+/).filter(token => token.length >= 3);
const namesMatch = (a, b) => {
  const left = personTokens(a); const right = personTokens(b);
  if (!left.length || !right.length) return false;
  const leftSet = new Set(left); const rightSet = new Set(right);
  return left.some(token => rightSet.has(token)) || right.some(token => leftSet.has(token));
};
const attachScoredCallSdrs = (scoredCalls = [], sdrRows = []) => scoredCalls.map(call => {
  const matched = (sdrRows || []).find(row => namesMatch(row.sdrName || row.nome || row.uid, call.sdrName));
  return matched ? { ...call, sdrUid: clean(matched.sdrUid || matched.uid) || call.sdrUid, sdrName: clean(matched.sdrName || matched.nome) || call.sdrName, aiSdrName: call.sdrName } : call;
});
const aggregateSdr = (row = {}, calls = [], scoredCalls = []) => {
  const uid = clean(row.sdrUid || row.uid);
  const own = calls.filter(call => call.sdrUid === uid);
  const ownScores = scoredCalls.filter(call => (uid && call.sdrUid === uid) || namesMatch(row.sdrName || row.nome, call.sdrName || call.aiSdrName));
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
    over1m: ownScores.filter(call => Number(call.durationSeconds) >= 60).length || null,
    over5m: ownScores.filter(call => Number(call.durationSeconds) >= 300).length || null,
    scheduled,
    callToScheduleRate: pct(scheduled, totalCalls),
    shows,
    noShows,
    showRate: pct(shows, scheduled),
    sales: 0,
    showToSaleRate: null,
    revenue: 0,
    analyzedCalls: ownScores.length,
    avgScore: avg(ownScores.map(call => call.score)),
    scriptAdherence: avg(ownScores.map(call => call.scriptAdherence)),
    trend: buildTimeline(own, own[own.length - 1]?.dateKey || '', own[0]?.dateKey || '').slice(-8),
  };
};
const buildFunnel = summary => {
  const calls = number(summary.totalCalls);
  const connected = number(summary.answered);
  const relevant = number(summary.over1m);
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
  if (sdr && sdr !== 'all' && call.sdrUid !== sdr && call.sdrName !== sdr) return false;
  if (status === 'connected' && call.status !== 'connected') return false;
  if (status === 'unanswered' && call.status !== 'unanswered') return false;
  if (status === 'over1m' && (Number(call.durationSeconds) || 0) < 60) return false;
  if (status === 'over2m' && (Number(call.durationSeconds) || 0) < 120) return false;
  if (status === 'over5m' && (Number(call.durationSeconds) || 0) < 300) return false;
  if (status === 'over10m' && (Number(call.durationSeconds) || 0) < 600) return false;
  if (score && score !== 'all') {
    const value = Number(call.score);
    if (!Number.isFinite(value)) return false;
    if (score === '90' && value < 90) return false;
    if (score === '80' && (value < 80 || value >= 90)) return false;
    if (score === '70' && (value < 70 || value >= 80)) return false;
    if (score === '60' && (value < 60 || value >= 70)) return false;
    if ((score === 'lt60' || score === 'low') && value >= 60) return false;
  }
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
const buildModel = async (query = {}, deps = {}) => {
  const range = resolveRange(query);
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.max(1, Math.min(Number(query.pageSize) || (query.tab === 'calls' ? 25 : 10), 100));
  const offset = (page - 1) * pageSize;
  const request = deps.request || supabaseFetch;
  const activity = deps.activity ? await deps.activity({ period: 'custom', from: range.fromKey, to: range.toKey, range }) : await loadAdminCommercialSdrActivity({ period: 'custom', from: range.fromKey, to: range.toKey });
  const statsSource = await loadScoredCallStats({ request, fromKey: range.fromKey, toKey: range.toKey });
  const voiceSource = await loadVoiceCalls({ request, fromKey: range.fromKey, toKey: range.toKey });
  const qualificationMap = await loadQualificationMap({ request, callIds: voiceSource.calls.map(call => call.id) });
  voiceSource.calls = voiceSource.calls.map(call => { const q = qualificationMap.get(clean(call.id)); return q ? { ...call, qualificationStatus: q.status, qualificationLabel: q.label, handoffLabel: q.handoffLabel, datacrazyStatus: q.datacrazyStatus } : call; });
  const operationalRows = activity.sdrs || [];
  const voiceCalls = voiceSource.calls.map(call => {
    const matched = operationalRows.find(row => clean(row.sdrUid || row.uid) && clean(row.sdrUid || row.uid) === clean(call.sdrUid));
    return matched ? { ...call, sdrName: clean(matched.sdrName || matched.nome) || call.sdrName, sdrEmail: clean(matched.sdrEmail || matched.email) || call.sdrEmail } : call;
  });
  const rawScoredCalls = attachScoredCallSdrs(statsSource.calls, operationalRows);
  const activityCalls = (activity.events || []).filter(event => clean(event.source) !== 'space_phone').map(normalizeCall);
  const mergedCalls = mergeVoiceAndScoreCalls(voiceCalls, rawScoredCalls);
  const rawCalls = [...mergedCalls, ...activityCalls].sort((a,b)=>(Date.parse(b.startedAt || `${b.dateKey}T${b.time || '00:00'}:00-03:00`) || 0) - (Date.parse(a.startedAt || `${a.dateKey}T${a.time || '00:00'}:00-03:00`) || 0));
  const calls = filterCalls(rawCalls, query);
  const pagedCalls = calls.slice(offset, offset + pageSize);
  const scoredForKpi = rawCalls.filter(c => c.score != null || c.analysisStatus === 'completed');
  const summary = {
    totalCalls: calls.filter(c => c.status !== 'meeting').length,
    connected: calls.filter(c => c.status === 'connected').length,
    answered: calls.filter(c => c.status === 'connected').length,
    over1m: rawCalls.filter(c => c.status !== 'meeting' && Number(c.durationSeconds) >= 60).length || null,
    over2m: rawCalls.filter(c => c.status !== 'meeting' && Number(c.durationSeconds) >= 120).length || null,
    over5m: rawCalls.filter(c => c.status !== 'meeting' && Number(c.durationSeconds) >= 300).length || null,
    over10m: rawCalls.filter(c => c.status !== 'meeting' && Number(c.durationSeconds) >= 600).length || null,
    totalDurationSeconds: rawCalls.some(c => c.durationSeconds != null) ? rawCalls.reduce((sum,c)=>sum+number(c.durationSeconds),0) : null,
    avgDurationSeconds: avg(rawCalls.map(c => c.durationSeconds)),
    scheduled: calls.filter(c => c.outcome === 'scheduled').length,
    pendingOutcome: calls.filter(c => c.status !== 'meeting' && (!c.sourceOutcome && c.outcome === 'none')).length,
    shows: calls.filter(c => c.outcome === 'show').length,
    noShows: calls.filter(c => c.outcome === 'noshow').length,
    sales: null,
    revenue: null,
    avgTicket: null,
    analyzedCalls: scoredForKpi.length,
    avgScore: avg(scoredForKpi.map(call => call.score)),
    scriptAdherence: avg(scoredForKpi.map(call => call.scriptAdherence)),
  };
  const operationalSdrs = operationalRows.map(row => aggregateSdr(row, rawCalls, scoredForKpi));
  const scoreOnlySdrs = [...new Set(rawCalls.filter(call => !call.sdrUid).map(call => call.sdrName).filter(Boolean))]
    .filter(name => !operationalSdrs.some(row => namesMatch(row.name, name)))
    .map(name => aggregateSdr({ sdrUid: name, sdrName: name, sdrEmail: '' }, rawCalls, scoredForKpi));
  const sdrs = [...operationalSdrs, ...scoreOnlySdrs].filter(row => !query.sdr || query.sdr === 'all' || row.uid === query.sdr || row.name === query.sdr);
  const sdrOptions = [...new Map([...operationalSdrs, ...scoreOnlySdrs].map(row => [row.uid || row.name, { uid: row.uid || row.name, name: row.name || 'SDR', email: row.email || '' }])).values()];
  let selectedCall = null;
  if (query.callId) {
    const rawMatch = rawCalls.find(call => [call.id, call.recordingId, call.callId, call.callLegId, call.callSessionId].map(clean).includes(clean(query.callId)));
    if (rawMatch?.recordingId && clean(rawMatch.recordingId) === clean(query.callId)) selectedCall = await loadScoredCallDetail({ request, recordingId: query.callId }).catch(() => null) || rawMatch;
    else selectedCall = rawMatch || await loadScoredCallDetail({ request, recordingId: query.callId }).catch(() => null);
  }
  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    source: { operational: 'Postgres/voice_calls + Firestore/sdrActivityEvents', callAnalysis: statsSource.ok ? 'Postgres/sdr_call_scores' : 'sdr_call_scores_unavailable', usesMockData: false, voiceRows: voiceSource.rows.length, voiceError: voiceSource.error || null, scoreTable: statsSource.table, scoreRows: statsSource.rows.length, scoreColumns: statsSource.columns, scoreError: statsSource.error || null },
    filters: { period: range.period, fromKey: range.fromKey, toKey: range.toKey, sdr: query.sdr || 'all', status: query.status || 'all', score: query.score || 'all', result: query.result || 'all' },
    sdrOptions,
    kpis: { ...summary, callToScheduleRate: pct(summary.scheduled, summary.totalCalls), showRate: pct(summary.shows, summary.scheduled), showToSaleRate: null },
    funnel: buildFunnel({ ...summary, totalCalls: summary.totalCalls, answered: summary.connected }),
    timeline: buildTimeline(calls, range.fromKey, range.toKey),
    sdrs,
    ranking: sdrs,
    calls: pagedCalls,
    operationalEvents: calls.slice(0, 100),
    callsTotal: calls.length,
    pagination: { page, pageSize, hasNext: offset + pageSize < calls.length, hasPrevious: page > 1 },
    objections: [],
    scorecard: { criteria: [], teamAverage: null, note: 'Aguardando análises IA persistidas.' },
    coaching: sdrs.map(row => ({ sdrUid: row.uid, sdrName: row.name, skill: 'Dados insuficientes', evidence: 'Ainda não há scorecards IA suficientes no período.', recommendation: 'Aguardar processamento das calls pela esteira Telnyx/n8n/IA.' })),
    library: { best: [], review: [], training: [] },
    insights: buildInsights({ summary, sdrs }),
    selectedCall: selectedCall ? { ...selectedCall, transcriptStatus: selectedCall.transcript ? 'Transcrição concluída' : 'Transcrição ausente', analysisText: selectedCall.summary || (selectedCall.analysis ? 'Análise disponível.' : 'Análise pendente ou indisponível para esta ligação.') } : null,
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
const createHandler = ({ build = buildModel, authResolver = resolveAdminRequestAuth, permissionResolver = requireResolvedAdminPermission } = {}) => async (req, res) => {
  if (!['GET', 'POST', 'HEAD'].includes(req.method)) { res.setHeader('Allow', 'GET, POST, HEAD'); return sendJson(res, 405, { error: 'method_not_allowed' }); }
  try {
    const auth = await authResolver(req, { logPrefix: '[admin-sdr]' });
    if (!auth.ok) return sendJson(res, auth.status, auth.body);
    const session = auth.session || {};
    const userForPermissions = {
      ...session,
      commercialRoles: session.commercialRoles || auth.profile?.user?.commercialRoles || auth.profile?.commercialRoles || [],
    };
    const commercial = getCommercialPermissions(userForPermissions);
    const isAdmin = commercial.platformRole === 'admin';
    const isGrowthSdr = commercial.platformRole === 'growth' && commercial.canUseSdrWorkspace;
    if (!isAdmin && !isGrowthSdr) return sendJson(res, 403, { error: 'sdr_access_required' });
    if (isAdmin) {
      const perm = await permissionResolver(auth, 'comercial.sdrPanel.view');
      if (!perm.ok) return sendJson(res, perm.status, perm.body);
    }
    if (req.method === 'POST') {
      if (!isAdmin) return sendJson(res, 403, { error: 'admin_only' });
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
module.exports.__private = { resolveRange, buildModel, normalizeCall, normalizeScoredCall, normalizeVoiceCall, mergeVoiceAndScoreCalls, filterCalls, loadScoredCalls, loadVoiceCalls, loadQualificationMap, normalizeQualificationStatus, namesMatch, attachScoredCallSdrs };
