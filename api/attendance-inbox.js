const { randomUUID } = require('node:crypto');
const { readJsonBody, sendJson } = require('../_lib/http');
const { requireAttendanceAuth } = require('./_lib/attendance-auth');
const { fail, uuid } = require('./_lib/attendance-domain');
const { supabaseFetch } = require('./_lib/supabase-rest');
const { resolveAttendanceContext } = require('./_lib/attendance-context');
const crmService = require('./_lib/crm-service');
const { getDocumentAsAdmin } = require('./_lib/firestore-admin');

const clean = (value, max = 120) => String(value || '').trim().slice(0, max);
const limit = (value, fallback = 50) => {
  const n = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(n, 50));
};
const { contactProfile } = require('./_lib/attendance-contact-profile');
const publicError = (error) => {
  const status = [400, 401, 403, 409, 422].includes(Number(error.status)) ? Number(error.status)
    : Number(error.status) === 42501 || String(error.code || '') === '42501' ? 403
    : String(error.code || '') === 'PT409' || String(error.code || '') === '23505' ? 409
    : 503;
  const safe = new Set([
    'evolution_not_configured', 'evolution_configuration_error', 'evolution_unavailable',
    'attendance_channel_disabled', 'attendance_invalid_recipient', 'attendance_version_conflict',
    'attendance_forbidden', 'attendance_reopen_conflict', 'attendance_invalid_identity',
  ]);
  return { status, error: safe.has(error.code) || safe.has(error.message) ? (error.code || error.message) : status === 503 ? 'attendance_unavailable' : 'attendance_request_rejected' };
};
const sanitizePayload = value => {
  if (Array.isArray(value)) return value.map(sanitizePayload);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !/(token|secret|authorization|credential|api[_-]?key|webhook|raw_event|instance|metadata)/i.test(key))
    .map(([key, entry]) => [key, sanitizePayload(entry)]));
  if (typeof value !== 'string') return value;
  let safe = value;
  for (const key of ['EVOLUTION_API_KEY', 'EVOLUTION_INSTANCE_TOKEN', 'SUPABASE_SERVICE_ROLE_KEY', 'META_APP_SECRET', 'META_ACCESS_TOKEN', 'META_WEBHOOK_VERIFY_TOKEN']) {
    const secret = process.env[key];
    if (secret) safe = safe.split(secret).join('[redacted]');
  }
  return safe;
};
const evolutionRequest = async (instance, number, text) => {
  const key = String(process.env.EVOLUTION_API_KEY || '').trim();
  const baseRaw = String(process.env.EVOLUTION_API_URL || '').trim();
  let base;
  try { base = new URL(baseRaw); } catch { fail('evolution_not_configured', 503); }
  if (!key || base.protocol !== 'https:' || !/^[a-zA-Z0-9_-]{1,100}$/.test(instance)) fail('evolution_not_configured', 503);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(base.href.replace(/\/$/, '') + '/message/sendText/' + encodeURIComponent(instance), {
      method: 'POST', redirect: 'error', signal: controller.signal,
      headers: { apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ number, text, linkPreview: true }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.warn('[attendance-inbox] evolution send failed', { status: response.status });
      fail(response.status === 401 || response.status === 403 ? 'evolution_configuration_error' : 'evolution_unavailable', 503);
    }
    return payload;
  } catch (error) {
    if (String(error.code || '').startsWith('evolution_')) throw error;
    console.warn('[attendance-inbox] evolution send failed', { timeout: error.name === 'AbortError' });
    fail('evolution_unavailable', 503);
  } finally { clearTimeout(timer); }
};

const actorCrmUser = async (actor) => {
  const row = actor?.uid ? await getDocumentAsAdmin(`users/${encodeURIComponent(actor.uid)}`).catch(() => null) : null;
  return { role: actor?.role || '', commercialRoles: row?.commercialRoles || [] };
};

