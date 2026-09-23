const { readJsonBody, sendJson } = require('../_lib/http');
const { requireAttendanceAuth } = require('./_lib/attendance-auth');
const { assertAttendanceEnvironment, fail, only, uuid, text } = require('./_lib/attendance-domain');
const { supabaseFetch } = require('./_lib/supabase-rest');
const { isEvolution, publicFields, handleEvolution } = require('./_lib/attendance-evolution');

const readConnectionsViaEdge = async (uid) => {
  const url = String(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '').trim();
  if (!url || !key) {
    const error = new Error('supabase_not_configured');
    error.code = 'supabase_not_configured';
    throw error;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`${url}/functions/v1/attendance-connections-read`, {
      method: 'POST',
      redirect: 'error',
      signal: controller.signal,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uid: String(uid || '') }),
    });
    if (!res.ok) throw Object.assign(new Error('attendance_edge_read_failed'), { status: res.status });
    const data = await res.json();
    return {
      connections: Array.isArray(data.connections) ? data.connections : [],
      channels: Array.isArray(data.channels) ? data.channels : [],
      teams: Array.isArray(data.teams) ? data.teams : [],
      grants: Array.isArray(data.grants) ? data.grants : [],
      members: Array.isArray(data.members) ? data.members : [],
      membership: Array.isArray(data.membership) ? data.membership : [],
    };
  } catch (error) {
    if (error?.name === 'AbortError') throw Object.assign(new Error('attendance_edge_read_failed'), { code: 'attendance_edge_read_failed' });
    throw error;
  } finally {
    clearTimeout(timer);
  }
};

