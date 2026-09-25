const {fail}=require('./attendance-domain');
const {supabaseFetch}=require('./supabase-rest');
const clean=(v,max=120)=>String(v||'').trim().slice(0,max);
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
      throw Object.assign(Error('evolution_unavailable'),{code:'evolution_unavailable',status:503,definiteFailure:response.status>=400&&response.status<500});
    }
    return payload;
  } catch (error) {
    if (String(error.code || '').startsWith('evolution_')) throw error;
    console.warn('[attendance-inbox] evolution send failed', { timeout: error.name === 'AbortError' });
    fail('evolution_unavailable', 503);
  } finally { clearTimeout(timer); }
};

async function sendInboxText({actor,conversationId,text,clientRequestId,canonicalPhone,request=supabaseFetch,sendEvolution=evolutionRequest}) {
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

      if (canonicalPhone && number !== require('../../src/international-phone/core').normalizePhoneToE164(canonicalPhone, {defaultCountry:'BR',preferCountry:true}).replace(/^\+/, '')) fail('canonical_phone_mismatch',422);
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
          p_message: { direction: 'outbound', kind: 'text', content: { text }, client_request_id: clientRequestId, metadata: { provider: 'evolution_whatsapp', origin:'space_inbox' } },
        },
        timeoutMs: 15000,
      });
      const messageId = appended.data?.message_id;
      if(appended.data?.duplicate) return {...appended.data,ok:appended.data.status==='sent',conversation_id:conversationId};
      let externalId=null;
      try {
        const provider = await sendEvolution(instance, number, text);
        externalId = clean(provider?.key?.id || provider?.id || provider?.messageId || '', 200) || null;
        if(!externalId) fail('send_unconfirmed',409);
        await request('/rpc/attendance_set_message_transport', {
          method: 'POST',
          body: { p_message_id: messageId, p_status: 'sent', p_external_message_id: externalId, p_metadata: { provider: 'evolution_whatsapp', origin:'space_inbox' } },
          timeoutMs: 15000,
        });
        return { ok:true,message_id:messageId,external_message_id:externalId,status:'sent',conversation_id:conversationId };
      } catch (error) {
        await request('/rpc/attendance_set_message_transport', {
          method: 'POST',
          body: { p_message_id: messageId, p_status: error.definiteFailure ? 'failed' : 'unknown', p_external_message_id: externalId, p_metadata: { provider: 'evolution_whatsapp', send_failed: true } },
          timeoutMs: 15000,
        }).catch(() => {});
        error.message_id=messageId; error.conversation_id=conversationId; error.uncertain=!error.definiteFailure; throw error;
      }
}
module.exports={sendInboxText,evolutionRequest};
