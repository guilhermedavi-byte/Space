const crypto = require('node:crypto');
const WRITE_IN_PROGRESS = 'DATACRAZY_WRITE_IN_PROGRESS';
const WRITE_UNCERTAIN = 'DATACRAZY_WRITE_OUTCOME_UNKNOWN';
const { supabaseFetch } = require('./supabase-rest');

const clean = value => String(value == null ? '' : value).trim();
const asRows = result => Array.isArray(result?.data) ? result.data : [];
const enc = value => encodeURIComponent(clean(value));
const digits = value => clean(value).replace(/\D+/g, '');
const normalizePhone = value => {
  const d = digits(value);
  if (!d) return '';
  if (d.length === 10) return `1${d}`;
  if (d.length === 11 && d.startsWith('1')) return d;
  return d;
};
const eq = (a, b) => normalizePhone(a) && normalizePhone(a) === normalizePhone(b);

const timingSafeEqual = (a, b) => {
  const left = Buffer.from(clean(a));
  const right = Buffer.from(clean(b));
  return left.length > 0 && left.length === right.length && crypto.timingSafeEqual(left, right);
};

const assertN8nAuth = req => {
  const expected = clean(process.env.SPACE_N8N_SHARED_SECRET);
  if (!expected || expected.length < 16) return { ok: false, status: 503, body: { error: 'space_n8n_secret_not_configured' } };
  const supplied = clean(req.headers['x-space-n8n-secret']);
  if (!timingSafeEqual(expected, supplied)) return { ok: false, status: 401, body: { error: 'unauthorized' } };
  return { ok: true };
};

const publicError = error => clean(error?.code || error?.message || 'integration_failed').slice(0, 80);

const callSelect = 'id,space_user_uid,space_user_email,lead_id,opportunity_id,lead_name,from_number,to_number,telnyx_call_leg_id,telnyx_call_session_id,outcome,status,started_at,ended_at,duration_seconds';
const qualificationSelect = 'id,voice_call_id,space_user_uid,context,pain_goal,experience,urgency,decision_investment,key_point,ai_context,ai_pain_goal,ai_experience,ai_urgency,ai_decision_investment,ai_key_point,final_summary,status,updated_at,completed_at,datacrazy_lead_id,datacrazy_note_id,datacrazy_synced_at,datacrazy_sync_status,datacrazy_sync_error';
const scoreSelect = 'recording_id,call_leg_id,call_session_id,from_number,to_number,started_at,duration_seconds,transcript,analysis,score,created_at';

const getCall = async (callId, request = supabaseFetch) => {
  const id = clean(callId);
  if (!id) throw Object.assign(new Error('missing_call_id'), { status: 400 });
  const filters = [`id=eq.${enc(id)}`, `telnyx_call_leg_id=eq.${enc(id)}`, `telnyx_call_session_id=eq.${enc(id)}`];
  for (const filter of filters) {
    const row = asRows(await request(`/voice_calls?select=${callSelect}&${filter}&limit=1`, { timeoutMs: 12000 }))[0];
    if (row) return row;
  }
  throw Object.assign(new Error('call_not_found'), { status: 404 });
};

const getQualification = async (callId, request = supabaseFetch) => asRows(await request(`/voice_call_qualifications?select=${qualificationSelect}&voice_call_id=eq.${enc(callId)}&limit=1`, { timeoutMs: 12000 }))[0] || null;