const updateIdentity = ({ request, actor, conversationId, version, person = {}, state = 'linked', origin = 'manual_verified_reference' }) => request('/rpc/attendance_update_conversation', {
  method: 'POST',
  body: {
    p_actor_uid: actor.uid,
    p_conversation_id: conversationId,
    p_command: state === 'linked' ? {
      action: 'identity',
      client_action_id: `identity:${origin}:${person.id}:${randomUUID()}`,
      expected_version: version,
      resolution_state: 'linked',
      internal_source: person.source || 'firestore',
      internal_person_type: person.type === 'student' ? 'student' : 'lead',
      internal_person_id: person.id,
      resolution_origin: origin,
    } : {
      action: 'identity',
      client_action_id: `identity:${state}:${randomUUID()}`,
      expected_version: version,
      resolution_state: state,
    },
  },
  timeoutMs: 15000,
});

const createHandler = ({ authenticate = requireAttendanceAuth, request = supabaseFetch, sendEvolution = evolutionRequest, resolveProfile = contactProfile, resolveContext = resolveAttendanceContext } = {}) => async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'POST'].includes(req.method)) return sendJson(res, 405, { error: 'method_not_allowed' });
  try {
    const actor = await authenticate(req, req.method === 'POST' ? 'attendance.reply' : 'attendance.view', undefined, { adminPermission: 'attendance.inbox' });
    if (!['admin', 'growth'].includes(actor.role)) fail('attendance_forbidden', 403);
    const url = new URL(req.url || '/', 'https://space.local');

    if (req.method === 'POST') {
      const body = await readJsonBody(req).catch(() => fail('attendance_invalid_json', 400));
      const action = clean(body?.action || 'message', 24);
      const conversationId = clean(body?.conversation_id, 64);
      if (!conversationId) fail('attendance_invalid_request', 422);
      uuid(conversationId);

      if (action === 'read') {
        const sequence = Number.parseInt(String(body?.sequence || '0'), 10);
        if (!Number.isSafeInteger(sequence) || sequence < 0) fail('attendance_invalid_request', 422);
        const result = await request('/rpc/attendance_mark_read', {
          method: 'POST',
          body: { p_actor_uid: actor.uid, p_conversation_id: conversationId, p_sequence: sequence },
          timeoutMs: 15000,
        });
        return sendJson(res, 200, { ok: true, ...(result.data || {}) });
      }

      if (action === 'update') {
        const current = await request('/rpc/attendance_inbox_detail', {
          method: 'POST',
          body: { p_actor_uid: actor.uid, p_role: actor.role, p_conversation_id: conversationId, p_after: 0, p_limit: 1 },
          timeoutMs: 15000,
        });
        if (actor.role === 'admin') {
          await request('/rpc/attendance_ensure_admin_member', {
            method: 'POST',
            body: { p_actor_uid: actor.uid, p_role: actor.role, p_team_id: current.data?.conversation?.team?.team_id },
            timeoutMs: 15000,
          });
        }
        const type = clean(body?.update, 24);
        const version = Number.parseInt(String(current.data?.conversation?.version || body?.expected_version || '0'), 10);
        if (!Number.isSafeInteger(version) || version < 1) fail('attendance_invalid_request', 422);
        const command = { action: '', client_action_id: clean(body?.client_action_id || randomUUID(), 128), expected_version: version };
        if (type === 'assign') {
          command.action = 'assignment';
          command.assigned_user_uid = clean(body?.assigned_user_uid || actor.uid, 128);
        } else if (type === 'transfer') {
          command.action = 'assignment';
          command.team_id = clean(body?.team_id, 64);
          command.assigned_user_uid = body?.assigned_user_uid == null ? null : clean(body.assigned_user_uid, 128);
          if (command.team_id) uuid(command.team_id);
        } else if (type === 'unassign') {
          command.action = 'assignment';
          command.assigned_user_uid = null;
        } else if (type === 'resolve') {
          command.action = 'status';
          command.status = 'resolved';
        } else if (type === 'reopen') {
          command.action = 'status';
          command.status = 'open';
        } else {
          fail('attendance_invalid_request', 422);
        }
        const result = await request('/rpc/attendance_update_conversation', {
          method: 'POST',
          body: { p_actor_uid: actor.uid, p_conversation_id: conversationId, p_command: command },
          timeoutMs: 15000,
        });
        return sendJson(res, 200, { ok: true, ...(result.data || {}) });
      }

      if (action === 'link_person' || action === 'unlink_person' || action === 'create_opportunity') {
        const current = await request('/rpc/attendance_inbox_detail', {
          method: 'POST',
          body: { p_actor_uid: actor.uid, p_role: actor.role, p_conversation_id: conversationId, p_after: 0, p_limit: 20 },
          timeoutMs: 15000,
        });
        const detail = sanitizePayload(current.data || {});
        const version = Number.parseInt(String(detail?.conversation?.version || body?.expected_version || '0'), 10);
        if (!Number.isSafeInteger(version) || version < 1) fail('attendance_invalid_request', 422);
        const context = await resolveContext({ detail, actor });

        if (action === 'unlink_person') {
          await updateIdentity({ request, actor, conversationId, version, state: 'unidentified' });
          return sendJson(res, 200, { ok: true });
        }

        if (action === 'link_person') {
          const personId = clean(body?.person_id, 160);
          const person = [context.identity?.auto_link_candidate, ...(context.identity?.candidates || [])].filter(Boolean).find((row) => row.id === personId);
          if (!person || !['student', 'lead'].includes(person.type)) fail('attendance_invalid_identity', 422);
          await updateIdentity({ request, actor, conversationId, version, person });
          return sendJson(res, 200, { ok: true });
        }

        const person = context.person || context.identity?.auto_link_candidate || {};
        const result = await crmService.createOpportunity({
          actorUid: actor.uid,
          user: await actorCrmUser(actor),
          idempotencyKey: `attendance:${conversationId}:${person.id || detail?.contact?.contact_id || 'contact'}`,
          input: {
            name: clean(person.name || detail?.contact?.name || detail?.contact?.phone || 'Contato WhatsApp', 180),
            phone: clean(person.phone || detail?.contact?.phone, 80),
            email: clean(person.email, 160),
            title: clean(`Atendimento - ${person.name || detail?.contact?.name || detail?.contact?.phone || 'WhatsApp'}`, 180),
            source: 'attendance_inbox',
          },
        });
        return sendJson(res, 201, { ok: true, opportunity_id: result.opportunityId });
      }

      if (action !== 'message') fail('attendance_invalid_request', 422);
      const text = clean(body?.text, 4000);
      const clientRequestId = clean(body?.client_request_id || randomUUID(), 128);
      if (!text) fail('attendance_invalid_request', 422);

      const detailResult = await request('/rpc/attendance_inbox_detail', {
        method: 'POST',
        body: { p_actor_uid: actor.uid, p_role: actor.role, p_conversation_id: conversationId, p_after: 0, p_limit: 1 },
        timeoutMs: 15000,
      });
      const detail = detailResult.data || {};
      const connection = detail?.conversation?.connection || {};
      const contact = detail?.contact || {};
      if (connection.provider !== 'evolution_whatsapp' || connection.status !== 'active' || connection.setup_pending) {
        fail('attendance_channel_disabled', 409);
      }
      const instance = clean(connection.instance_name || '', 100) || clean(
        (await request('/rpc/attendance_evolution_instance_for_connection', {
          method: 'POST',
          body: { p_connection_id: connection.connection_id },
          timeoutMs: 8000
        })).data,
        100
      );
      const number = String(contact.phone || '').replace(/\D/g, '');
      if (!instance || !/^\d{7,16}$/.test(number)) fail('attendance_invalid_recipient', 422);

      if (actor.role === 'admin') {
        await request('/rpc/attendance_ensure_admin_member', {
          method: 'POST',
          body: {
            p_actor_uid: actor.uid,
            p_role: actor.role,
            p_team_id: detail?.conversation?.team?.team_id
          },
          timeoutMs: 15000,
        });
      }

      const appended = await request('/rpc/attendance_append_message', {
        method: 'POST',
        body: {
          p_actor_uid: actor.uid,
          p_conversation_id: conversationId,
          p_message: { direction: 'outbound', kind: 'text', content: { text }, client_request_id: clientRequestId, metadata: { provider: 'evolution_whatsapp' } },
        },
        timeoutMs: 15000,
      });
      const messageId = appended.data?.message_id;
      try {
        const provider = await sendEvolution(instance, number, text);
        const externalId = clean(provider?.key?.id || provider?.id || provider?.messageId || '', 200) || null;
        await request('/rpc/attendance_set_message_transport', {
          method: 'POST',
          body: { p_message_id: messageId, p_status: 'sent', p_external_message_id: externalId, p_metadata: { provider: 'evolution_whatsapp' } },
          timeoutMs: 15000,
        });
        return sendJson(res, 200, { ok: true, message_id: messageId, external_message_id: externalId, status: 'sent' });
      } catch (error) {
        await request('/rpc/attendance_set_message_transport', {
          method: 'POST',
          body: { p_message_id: messageId, p_status: 'failed', p_external_message_id: null, p_metadata: { provider: 'evolution_whatsapp', send_failed: true } },
          timeoutMs: 15000,
        }).catch(() => {});
        throw error;
      }
    }

    const conversationId = clean(url.searchParams.get('conversation_id'), 64);
    if (conversationId) {
      uuid(conversationId);
      const after = Math.max(0, Number.parseInt(String(url.searchParams.get('after') || '0'), 10) || 0);
      const body = { p_actor_uid: actor.uid, p_role: actor.role, p_conversation_id: conversationId, p_after: after, p_limit: limit(url.searchParams.get('limit'), 50) };
      const result = await request('/rpc/attendance_inbox_detail', { method: 'POST', body, timeoutMs: 15000 });
      const payload = sanitizePayload(result.data || {});
      payload.context = await resolveContext({ detail: payload, actor }).catch((error) => {
        console.warn('[attendance-inbox] context unavailable', { code: String(error.code || error.message || 'unknown').slice(0, 80) });
        return { identity: { state: 'context_unavailable', linked: false, candidates: [] }, sources: {} };
      });
      const candidate = payload.context?.identity?.auto_link_candidate;
      if (candidate && ['student', 'lead'].includes(candidate.type) && payload?.conversation?.version) {
        await updateIdentity({ request, actor, conversationId, version: payload.conversation.version, person: candidate, origin: 'auto_phone_unique' })
          .then(async () => {
            const refreshed = await request('/rpc/attendance_inbox_detail', { method: 'POST', body, timeoutMs: 15000 });
            Object.assign(payload, sanitizePayload(refreshed.data || {}));
            payload.context = await resolveContext({ detail: payload, actor });
          })
          .catch(() => {});
      }
      payload.contact = sanitizePayload(await resolveProfile(payload));
      const conn = payload?.conversation?.connection || {};
      const enabled = conn.provider === 'evolution_whatsapp' && conn.status === 'active' && conn.setup_pending !== true;
      payload.composer = enabled
        ? { enabled: true, reason: 'Responda à conversa pelo WhatsApp.' }
        : { enabled: false, reason: 'Envio indisponível. Solicite ajuda à equipe responsável pelo atendimento.' };
      return sendJson(res, 200, payload);
    }
    const filter = clean(url.searchParams.get('filter'), 24) || 'all';
    if (!['all', 'unread', 'mine', 'unassigned'].includes(filter)) fail('attendance_invalid_request', 422);
    const teamId = clean(url.searchParams.get('team_id'), 64);
    if (teamId) uuid(teamId);
    const filters = { filter, limit: limit(url.searchParams.get('limit'), 50) };
    const q = clean(url.searchParams.get('q'), 80);
    if (q) filters.q = q;
    if (teamId) filters.team_id = teamId;
    const result = await request('/rpc/attendance_inbox_list', { method: 'POST', body: { p_actor_uid: actor.uid, p_role: actor.role, p_filters: filters }, timeoutMs: 15000 });
    const data = result.data || {};
    return sendJson(res, 200, sanitizePayload({ rows: Array.isArray(data.rows) ? data.rows : [], teams: Array.isArray(data.teams) ? data.teams : [], limit: data.limit || filters.limit }));
  } catch (error) {
    const { status, error: publicCode } = publicError(error);
    if (status === 503) {
      console.warn('[attendance-inbox] request failed', { status });
    }
    return sendJson(res, status, { error: publicCode });
  }
};

module.exports = createHandler();
module.exports.createHandler = createHandler;