const createHandler = ({ authenticate = requireAttendanceAuth, request = supabaseFetch, checkEnvironment = assertAttendanceEnvironment, evolutionClient } = {}) => async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(req.method)) return sendJson(res, 405, { error: 'method_not_allowed' });
  try {
    const route = new URL(req.url || '/', 'https://space.invalid');
    const id = req.query?.connection || route.searchParams.get('connection');
    const suffix = req.query?.operation || route.searchParams.get('operation');
    const operations = { GET: suffix === 'qr' ? 'qr' : !suffix ? 'detail' : null, POST: ['refresh-qr','reconnect','disconnect','pairing-code'].includes(suffix) ? suffix : null, PATCH: !suffix ? 'edit' : null, DELETE: !suffix ? 'disable' : null };
    if ((id && !operations[req.method]) || (!id && !['GET','POST'].includes(req.method))) return sendJson(res,405,{error:'method_not_allowed'});
    const adminPermission = req.method === 'GET' && suffix !== 'qr'
      ? 'attendance.connections.view'
      : req.method === 'POST' && !id
        ? 'attendance.connections.create'
        : req.method === 'DELETE'
          ? 'attendance.connections.delete'
          : 'attendance.connections.update';
    const actor = await authenticate(req, req.method === 'GET' && suffix !== 'qr' ? 'attendance.view' : 'attendance.manage', undefined, { adminPermission });
    if (!['admin', 'growth'].includes(actor.role)) fail('attendance_forbidden', 403);
    if (req.method !== 'GET') checkEnvironment();
    const readOptions = req.method === 'GET' && request === supabaseFetch ? { timeoutMs: 15000 } : undefined;
    const read = async (path, table) => {
      try {
        return (await (readOptions ? request(path, readOptions) : request(path))).data || [];
      } catch (error) {
        error.attendanceTable = table;
        error.attendanceEndpoint = path.split('?')[0];
        if (req.method === 'GET') {
          console.warn('[attendance-connections] supabase read failed', {
            table,
            endpoint: error.attendanceEndpoint,
            status: Number(error.status) || 0,
            code: String(error.code || error.message || 'unknown').slice(0, 80),
          });
        }
        throw error;
      }
    };
    const admin = actor.role === 'admin';
    let connections;
    let channels;
    let teams;
    let grants;
    let members = [];
    let membership = [];
    try {
      connections = await read('/connections?select=connection_id,provider,external_account_id,external_account_type,display_name,status,created_at,updated_at,metadata&order=created_at.desc', 'connections');
      channels = await read('/channels?select=channel_id,connection_id,external_channel_id,display_name,status,default_team_id', 'channels');
      teams = await read('/teams?select=team_id,name,active', 'teams');
      grants = await read('/channel_teams?select=channel_id,team_id', 'channel_teams');
      if (!admin) {
        members = await read(`/attendance_members?select=enabled&user_uid=eq.${encodeURIComponent(actor.uid)}`, 'attendance_members');
        membership = await read(`/team_members?select=team_id,member_role,active&user_uid=eq.${encodeURIComponent(actor.uid)}`, 'team_members');
      }
    } catch (error) {
      if (request !== supabaseFetch) throw error;
      if (req.method !== 'GET') {
        console.warn('[attendance-connections] supabase prewrite read failed', {
          table: error.attendanceTable || 'unknown',
          endpoint: error.attendanceEndpoint || 'unknown',
          status: Number(error.status) || 0,
          code: String(error.code || error.message || 'unknown').slice(0, 80),
        });
      }
      console.warn('[attendance-connections] falling back to direct database edge read', {
        table: error.attendanceTable || 'unknown',
        status: Number(error.status) || 0,
        code: String(error.code || error.message || 'unknown').slice(0, 80),
      });
      const bundle = await readConnectionsViaEdge(actor.uid);
      connections = bundle.connections;
      channels = bundle.channels;
      teams = bundle.teams;
      grants = bundle.grants;
      if (!admin) {
        members = bundle.members;
        membership = bundle.membership;
      }
    }
    connections = connections.filter(c => c.provider === 'meta_whatsapp' || isEvolution(c));
    const scope = membership.filter(m => members[0]?.enabled && m.active && teams.some(t => t.team_id === m.team_id && t.active));
    const hasTeam = (id, manage = false) => admin || scope.some(m => m.team_id === id && (!manage || m.member_role === 'supervisor'));
    const canChannel = (ch, manage = false) => admin || grants.some(g => g.channel_id === ch.channel_id && hasTeam(g.team_id, manage));
    const allChannels = c => channels.filter(ch => ch.connection_id === c.connection_id);
    const visible = c => admin || allChannels(c).some(ch => canChannel(ch)) || (!allChannels(c).length && c.metadata?.setup_pending === true && hasTeam(c.metadata.default_team_id));
    // A connection-level change affects every channel, so Growth must supervise all of them.
    const manageable = c => !c.metadata?.validation_run_id && c.provider !== 'attendance_validation' && (admin || (allChannels(c).length ? allChannels(c).every(ch => canChannel(ch, true)) : c.metadata?.setup_pending === true && hasTeam(c.metadata.default_team_id, true)));
    const editableTeams = teams.filter(t => t.active && hasTeam(t.team_id, true));
    const serialize = c => {
      const list = allChannels(c).filter(ch => canChannel(ch));
      const pending = c.metadata?.setup_pending === true || c.status === 'pending' || c.metadata?.disabled_previous_status === 'pending';
      return { connection_id:c.connection_id, name:c.display_name, provider:c.provider, status:c.status,
        setup_pending:pending, waba_id:c.external_account_type==='waba' && !c.external_account_id.startsWith('pending:') ? c.external_account_id : null,
        created_at:c.created_at, updated_at:c.updated_at, draft_team_id:c.metadata?.default_team_id || null,
        can_edit:manageable(c), can_activate:manageable(c) && !pending && list.some(ch=>ch.status==='active'),
        ...publicFields(c),
        channels:list.map(ch=>({...ch,allowed_teams:grants.filter(g=>g.channel_id===ch.channel_id && hasTeam(g.team_id,true)).map(g=>g.team_id)})) };
    };
    const body = req.method === 'GET' || req.method === 'DELETE' ? {} : await readJsonBody(req).catch(() => fail('attendance_invalid_json',400));
    if (id || body.provider === 'evolution_whatsapp') {
      const result = await handleEvolution({req, body, id, operation:operations[req.method], actor, connections, editableTeams, visible, manageable, request, checkEnvironment, serialize, ...(evolutionClient ? {client:evolutionClient} : {})});
      return sendJson(res,200,result);
    }
    if (req.method === 'GET') return sendJson(res,200,{
      permissions:{create:editableTeams.length>0,technical:admin,evolution_ready:process.env.EVOLUTION_ONBOARDING_ENABLED==='true' && !!process.env.EVOLUTION_API_KEY && !!process.env.EVOLUTION_API_URL,adopt:process.env.EVOLUTION_ONBOARDING_ENABLED==='true' && admin && editableTeams.length>0 && !!process.env.EVOLUTION_INSTANCE_NAME && !connections.some(c=>isEvolution(c)&&c.external_account_id===process.env.EVOLUTION_INSTANCE_NAME.trim())},
      teams:teams.filter(t=>admin||hasTeam(t.team_id)).map(t=>({team_id:t.team_id,name:t.name})),
      create_teams:editableTeams.map(t=>({team_id:t.team_id,name:t.name})),
      items:connections.filter(visible).map(serialize),
    });
    only(body, ['action', 'connection_id', 'name', 'team_id', 'channel_id', 'status']);
    if (body.action === 'create') {
      uuid(body.team_id); text(body.name, 100);
      if (!editableTeams.some(t => t.team_id === body.team_id)) fail('attendance_forbidden', 403);
      await request('/rpc/attendance_create_pending_connection', { method: 'POST', body: { p_name: body.name.trim(), p_team_id: body.team_id } });
    } else {
      uuid(body.connection_id);
      const c = connections.find(c => c.connection_id === body.connection_id && visible(c));
      if (!c || !manageable(c)) fail('attendance_forbidden', 403);
      if (isEvolution(c)) fail('attendance_use_evolution_route',409);
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
    const status = error.code === '42501' ? 403 : error.code === '55P03' ? 409 : [400,401,403,409,422].includes(error.status) ? error.status : 503;
    const safeErrors = new Set(['evolution_not_configured','evolution_configuration_error','evolution_unavailable','evolution_instance_missing','evolution_protected_instance','evolution_disabled','evolution_pairing_not_supported']);
    if (safeErrors.has(error.code)) return sendJson(res,status,{error:error.code});
    return sendJson(res, status, { error: status === 503 ? 'attendance_unavailable' : 'attendance_request_rejected' });
  }
};
module.exports = createHandler();
module.exports.createHandler = createHandler;