const getScore = async (call, request = supabaseFetch) => {
  const ids = [call.telnyx_call_leg_id, call.telnyx_call_session_id].map(clean).filter(Boolean);
  for (const id of ids) {
    for (const field of ['call_leg_id', 'call_session_id']) {
      const row = asRows(await request(`/sdr_call_scores?select=${scoreSelect}&${field}=eq.${enc(id)}&limit=1`, { timeoutMs: 12000 }).catch(() => ({ data: [] })))[0];
      if (row) return row;
    }
  }
  const from = clean(call.from_number); const to = clean(call.to_number);
  if (!from || !to) return null;
  const rows = asRows(await request(`/sdr_call_scores?select=${scoreSelect}&from_number=eq.${enc(from)}&to_number=eq.${enc(to)}&order=created_at.desc&limit=8`, { timeoutMs: 12000 }).catch(() => ({ data: [] })));
  const callStart = Date.parse(call.started_at || call.ended_at || '');
  const candidates = rows.map(row => {
    const scoreStart = Date.parse(row.started_at || row.created_at || '');
    const startDelta = callStart && scoreStart ? Math.abs(callStart - scoreStart) / 1000 : 9999;
    const durDelta = call.duration_seconds && row.duration_seconds ? Math.abs(Number(call.duration_seconds) - Number(row.duration_seconds)) : 0;
    return { row, score: startDelta + durDelta };
  }).filter(item => item.score <= 95).sort((a, b) => a.score - b.score);
  return candidates[0] && (!candidates[1] || Math.abs(candidates[0].score - candidates[1].score) > 1) ? candidates[0].row : null;
};

const normalizeQualificationPayload = row => ({
  context: clean(row?.context),
  painGoal: clean(row?.pain_goal),
  experience: clean(row?.experience),
  urgency: clean(row?.urgency),
  decisionInvestment: clean(row?.decision_investment),
  keyPoint: clean(row?.key_point),
  status: clean(row?.status) || 'draft',
  confirmedBySdr: ['complete', 'sent'].includes(clean(row?.status)) && Number.isFinite(Date.parse(row?.completed_at)),
  confirmedAt: clean(row?.completed_at),
  finalSummary: clean(row?.final_summary),
});

const handoffEligible = (call, qualification) => clean(call?.outcome) === 'agendado' && normalizeQualificationPayload(qualification).confirmedBySdr;

const getQualificationPayload = async ({ callId, request = supabaseFetch }) => {
  const call = await getCall(callId, request);
  const [qualification, score] = await Promise.all([getQualification(call.id, request), getScore(call, request)]);
  return {
    callId: clean(call.id),
    phone: clean(call.to_number || call.from_number),
    sdrName: clean(call.space_user_email || call.space_user_uid),
    outcome: clean(call.outcome),
    transcript: clean(score?.transcript),
    qualification: normalizeQualificationPayload(qualification),
    handoffEligible: handoffEligible(call, qualification) && qualification?.datacrazy_sync_status !== 'sent',
    datacrazy: {
      contactId: clean(qualification?.datacrazy_lead_id || call.lead_id),
      dealId: clean(call.opportunity_id),
      syncStatus: clean(qualification?.datacrazy_sync_status),
      alreadySent: qualification?.datacrazy_sync_status === 'sent',
    },
  };
};

const saveAiQualification = async ({ callId, qualification = {}, request = supabaseFetch }) => {
  const call = await getCall(callId, request);
  const now = new Date().toISOString();
  const body = {
    voice_call_id: call.id,
    space_user_uid: clean(call.space_user_uid),
    ai_context: clean(qualification.context).slice(0, 4000),
    ai_pain_goal: clean(qualification.painGoal).slice(0, 4000),
    ai_experience: clean(qualification.experience).slice(0, 4000),
    ai_urgency: clean(qualification.urgency).slice(0, 4000),
    ai_decision_investment: clean(qualification.decisionInvestment).slice(0, 4000),
    ai_key_point: clean(qualification.keyPoint).slice(0, 4000),
    final_summary: clean(qualification.finalSummary).slice(0, 12000),
    status: 'review_required',
    updated_at: now,
  };
  const existing = await getQualification(call.id, request);
  // Late/repeated AI callbacks must never reopen a human-completed qualification.
  if (['complete', 'sent'].includes(existing?.status)) return { ok: true, skipped: true };
  if (clean(existing?.final_summary)) delete body.final_summary;
  let rows;
  if (existing) {
    rows = asRows(await request(`/voice_call_qualifications?voice_call_id=eq.${enc(call.id)}&status=in.(draft,ai_processing,review_required)`, {
      method: 'PATCH', headers: { Prefer: 'return=representation' }, body, timeoutMs: 12000,
    }));
  } else {
    rows = asRows(await request('/voice_call_qualifications?on_conflict=voice_call_id', {
      method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=representation' }, body: { ...body, created_at: now }, timeoutMs: 12000,
    }));
  }
  return { ok: true, skipped: !rows.length, qualification: rows[0] || null };
};

