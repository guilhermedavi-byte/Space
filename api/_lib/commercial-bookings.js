const { supabaseFetch } = require('./supabase-rest');
const { createHmac, timingSafeEqual, randomUUID } = require('node:crypto');
const CAL_LINK = 'team/closers-space-idiomas/reuniao-com-mentor-do-space';
// Verified from the real booking created through this exact published team event (2026-09-25).
const CAL_EVENT_TYPE_ID = 4640970;
const clean = x => String(x ?? '').trim();
const rows = result => Array.isArray(result?.data) ? result.data : [];
const fail = (code, status = 400) => Object.assign(new Error(code), { status });
const uuid = x => /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(clean(x));
const bookingUid = x => /^[A-Za-z0-9_-]{6,100}$/.test(clean(x));
const iso = x => Number.isFinite(Date.parse(x)) ? new Date(x).toISOString() : null;
const fields = 'id,calcom_booking_id,status,start_at,end_at,timezone,attendee_name,attendee_email,attendee_phone,host_name,sdr_uid,voice_call_id,lead_id,opportunity_id,updated_at,rescheduled_from,rescheduled_to,meeting_id,meeting_status,meeting_completed_at,match_method,source_type,source_id,context_payload';
const model = b => ({ id:b.id, bookingExternalId:b.calcom_booking_id, bookingConfirmed:b.status === 'confirmed', status:b.status, bookingStartAt:b.start_at, bookingEndAt:b.end_at, timezone:b.timezone, attendeeName:b.attendee_name, attendeeEmail:b.attendee_email, attendeePhone:b.attendee_phone, hostName:b.host_name, sdrUid:b.sdr_uid, voiceCallId:b.voice_call_id, leadId:b.lead_id, opportunityId:b.opportunity_id,meetingId:b.meeting_id,meetingStatus:b.meeting_status,meetingCompletedAt:b.meeting_completed_at,matchMethod:b.match_method,sourceType:b.source_type || 'internal_booking',sourceId:b.source_id || b.calcom_booking_id,contextPayload:b.context_payload || null });
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

async function manual({request=supabaseFetch,user,isAdmin,body={}}) {
  const sourceType = ['manual_booking','external_booking','call_only'].includes(clean(body.sourceType)) ? clean(body.sourceType) : 'manual_booking';
  const call = body.callId ? await callInScope(request, body.callId, user, isAdmin) : null;
  const start = iso(body.scheduledAt || body.startAt);
  if (!start) throw fail('booking_time_required',400);
  const end = iso(body.endAt) || new Date(Date.parse(start) + Math.max(15, Math.min(240, Number(body.durationMinutes) || 30)) * 60000).toISOString();
  const owner = call?.space_user_uid || clean(body.sdrUid) || user.sub;
  if (!isAdmin && owner !== user.sub) throw fail('forbidden',403);
  const sourceId = clean(body.sourceId) || randomUUID();
  const payload = {
    source_type: sourceType,
    source_id: sourceId,
    calcom_booking_id: `${sourceType}_${sourceId}`,
    calcom_event_type_id: CAL_EVENT_TYPE_ID,
    status: 'confirmed',
    start_at: start,
    end_at: end,
    timezone: clean(body.timezone) || null,
    attendee_name: clean(body.leadName || body.attendeeName || call?.lead_name),
    attendee_email: clean(body.leadEmail || body.attendeeEmail) || null,
    attendee_phone: clean(body.phone || body.attendeePhone || call?.to_number),
    host_name: clean(body.consultant || body.hostName) || null,
    host_email: clean(body.consultantEmail || body.hostEmail) || null,
    sdr_uid: owner,
    voice_call_id: call?.id || null,
    lead_id: clean(body.leadId || call?.lead_id) || null,
    opportunity_id: clean(body.opportunityId || call?.opportunity_id) || null,
    provider_updated_at: new Date().toISOString(),
    context_payload: { origin: sourceType, notes: clean(body.notes).slice(0,2000), createdBy: clean(user.sub), voiceCallId: call?.id || null },
  };
  const saved = await request('/rpc/space_upsert_commercial_booking',{method:'POST',body:{p_booking:payload}});
  const persisted = Array.isArray(saved.data) ? saved.data[0] : saved.data;
  if (!persisted?.id) throw fail('manual_booking_persist_failed',503);
  const linked = await request('/rpc/space_produce_calcom_meeting',{method:'POST',body:{p_booking_id:persisted.id,p_google_event_id:null,p_meet_link:null}});
  return model({...persisted,...(linked?.data || {})});
}

async function calGet(path,{fetcher=fetch,env=process.env,version='2026-02-25'}={}) {
  const key=clean(env.CALCOM_API_KEY);
  if (!key) throw fail('calcom_not_configured',503);
  let res;
  try { res=await fetcher(`https://api.cal.com/v2/${path}`,{headers:{Authorization:`Bearer ${key}`,'cal-api-version':version},redirect:'error',signal:AbortSignal.timeout(12000)}); }
  catch { throw fail('calcom_transport_failed',502); }
  if (!res.ok) {
    const body=await res.json().catch(()=>({}));
    const code=clean(body?.error?.code || body?.error?.type || body?.message || body?.error?.message).split(key).join('[REDACTED]').slice(0,180);
    console.warn('[calcom-provider]',JSON.stringify({operation:path.startsWith('bookings/')?'get_booking':'get_event_type',status:res.status,code}));
    throw fail('calcom_provider_failed',502);
  }
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
  // Team bookingUrl representations differ between Cal endpoints. Match the canonical
  // ID verified on the published event, never a supplied webhook slug or phone number.
  if (b.eventTypeId !== CAL_EVENT_TYPE_ID) throw fail('booking_event_not_allowed',403);
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
  const persisted=Array.isArray(saved.data)?saved.data[0]:saved.data;
  let googleEventId=null;
  try {
    const references=await calGet(`bookings/${encodeURIComponent(uid)}/references?type=google_calendar`,{fetcher,env});
    if(Array.isArray(references)) {
      const ids=[...new Set(references.filter(r=>r.type==='google_calendar').map(r=>clean(r.eventUid)).filter(Boolean))];
      if(ids.length===1)googleEventId=ids[0];
    }
  } catch { console.info('[calcom-meeting]',{code:'calendar_reference_unavailable',bookingId:persisted.id}); }
  let meetingUrl=null;
  try { const url=new URL(b.meetingUrl || b.location); if(url.protocol==='https:' && url.hostname==='meet.google.com')meetingUrl=url.href; } catch {}
  const link=await request('/rpc/space_produce_calcom_meeting',{method:'POST',body:{p_booking_id:persisted.id,p_google_event_id:googleEventId,p_meet_link:meetingUrl}});
  // Reconcile predecessor too; a failure returns non-2xx so provider retries, safely.
  if(depth===0 && bookingUid(b.rescheduledFromUid)) await reconcile({uid:b.rescheduledFromUid,request,fetcher,env,user,isAdmin,depth:depth+1});
  if(bookingUid(b.rescheduledToUid)) return reconcile({uid:b.rescheduledToUid,request,fetcher,env,user,isAdmin,depth:depth+1});
  return model({...persisted,...link.data});
}
module.exports={CAL_LINK,CAL_EVENT_TYPE_ID,list,context,manual,reconcile,verifySignature,bookingUid,fail};
