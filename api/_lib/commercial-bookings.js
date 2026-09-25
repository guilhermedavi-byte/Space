const { supabaseFetch } = require('./supabase-rest');
const { createHmac, timingSafeEqual } = require('node:crypto');
const CAL_LINK = 'team/closers-space-idiomas/reuniao-com-mentor-do-space';
const clean = x => String(x ?? '').trim();
const rows = result => Array.isArray(result?.data) ? result.data : [];
const fail = (code, status = 400) => Object.assign(new Error(code), { status });
const uuid = x => /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(clean(x));
const bookingUid = x => /^[A-Za-z0-9_-]{6,100}$/.test(clean(x));
const iso = x => Number.isFinite(Date.parse(x)) ? new Date(x).toISOString() : null;
const fields = 'id,calcom_booking_id,status,start_at,end_at,timezone,attendee_name,attendee_email,attendee_phone,host_name,sdr_uid,voice_call_id,lead_id,opportunity_id,updated_at,rescheduled_from,rescheduled_to';
const model = b => ({ id:b.id, bookingExternalId:b.calcom_booking_id, bookingConfirmed:b.status === 'confirmed', status:b.status, bookingStartAt:b.start_at, bookingEndAt:b.end_at, timezone:b.timezone, attendeeName:b.attendee_name, attendeeEmail:b.attendee_email, attendeePhone:b.attendee_phone, hostName:b.host_name, sdrUid:b.sdr_uid, voiceCallId:b.voice_call_id, leadId:b.lead_id, opportunityId:b.opportunity_id });
async function callInScope(request, id, user, isAdmin) {
  if (!uuid(id)) throw fail('invalid_call');
  const c = rows(await request(`/voice_calls?id=eq.${encodeURIComponent(id)}&select=id,space_user_uid,lead_id,opportunity_id,lead_name,to_number&limit=1`))[0];
  if (!c || (!isAdmin && c.space_user_uid !== user.sub)) throw fail('call_not_found',404);
  return c;
}
async function list({request=supabaseFetch,user,isAdmin,callId}) {
  if (callId) await callInScope(request,callId,user,isAdmin);
  const scope = isAdmin ? '' : `&sdr_uid=eq.${encodeURIComponent(user.sub)}`;
  const filter = callId ? `&voice_call_id=eq.${encodeURIComponent(callId)}` : '';
  return rows(await request(`/commercial_bookings?select=${fields}${scope}${filter}&order=start_at.desc&limit=100`)).map(model);
}
async function context({request=supabaseFetch,user,isAdmin,callId}) {
  const c = callId ? await callInScope(request,callId,user,isAdmin) : null;
  const body = {sdr_uid:c?.space_user_uid || user.sub,voice_call_id:c?.id || null,lead_id:c?.lead_id || null,opportunity_id:c?.opportunity_id || null};
  const row=rows(await request('/commercial_booking_contexts',{method:'POST',body}))[0];
  if (!row?.id) throw fail('booking_context_failed',503);
  return {contextId:row.id,calLink:CAL_LINK,prefill:{name:c?.lead_name || '',attendeePhoneNumber:c?.to_number || ''},voiceCallId:c?.id || null};
}
async function calGet(path,{fetcher=fetch,env=process.env,version='2026-02-25'}={}) {
  const key=clean(env.CALCOM_API_KEY);
  if (!key) throw fail('calcom_not_configured',503);
  let res;
  try { res=await fetcher(`https://api.cal.com/v2/${path}`,{headers:{Authorization:`Bearer ${key}`,'cal-api-version':version},redirect:'error',signal:AbortSignal.timeout(12000)}); }
  catch { throw fail('calcom_transport_failed',502); }
  if (!res.ok) throw fail('calcom_provider_failed',502);
  const data=await res.json().catch(()=>null);
  if (data?.status !== 'success' || !data.data) throw fail('calcom_invalid_response',502);
  return data.data;
}
function verifySignature(raw,signature,secret) {
  if (!/^[a-f0-9]{64}$/i.test(clean(signature))) return false;
  const expected=createHmac('sha256',secret).update(raw).digest();
  return timingSafeEqual(expected,Buffer.from(signature,'hex'));
}
async function reconcile({uid,request=supabaseFetch,fetcher=fetch,env=process.env,user,isAdmin=false,depth=0}) {
  if (!bookingUid(uid) || depth>4) throw fail('invalid_booking');
  const b=await calGet(`bookings/${encodeURIComponent(uid)}`,{fetcher,env});
  if (b.uid !== uid || !Number.isInteger(b.eventTypeId)) throw fail('calcom_invalid_response',502);
  const event=await calGet(`event-types/${b.eventTypeId}`,{fetcher,env,version:'2026-06-12'});
  // Verify the actual configured event, not just a same-named event or untrusted webhook fields.
  if (clean(event.bookingUrl).replace(/\/$/,'') !== `https://cal.com/${CAL_LINK}`) throw fail('booking_event_not_allowed',403);
  const existing=rows(await request(`/commercial_bookings?calcom_booking_id=eq.${encodeURIComponent(uid)}&select=*&limit=1`))[0];
  let ctx=null;
  const contextId=b.metadata?.spaceBookingContext;
  if (uuid(contextId)) ctx=rows(await request(`/commercial_booking_contexts?id=eq.${contextId}&select=*&limit=1`))[0] || null;
  // Metadata lost on reschedule: inherit only a provider-confirmed predecessor relation.
  if (!ctx && bookingUid(b.rescheduledFromUid)) {
    const previous=rows(await request(`/commercial_bookings?calcom_booking_id=eq.${encodeURIComponent(b.rescheduledFromUid)}&select=*&limit=1`))[0];
    if(previous) ctx={id:previous.booking_context_id,sdr_uid:previous.sdr_uid,voice_call_id:previous.voice_call_id,lead_id:previous.lead_id,opportunity_id:previous.opportunity_id};
  }
  if (existing?.sdr_uid && ctx?.sdr_uid && (existing.sdr_uid!==ctx.sdr_uid || existing.voice_call_id!==ctx.voice_call_id)) throw fail('booking_context_conflict',409);
  const owner=existing?.sdr_uid || ctx?.sdr_uid;
  if(user && (!owner || (!isAdmin && owner!==user.sub))) throw fail('booking_not_found',404);
  const start=iso(b.start),end=iso(b.end),updated=iso(b.updatedAt);
  if(!start || !end || end<=start || !updated) throw fail('calcom_invalid_response',502);
  const status=clean(b.status).toLowerCase();
  if(!['accepted','pending','cancelled','rejected'].includes(status)) throw fail('calcom_unknown_status',502);
  const attendee=b.attendees?.[0]||{},host=b.hosts?.[0]||{};
  const row={calcom_booking_id:uid,calcom_event_type_id:b.eventTypeId,status:b.rescheduledToUid?'rescheduled':status==='accepted'?'confirmed':['cancelled','rejected'].includes(status)?'cancelled':'pending',start_at:start,end_at:end,timezone:attendee.timeZone||host.timeZone||null,attendee_name:clean(attendee.name),attendee_email:clean(attendee.email),attendee_phone:clean(attendee.phoneNumber),host_name:clean(host.name),host_email:clean(host.email),sdr_uid:owner||null,voice_call_id:existing?.voice_call_id||ctx?.voice_call_id||null,lead_id:existing?.lead_id||ctx?.lead_id||null,opportunity_id:existing?.opportunity_id||ctx?.opportunity_id||null,booking_context_id:existing?.booking_context_id||ctx?.id||null,provider_updated_at:updated,cancelled_at:['cancelled','rejected'].includes(status)?updated:null,rescheduled_from:b.rescheduledFromUid||null,rescheduled_to:b.rescheduledToUid||null};
  const saved=await request('/rpc/space_upsert_commercial_booking',{method:'POST',body:{p_booking:row}});
  // Reconcile predecessor too; a failure returns non-2xx so provider retries, safely.
  if(depth===0 && bookingUid(b.rescheduledFromUid)) await reconcile({uid:b.rescheduledFromUid,request,fetcher,env,user,isAdmin,depth:depth+1});
  if(bookingUid(b.rescheduledToUid)) return reconcile({uid:b.rescheduledToUid,request,fetcher,env,user,isAdmin,depth:depth+1});
  return model(Array.isArray(saved.data)?saved.data[0]:saved.data);
}
module.exports={CAL_LINK,list,context,reconcile,verifySignature,bookingUid,fail};