const markDatacrazySynced = async ({ callId, sync = {}, request = supabaseFetch }) => {
  const call = await getCall(callId, request);
  const current = await getQualification(call.id, request);
  if (current?.datacrazy_sync_status === 'sent') return { ok: true, duplicate: true, qualification: current };
  if (!handoffEligible(call, current) || sync.success === false || Number(sync.statusCode) >= 400) throw Object.assign(new Error('datacrazy_sync_not_confirmed'), { status: 409 });
  // This authenticated callback belongs exclusively to the community node's success output.
  // Successful nodes may emit an empty item: noteId is optional, never fabricated.
  const resolved = current.datacrazy_sync_error === WRITE_IN_PROGRESS && current.datacrazy_lead_id
    ? { matched: true, leadId: current.datacrazy_lead_id }
    : await resolveDatacrazy({ callId: call.id, request });
  const suppliedLead = clean(sync.datacrazyLeadId || sync.leadId || sync.contactId || sync.datacrazyId);
  if (!resolved.matched || (suppliedLead && suppliedLead !== resolved.leadId)) throw Object.assign(new Error('datacrazy_unique_match_required'), { status: 409 });
  const body = {
    datacrazy_lead_id: resolved.leadId,
    datacrazy_note_id: clean(sync.datacrazyNoteId || sync.noteId).slice(0, 240) || null,
    datacrazy_synced_at: new Date().toISOString(),
    datacrazy_sync_status: 'sent', status: 'sent', datacrazy_sync_error: null,
    updated_at: new Date().toISOString(),
  };
  const rows = asRows(await request(`/voice_call_qualifications?voice_call_id=eq.${enc(call.id)}&status=eq.complete&completed_at=not.is.null&or=(datacrazy_sync_status.is.null,datacrazy_sync_status.neq.sent)`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body, timeoutMs: 12000 }));
  if (rows[0]) return { ok: true, duplicate: false, qualification: rows[0] };
  const latest = await getQualification(call.id, request);
  if (latest?.datacrazy_sync_status === 'sent') return { ok: true, duplicate: true, qualification: latest };
  throw Object.assign(new Error('datacrazy_sync_not_persisted'), { status: 409 });
};

const claimDatacrazyHandoff = async ({ callId, request = supabaseFetch }) => {
  const call = await getCall(callId, request);
  const current = await getQualification(call.id, request);
  if (current?.datacrazy_sync_status === 'sent') return { ok: true, shouldWrite: false, reason: 'already_sent' };
  if (!handoffEligible(call, current)) return { ok: true, shouldWrite: false, reason: 'qualification_not_confirmed' };
  if ([WRITE_IN_PROGRESS, WRITE_UNCERTAIN].includes(current.datacrazy_sync_error)) return { ok: true, shouldWrite: false, reason: 'write_in_progress_or_uncertain' };
  const resolved = await resolveDatacrazy({ callId: call.id, request });
  if (!resolved.matched) return { ok: true, shouldWrite: false, reason: resolved.reason };
  const rows = asRows(await request(`/voice_call_qualifications?voice_call_id=eq.${enc(call.id)}&status=eq.complete&completed_at=not.is.null&and=(or(datacrazy_sync_status.is.null,datacrazy_sync_status.neq.sent),or(datacrazy_sync_error.is.null,datacrazy_sync_error.not.in.(${WRITE_IN_PROGRESS},${WRITE_UNCERTAIN})))`, {
    method: 'PATCH', headers: { Prefer: 'return=representation' },
    body: { datacrazy_lead_id: resolved.leadId, datacrazy_sync_status: 'pending', datacrazy_sync_error: WRITE_IN_PROGRESS, updated_at: new Date().toISOString() }, timeoutMs: 12000,
  }));
  if (!rows.length) return { ok: true, shouldWrite: false, reason: 'claimed_or_sent' };
  return { ok: true, shouldWrite: true, callId: call.id, leadId: resolved.leadId, note: clean(current.final_summary) || formatQualificationNote({ call, qualification: current }) };
};

