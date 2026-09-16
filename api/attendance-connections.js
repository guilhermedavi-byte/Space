const { randomUUID } = require('node:crypto');
const { readJsonBody, sendJson } = require('../_lib/http');
const { requireAttendanceAuth } = require('./_lib/attendance-auth');
const { assertAttendanceEnvironment, fail, only, uuid, text } = require('./_lib/attendance-domain');
const { supabaseFetch } = require('./_lib/supabase-rest');

const createHandler = ({ authenticate = requireAttendanceAuth, request = supabaseFetch, checkEnvironment = assertAttendanceEnvironment } = {}) => async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'POST'].includes(req.method)) return sendJson(res, 405, { error: 'method_not_allowed' });
  try {
    const actor = await authenticate(req, req.method === 'GET' ? 'attendance.view' : 'attendance.manage');
    if (!['admin', 'growth'].includes(actor.role)) fail('attendance_forbidden', 403);
    checkEnvironment();
    const read = async path => (await request(path)).data || [];
    const [connections, channels, teams, grants, members, membership] = await Promise.all([
      read('/connections?select=connection_id,provider,external_account_id,external_account_type,display_name,status,created_at,updated_at,metadata&order=created_at.desc'),
      read('/channels?select=channel_id,connection_id,external_channel_id,display_name,status,default_team_id'),
      read('/teams?select=team_id,name,active'), read('/channel_teams?select=channel_id,team_id'),
      read(`/attendance_members?select=enabled&user_uid=eq.${encodeURIComponent(actor.uid)}`),
      read(`/team_members?select=team_id,member_role,active&user_uid=eq.${encodeURIComponent(actor.uid)}`),
    ]);
    const admin = actor.role === 'admin';
    const scope = membership.filter(m => members[0]?.enabled && m.active && teams.some(t => t.team_id === m.team_id && t.active));
    const hasTeam = (id, manage = false) => admin || scope.some(m => m.team_id === id && (!manage || m.member_role === 'supervisor'));
    const canChannel = (ch, manage = false) => admin || grants.some(g => g.channel_id === ch.channel_id && hasTeam(g.team_id, manage));
    const allChannels = c => channels.filter(ch => ch.connection_id === c.connection_id);
    const visible = c => admin || allChannels(c).some(ch => canChannel(ch)) || (!allChannels(c).length && c.metadata?.setup_pending === true && hasTeam(c.metadata.default_team_id));
    // A connection-level change affects every channel, so Growth must supervise all of them.
    const manageable = c => !c.metadata?.validation_run_id && c.provider !== 'attendance_validation' && (admin || (allChannels(c).length ? allChannels(c).every(ch => canChannel(ch, true)) : c.metadata?.setup_pending === true && hasTeam(c.metadata.default_team_id, true)));
    const editableTeams = teams.filter(t => t.active && hasTeam(t.team_id, true));
    if (req.method === 'GET') {
      return sendJson(res, 200, {
        permissions: { create: editableTeams.length > 0, technical: admin },
        teams: teams.filter(t => admin || hasTeam(t.team_id)).map(t => ({ team_id: t.team_id, name: t.name })),
        create_teams: editableTeams.map(t => ({ team_id: t.team_id, name: t.name })),
        items: connections.filter(visible).map(c => {
          const list = allChannels(c).filter(ch => canChannel(ch));
          const pending = c.metadata?.setup_pending === true || c.status === 'pending' || c.metadata?.disabled_previous_status === 'pending';
          return { connection_id: c.connection_id, name: c.display_name, provider: c.provider, status: c.status,
            setup_pending: pending, waba_id: c.external_account_type === 'waba' && !c.external_account_id.startsWith('pending:') ? c.external_account_id : null,
            created_at: c.created_at, updated_at: c.updated_at, draft_team_id: c.metadata?.setup_pending === true ? c.metadata.default_team_id : null,
            can_edit: manageable(c), can_activate: manageable(c) && !pending && list.some(ch => ch.status === 'active'),
            channels: list.map(ch => ({ ...ch, allowed_teams: grants.filter(g => g.channel_id === ch.channel_id && hasTeam(g.team_id, true)).map(g => g.team_id) })) };
        }),
      });
    }
    const body = await readJsonBody(req).catch(() => fail('attendance_invalid_json', 400));
    only(body, ['action', 'connection_id', 'name', 'team_id', 'channel_id', 'status']);
    if (body.action === 'create') {
      uuid(body.team_id); text(body.name, 100);
      if (!editableTeams.some(t => t.team_id === body.team_id)) fail('attendance_forbidden', 403);
      await request('/connections', { method: 'POST', body: { provider: 'meta_whatsapp', external_account_type: 'waba', external_account_id: `pending:${randomUUID()}`,
        display_name: body.name.trim(), status: 'pending', metadata: { setup_pending: true, default_team_id: body.team_id } } });
    } else {
      uuid(body.connection_id);
      const c = connections.find(c => c.connection_id === body.connection_id && visible(c));
      if (!c || !manageable(c)) fail('attendance_forbidden', 403);
      const patch = {};
      if (body.action === 'rename') { text(body.name, 100); patch.display_name = body.name.trim(); }
      else if (body.action === 'status') {
        if (!['active', 'disabled'].includes(body.status)) fail();
        if (body.status === 'active' && (c.metadata?.setup_pending === true || c.status === 'pending' || c.metadata?.disabled_previous_status === 'pending' || !allChannels(c).some(ch => ch.status === 'active'))) fail('attendance_meta_configuration_pending', 409);
        patch.status = body.status;
        if (body.status === 'disabled' && c.status !== 'disabled') patch.metadata = { ...c.metadata, disabled_previous_status: c.status };
      } else if (body.action === 'team') {
        uuid(body.team_id);
        if (!editableTeams.some(t => t.team_id === body.team_id)) fail('attendance_forbidden', 403);
        if (body.channel_id) {
          uuid(body.channel_id);
          if (!allChannels(c).some(ch => ch.channel_id === body.channel_id) || !grants.some(g => g.channel_id === body.channel_id && g.team_id === body.team_id)) fail('attendance_forbidden', 403);
          await request(`/channels?channel_id=eq.${body.channel_id}`, { method: 'PATCH', body: { default_team_id: body.team_id, updated_at: new Date().toISOString() } });
          return sendJson(res, 200, { ok: true });
        }
        if (allChannels(c).length || c.metadata?.setup_pending !== true) fail();
        patch.metadata = { ...c.metadata, default_team_id: body.team_id };
      } else fail('attendance_invalid_action');
      await request(`/connections?connection_id=eq.${c.connection_id}`, { method: 'PATCH', body: { ...patch, updated_at: new Date().toISOString() } });
    }
    return sendJson(res, 200, { ok: true });
  } catch (error) {
    const status = [400, 401, 403, 409, 422].includes(error.status) ? error.status : 503;
    return sendJson(res, status, { error: status === 503 ? 'attendance_unavailable' : 'attendance_request_rejected' });
  }
};
module.exports = createHandler();
module.exports.createHandler = createHandler;
