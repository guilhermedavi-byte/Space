const { createHash, randomUUID } = require('node:crypto');
const { fail, only, uuid, text } = require('./attendance-domain');
const PROVIDER = 'evolution_whatsapp';
const isEvolution = c => c?.provider === PROVIDER;
const states = new Set(['pending', 'connecting', 'open', 'disconnected', 'failed']);
const stateOf = c => states.has(c.metadata?.connection_state) ? c.metadata.connection_state : c.status === 'active' ? 'open' : 'pending';
const publicFields = c => isEvolution(c) ? {
  instance_name: c.external_account_id, connection_state: stateOf(c),
  phone: c.metadata?.phone || null, qr_available: c.metadata?.qr_available === true,
  last_seen: c.metadata?.last_seen || null, operational_note: c.metadata?.operational_note || '',
} : {};

function createEvolutionClient({ env = process.env, transport = fetch } = {}) {
  return async (operation, name, body) => {
    const key = String(env.EVOLUTION_API_KEY || '').trim();
    let base;
    try { base = new URL(String(env.EVOLUTION_API_URL || '').trim()); } catch { fail('evolution_not_configured', 503); }
    if (!key || base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) fail('evolution_not_configured', 503);
    if (name && !/^[a-zA-Z0-9_-]{1,100}$/.test(name)) fail('evolution_invalid_instance');
    const paths = {
      find: `/instance/fetchInstances?instanceName=${encodeURIComponent(name || '')}`,
      create: '/instance/create', connect: `/instance/connect/${name}`, logout: `/instance/logout/${name}`,
    };
    if (!paths[operation]) fail();
    const method = operation === 'create' ? 'POST' : operation === 'logout' ? 'DELETE' : 'GET';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await transport(base.href.replace(/\/$/, '') + paths[operation], {
        method, redirect: 'error', signal: controller.signal,
        headers: { apikey: key, 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (!response.ok) {
        console.warn('[attendance-evolution]', { operation, status: response.status });
        fail(response.status === 401 || response.status === 403 ? 'evolution_configuration_error' : 'evolution_unavailable', 503);
      }
      return await response.json();
    } catch (error) {
      if (String(error.code || '').startsWith('evolution_')) throw error;
      console.warn('[attendance-evolution]', { operation, timeout: error.name === 'AbortError' });
      fail('evolution_unavailable', 503);
    } finally { clearTimeout(timer); }
  };
}
const evolution = createEvolutionClient();
function instanceFrom(payload, name) {
  if (!Array.isArray(payload)) fail('evolution_invalid_response', 503);
  const row = payload.find(item => (item.name || item.instance?.instanceName) === name);
  if (!row) return null;
  const raw = row.connectionStatus || row.instance?.status;
  const state = ({ open: 'open', connecting: 'connecting', close: 'disconnected', closed: 'disconnected' })[raw];
  if (!state) fail('evolution_invalid_response', 503);
  const number = String(row.ownerJid || row.instance?.owner || '').split('@')[0].split(':')[0];
  return { connection_state: state, phone: /^\d{7,16}$/.test(number) ? `+${number}` : null };
}
function qrFrom(payload) {
  const value = payload?.base64 || payload?.qrcode?.base64;
  // Only an inline PNG is allowed, never a provider URL, HTML, SVG or API envelope.
  return typeof value === 'string' && value.length < 300000 && /^data:image\/png;base64,iVBOR[\w+/=\r\n]+$/.test(value) ? value : null;
}
function connectionId(uid, key) {
  const h = createHash('sha256').update(`attendance-evolution:${uid}:${key}`).digest('hex');
  return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;
}
function assertOrigin(req) {
  const origin = req.headers?.origin;
  const expected = String(process.env.SPACE_PUBLIC_BASE_URL || 'https://plataforma.spaceschoolbr.com').replace(/\/$/, '');
  if ((origin && origin !== expected) || ['cross-site','same-site'].includes(req.headers?.['sec-fetch-site'])) fail('attendance_forbidden', 403);
}

async function handleEvolution({ req, body, id, operation, actor, connections, editableTeams, visible, manageable, request, checkEnvironment, serialize, client = evolution }) {
  const rpc = async (action, cid, input = {}) => {
    const result = await request('/rpc/attendance_evolution_connection', { method:'POST', body:{
      p_actor_uid: actor.uid, p_admin: actor.role === 'admin', p_action: action, p_id: cid, p_input: input,
    } });
    return Array.isArray(result.data) ? result.data[0] : result.data;
  };
  assertOrigin(req);
  checkEnvironment();
  if (client === evolution && (process.env.EVOLUTION_ONBOARDING_ENABLED !== 'true' || !String(process.env.EVOLUTION_API_KEY || '').trim())) fail('evolution_not_configured',503);
  let c;
  if (!id) {
    only(body, ['action','provider','name','team_id','idempotency_key']);
    if (!['create','adopt'].includes(body.action) || body.provider !== PROVIDER) fail();
    uuid(body.team_id); if(body.action==='create') uuid(body.idempotency_key); text(body.name,100);
    if (!editableTeams.some(t => t.team_id === body.team_id)) fail('attendance_forbidden',403);
    if(body.action==='adopt') {
      if(actor.role!=='admin') fail('attendance_forbidden',403);
      const name=String(process.env.EVOLUTION_INSTANCE_NAME||'').trim();
      if(!name) fail('evolution_not_configured',503);
      const snapshot=instanceFrom(await client('find',name),name);
      if(!snapshot || snapshot.connection_state!=='open') fail('evolution_instance_missing',409);
      c=await rpc('adopt',connectionId('existing-instance',name),{name:body.name.trim(),team_id:body.team_id,instance_name:name});
      c=await rpc('sync',c.connection_id,snapshot);
      return {item:serialize(c)};
    }
    id = connectionId(actor.uid, body.idempotency_key);
    c = await rpc('reserve', id, { name:body.name.trim(), team_id:body.team_id });
    operation = 'create';
  } else {
    uuid(id);
    c = connections.find(item => item.connection_id === id && isEvolution(item) && visible(item));
    if (!c) fail('attendance_forbidden',403);
    if (operation !== 'detail' && !manageable(c)) fail('attendance_forbidden',403);
  }
  if (operation === 'edit') {
    only(body,['name','team_id','operational_note']);
    if (body.name !== undefined) text(body.name,100);
    if (body.team_id !== undefined) uuid(body.team_id);
    if (body.operational_note !== undefined && (typeof body.operational_note !== 'string' || body.operational_note.length > 500)) fail();
    c = await rpc('edit',id,body);
    return { item:serialize(c) };
  }
  if (operation === 'disable') { c = await rpc('disable',id); return { item:serialize(c) }; }
  if (operation === 'pairing-code') fail('evolution_pairing_not_supported',409);
  const supported = ['detail','qr','create','refresh-qr','reconnect','disconnect'];
  if (!supported.includes(operation)) fail();
  if (operation !== 'create') only(body || {},[]);
  const name = c.external_account_id;
  // A reserved operational instance can be observed but never logged out/restarted by onboarding.
  if (name === String(process.env.EVOLUTION_INSTANCE_NAME || 'space-suporte').trim() && operation === 'disconnect') fail('evolution_protected_instance',409);
  if (c.status === 'disabled' && operation !== 'detail' && operation !== 'reconnect') fail('evolution_disabled',409);
  if (operation === 'detail') {
    const snapshot = instanceFrom(await client('find', name), name);
    if (!snapshot) fail('evolution_instance_missing',409);
    c = await rpc('sync',id,snapshot);
    return { item:serialize(c) };
  }
  const lease = randomUUID();
  c = await rpc('acquire',id,{lease});
  try {
    let snapshot = instanceFrom(await client('find', name), name);
    if (!snapshot) {
      // Only platform-reserved instances can be created; retries use exactly the same name.
      if (!c.metadata?.space_created || name !== `space-${id}`) fail('evolution_instance_missing',409);
      await client('create',name,{ instanceName:name, integration:'WHATSAPP-BAILEYS', qrcode:false });
      snapshot = { connection_state:'pending', phone:null };
    }
    if (operation === 'disconnect') {
      if (snapshot.connection_state === 'open' || snapshot.connection_state === 'connecting') await client('logout',name);
      c = await rpc('finish',id,{lease, connection_state:'disconnected',phone:snapshot.phone,qr_available:false});
      return { item:serialize(c) };
    }
    if (snapshot.connection_state === 'open') {
      c = await rpc('finish',id,{lease,...snapshot,qr_available:false,enable:operation==='reconnect'});
      return { item:serialize(c), qr:null };
    }
    const qr = qrFrom(await client('connect',name));
    c = await rpc('finish',id,{lease,...snapshot,connection_state:'connecting',qr_available:!!qr,enable:operation==='reconnect'});
    return { item:serialize(c), qr, refresh_after_seconds:40, pairing_supported:false };
  } catch (error) {
    // Preserve the original failure; never claim a failed write succeeded or reset an active instance.
    await rpc('release',id,{lease,failed:c.status==='pending' && c.metadata?.space_created && !c.metadata?.phone}).catch(() => {});
    throw error;
  }
}
module.exports = { PROVIDER, isEvolution, publicFields, createEvolutionClient, instanceFrom, qrFrom, connectionId, handleEvolution };