const markDatacrazyFailed = async ({ callId, request = supabaseFetch }) => {
  const call = await getCall(callId, request);
  const rows = asRows(await request(`/voice_call_qualifications?voice_call_id=eq.${enc(call.id)}&status=eq.complete&datacrazy_sync_status=in.(pending,failed)`, {
    method: 'PATCH', headers: { Prefer: 'return=representation' }, body: { datacrazy_sync_status: 'failed', datacrazy_sync_error: WRITE_UNCERTAIN }, timeoutMs: 12000,
  }));
  return { ok: true, skipped: !rows.length };
};

const eventWebhookUrl = () => clean(process.env.SPACE_PHONE_QUALIFICATION_N8N_WEBHOOK_URL);
// Only numeric IDs/UUIDs from explicitly supported response headers are logged.
// Never log webhook URLs, request/response bodies, credentials or arbitrary error text.
const correlationId = value => /^(?:[0-9]{1,32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.test(clean(value)) ? clean(value) : null;
const dispatchQualificationEvent = async ({ event, callId, fetchImpl = fetch, now = new Date(), logger = entry => console.info(JSON.stringify(entry)) } = {}) => {
  const url = eventWebhookUrl();
  const payload = { event: clean(event), callId: clean(callId), occurredAt: now.toISOString() };
  const dispatchId = crypto.randomUUID();
  const started = Date.now();
  const log = fields => {
    try { logger({ component: 'space-phone-qualification-dispatch', dispatchId, ...payload, timestamp: new Date().toISOString(), ...fields }); } catch { /* Telemetry must not affect qualification. */ }
  };
  if (!url) {
    log({ phase: 'result', outcome: 'not_configured', httpStatus: null, durationMs: 0 });
    return { ok: false, skipped: true, error: 'n8n_webhook_not_configured', dispatchId };
  }
  log({ phase: 'start' });
  try {
    const response = await fetchImpl(url, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(5000), headers: { 'Content-Type': 'application/json', 'x-space-n8n-secret': clean(process.env.SPACE_N8N_SHARED_SECRET), 'x-space-dispatch-id': dispatchId }, body: JSON.stringify(payload) });
    const executionId = correlationId(response.headers?.get?.('x-n8n-execution-id'));
    const requestId = correlationId(response.headers?.get?.('x-request-id'));
    log({ phase: 'result', outcome: response.ok ? 'accepted' : 'http_error', httpStatus: response.status || 0, durationMs: Date.now() - started, n8nExecutionId: executionId, n8nRequestId: requestId });
    return { ok: response.ok, status: response.status || 0, dispatchId };
  } catch (error) {
    log({ phase: 'result', outcome: ['AbortError', 'TimeoutError'].includes(error?.name) ? 'timeout' : 'transport_error', httpStatus: null, durationMs: Date.now() - started });
    return { ok: false, status: 0, error: 'n8n_dispatch_failed', dispatchId };
  }
};

const requestAiQualification = async ({ call, request = supabaseFetch, now = new Date(), dispatch = dispatchQualificationEvent }) => {
  let current = await getQualification(call.id, request);
  if (!current) {
    await request('/voice_call_qualifications?on_conflict=voice_call_id', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=representation' }, body: { voice_call_id: call.id, space_user_uid: call.space_user_uid, status: 'draft' } });
    current = await getQualification(call.id, request);
  }
  if (!current || !['draft', 'ai_processing'].includes(current.status)) return { skipped: true };
  const staleBefore = now.getTime() - 10 * 60 * 1000;
  if (current.status === 'ai_processing' && Date.parse(current.updated_at) > staleBefore) return { skipped: true, aiStatus: 'pending' };
  const score = await getScore(call, request);
  if (!clean(score?.transcript)) return { skipped: true, aiStatus: 'pending' };
  const stamp = now.toISOString();
  const version = current.updated_at ? `&updated_at=eq.${enc(current.updated_at)}` : '';
  const claim = asRows(await request(`/voice_call_qualifications?voice_call_id=eq.${enc(call.id)}&status=eq.${enc(current.status)}${version}`, {
    method: 'PATCH', headers: { Prefer: 'return=representation' }, body: { status: 'ai_processing', updated_at: stamp }, timeoutMs: 12000,
  }));
  if (!claim.length) return { skipped: true };
  const result = await dispatch({ event: 'qualification.ai_requested', callId: call.id }).catch(() => ({ ok: false, error: 'n8n_dispatch_failed' }));
  if (!result.ok) {
    await request(`/voice_call_qualifications?voice_call_id=eq.${enc(call.id)}&status=eq.ai_processing&updated_at=eq.${enc(stamp)}`, {
      method: 'PATCH', body: { status: 'draft', updated_at: stamp }, timeoutMs: 12000,
    });
  }
  return { ...result, aiStatus: result.ok ? 'pending' : 'failed' };
};

// Reuses the existing qualification table as a retry queue; no dependency on an open browser.
const processPendingQualifications = async ({ request = supabaseFetch, now = new Date() } = {}) => {
  if (!eventWebhookUrl()) return { ok: false, error: 'n8n_webhook_not_configured' };
  const before = new Date(now.getTime() - 60 * 1000).toISOString();
  const expired = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
  const rows = asRows(await request(`/voice_call_qualifications?select=voice_call_id,updated_at,voice_calls!inner(status,ended_at)&voice_calls.status=eq.ended&or=(and(status.eq.draft,updated_at.lt.${enc(before)}),and(status.eq.ai_processing,updated_at.lt.${enc(expired)}))&order=updated_at.asc&limit=10`, { timeoutMs: 12000 }));
  let dispatched = 0;
  const started = Date.now();
  for (const row of rows) {
    if (Date.now() - started > 85000) break;
    const call = await getCall(row.voice_call_id, request);
    if (!call.ended_at && call.status !== 'ended') continue;
    const result = await requestAiQualification({ call, request, now });
    if (result.ok) dispatched++;
    // Rotate entries waiting for transcripts, without overwriting concurrent updates.
    if (result.skipped) await request(`/voice_call_qualifications?voice_call_id=eq.${enc(call.id)}&status=eq.draft&updated_at=eq.${enc(row.updated_at)}`, { method: 'PATCH', body: { updated_at: now.toISOString() } });
  }
  return { ok: true, checked: rows.length, dispatched };
};

const makeMatch = (source, row = {}, extras = {}) => ({
  source,
  datacrazyContactId: clean(row.datacrazy_contact_id || row.contact_id || row.contactId || row.datacrazy_lead_id || row.lead_id || row.leadId || extras.contactId),
  datacrazyDealId: clean(row.datacrazy_deal_id || row.deal_id || row.dealId || row.business_id || extras.dealId),
  phone: clean(row.telefone_normalizado || row.phone_normalized || row.phone || row.telefone || extras.phone),
  name: clean(row.nome || row.name || row.lead_name || extras.name),
});
const matchResult = (candidates, truncated = false) => {
  const matches = [...new Map(candidates.filter(m => m.datacrazyContactId).map(m => [m.datacrazyContactId, m])).values()];
  const matched = !truncated && matches.length === 1;
  return { matches, matched, leadId: matched ? matches[0].datacrazyContactId : null, reason: matched ? null : truncated ? 'match_search_incomplete' : matches.length ? 'ambiguous_match' : 'no_match' };
};

const resolveDatacrazy = async ({ callId = '', phone = '', request = supabaseFetch }) => {
  const call = callId ? await getCall(callId, request) : null;
  // An actual lead relationship is authoritative; a deal/external ID is never a lead ID.
  if (call?.lead_id) return matchResult([makeMatch('voice_call', {}, { contactId: call.lead_id, dealId: call.opportunity_id, phone: call.to_number, name: call.lead_name })]);
  const normalized = normalizePhone(call?.to_number || phone);
  if (!normalized) return matchResult([]);
  const estado = asRows(await request(`/n8n_estado_leads_comercial_space?select=*&telefone_normalizado=eq.${enc(normalized)}&limit=101`, { timeoutMs: 12000 }));
  const candidates = estado.filter(row => eq(row.telefone_normalizado, normalized)).map(row => makeMatch('n8n_estado_leads_comercial_space', row));
  // Fail closed on truncation/infra; suffix-only phone matches are not sufficient evidence.
  return matchResult(candidates, estado.length >= 101);
};

const formatQualificationNote = ({ call, qualification }) => {
  const q = normalizeQualificationPayload(qualification);
  return ['Qualificação SDR — Space', '', `Contexto:\n${q.context || 'Precisa ser validado'}`, '', `Objetivo/Dor:\n${q.painGoal || 'Precisa ser validado'}`, '', `Experiência:\n${q.experience || 'Não identificado'}`, '', `Urgência:\n${q.urgency || 'Precisa ser validado'}`, '', `Decisão/Investimento:\n${q.decisionInvestment || 'Precisa ser validado'}`, '', `Ponto-chave:\n${q.keyPoint || 'Precisa ser validado'}`, '', `SDR:\n${clean(call.space_user_email || call.space_user_uid)}`, '', `Call ID:\n${clean(call.id)}`].join('\n');
};

const datacrazyNote = async ({ callId, datacrazyId, note = '', request = supabaseFetch }) => {
  const call = await getCall(callId, request);
  const qualification = await getQualification(call.id, request);
  if (!qualification) return { ok: false, status: 409, error: 'qualification_required' };
  if (clean(qualification.datacrazy_note_id) || clean(qualification.datacrazy_sync_status) === 'sent') return { ok: true, duplicate: true, noteId: clean(qualification.datacrazy_note_id), status: 'sent' };
  if (!handoffEligible(call, qualification)) return { ok: false, status: 409, error: 'datacrazy_gate_not_satisfied' };
  const target = clean(datacrazyId || qualification.datacrazy_lead_id || call.lead_id || call.opportunity_id);
  if (!target) return { ok: false, status: 409, error: 'datacrazy_match_required' };
  // Retired path: the certified community node owns writes. Never change a claim here.
  return { ok: false, status: 410, error: 'DATACRAZY_WRITE_DELEGATED_TO_N8N', preparedNote: clean(qualification.final_summary) || formatQualificationNote({ call, qualification }) };
};

module.exports = {
  requestAiQualification,
  processPendingQualifications,
  assertN8nAuth,
  clean,
  datacrazyNote,
  dispatchQualificationEvent,
  formatQualificationNote,
  getCall,
  getQualification,
  getQualificationPayload,
  handoffEligible,
  markDatacrazySynced,
  claimDatacrazyHandoff,
  markDatacrazyFailed,
  normalizePhone,
  publicError,
  resolveDatacrazy,
  saveAiQualification,
};
