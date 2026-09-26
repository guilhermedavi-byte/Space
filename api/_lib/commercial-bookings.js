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
const fields = 'id,calcom_booking_id,status,start_at,end_at,timezone,attendee_name,attendee_email,attendee_phone,host_name,host_email,sdr_uid,voice_call_id,lead_id,opportunity_id,updated_at,rescheduled_from,rescheduled_to,meeting_id,meeting_status,meeting_completed_at,match_method,source_type,source_id,context_payload,confirmed_at,confirmed_by,cancelled_at,cancelled_by,cancellation_reason,rescheduled_at,rescheduled_by,previous_start_at,previous_end_at,calendar_sync_status,calendar_sync_error,notification_5min_sent_at';
const model = b => ({ id:b.id, bookingExternalId:b.calcom_booking_id, bookingConfirmed:b.status === 'confirmed', status:b.status, bookingStartAt:b.start_at, bookingEndAt:b.end_at, timezone:b.timezone, attendeeName:b.attendee_name, attendeeEmail:b.attendee_email, attendeePhone:b.attendee_phone, hostName:b.host_name, hostEmail:b.host_email, sdrUid:b.sdr_uid, voiceCallId:b.voice_call_id, leadId:b.lead_id, opportunityId:b.opportunity_id,meetingId:b.meeting_id,meetingStatus:b.meeting_status,meetingCompletedAt:b.meeting_completed_at,matchMethod:b.match_method,sourceType:b.source_type || 'internal_booking',sourceId:b.source_id || b.calcom_booking_id,contextPayload:b.context_payload || null, confirmedAt:b.confirmed_at||null, confirmedBy:b.confirmed_by||null, cancelledAt:b.cancelled_at||null, cancelledBy:b.cancelled_by||null, cancellationReason:b.cancellation_reason||null, rescheduledAt:b.rescheduled_at||null, rescheduledBy:b.rescheduled_by||null, previousStartAt:b.previous_start_at||null, previousEndAt:b.previous_end_at||null, calendarSyncStatus:b.calendar_sync_status||'not_applicable', calendarSyncError:b.calendar_sync_error||null, notification5MinSentAt:b.notification_5min_sent_at||null });
async function callInScope(request, id, user, isAdmin) {
  if (!uuid(id)) throw fail('invalid_call');
  const c = rows(await request(`/voice_calls?id=eq.${encodeURIComponent(id)}&select=id,space_user_uid,lead_id,opportunity_id,lead_name,to_number&limit=1`))[0];
  if (!c || (!isAdmin && c.space_user_uid !== user.sub)) throw fail('call_not_found',404);
  return c;
}
async function bookingInScope(request, id, user, isAdmin) {
  if (!uuid(id)) throw fail('invalid_booking');
  const b = rows(await request(`/commercial_bookings?id=eq.${encodeURIComponent(id)}&select=${fields}&limit=1`))[0];
  if (!b || (!isAdmin && b.sdr_uid !== user.sub)) throw fail('booking_not_found',404);
  return b;
}
async function audit(request, booking, action, user, before, after) {
  await request('/commercial_booking_audit_events', { method:'POST', headers:{Prefer:'return=minimal'}, body:{ booking_id: booking.id, action, actor_uid: clean(user.sub), state_before: before || {}, state_after: after || {}, created_at: new Date().toISOString() } }).catch(()=>null);
}
async function markCalendarSync(request, booking, desiredAction) {
  // Google Calendar events are created by Cal.com. The current codebase has no certified
  // Google Calendar write credential/service for commercial events; keep this observable
  // instead of reporting false success. Cal.com webhooks/references remain the canonical sync path.
  const status = booking.calcom_booking_id && !String(booking.calcom_booking_id).startsWith('manual_booking_') && !String(booking.calcom_booking_id).startsWith('external_booking_') ? 'pending' : 'not_applicable';
  const error = status === 'pending' ? 'GOOGLE_CALENDAR_DIRECT_WRITE_NOT_CONFIGURED' : null;
  return { calendar_sync_status: status, calendar_sync_error: error, context_payload: { ...(booking.context_payload || {}), lastCalendarSyncAction: desiredAction, lastCalendarSyncAt: new Date().toISOString() } };
}
async function list({request=supabaseFetch,user,isAdmin,callId,sdr,status,from,to}) {
  if (callId) await callInScope(request,callId,user,isAdmin);
  const scope = isAdmin ? (clean(sdr) && clean(sdr) !== 'all' ? `&sdr_uid=eq.${encodeURIComponent(clean(sdr))}` : '') : `&sdr_uid=eq.${encodeURIComponent(user.sub)}`;
  const filter = [callId ? `voice_call_id=eq.${encodeURIComponent(callId)}` : '', clean(status)&&clean(status)!=='all' ? `status=eq.${encodeURIComponent(clean(status))}` : '', iso(from) ? `start_at=gte.${encodeURIComponent(iso(from))}` : '', iso(to) ? `start_at=lte.${encodeURIComponent(iso(to))}` : ''].filter(Boolean).map(x=>'&'+x).join('');
  return rows(await request(`/commercial_bookings?select=${fields}${scope}${filter}&order=start_at.asc&limit=300`)).map(model);
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


async function confirm({request=supabaseFetch,user,isAdmin,body={}}) {
  const b = await bookingInScope(request, clean(body.bookingId), user, isAdmin);
  if (b.status === 'cancelled') throw fail('booking_cancelled',409);
  const now = new Date().toISOString();
  const sync = await markCalendarSync(request, b, 'confirm');
  const patch = { status:'confirmed', confirmed_at: b.confirmed_at || now, confirmed_by: b.confirmed_by || user.sub, provider_updated_at: now, updated_at: now, ...sync };
  const out = rows(await request(`/commercial_bookings?id=eq.${encodeURIComponent(b.id)}`, { method:'PATCH', headers:{Prefer:'return=representation'}, body:patch }))[0];
  await audit(request, out || b, 'confirm', user, {status:b.status}, patch);
  return model(out || {...b,...patch});
}
async function reschedule({request=supabaseFetch,user,isAdmin,body={}}) {
  const b = await bookingInScope(request, clean(body.bookingId), user, isAdmin);
  if (b.status === 'cancelled') throw fail('booking_cancelled',409);
  const start = iso(body.startAt || body.scheduledAt);
  if (!start) throw fail('booking_time_required',400);
  const end = iso(body.endAt) || new Date(Date.parse(start) + Math.max(15, Math.min(240, Number(body.durationMinutes) || 30)) * 60000).toISOString();
  const now = new Date().toISOString();
  const sync = await markCalendarSync(request, b, 'reschedule');
  const patch = { status:'rescheduled', previous_start_at:b.start_at, previous_end_at:b.end_at, start_at:start, end_at:end, rescheduled_at:now, rescheduled_by:user.sub, provider_updated_at:now, updated_at:now, ...sync };
  const out = rows(await request(`/commercial_bookings?id=eq.${encodeURIComponent(b.id)}`, { method:'PATCH', headers:{Prefer:'return=representation'}, body:patch }))[0];
  await audit(request, out || b, 'reschedule', user, {start_at:b.start_at,end_at:b.end_at,status:b.status}, patch);
  await request('/rpc/space_produce_calcom_meeting',{method:'POST',body:{p_booking_id:b.id,p_google_event_id:null,p_meet_link:null}}).catch(()=>null);
  return model(out || {...b,...patch});
}
async function cancel({request=supabaseFetch,user,isAdmin,body={}}) {
  const b = await bookingInScope(request, clean(body.bookingId), user, isAdmin);
  const reason = clean(body.reason).slice(0,500);
  if (!reason) throw fail('cancellation_reason_required',400);
  const now = new Date().toISOString();
  const sync = await markCalendarSync(request, b, 'cancel');
  const patch = { status:'cancelled', cancelled_at: b.cancelled_at || now, cancelled_by: b.cancelled_by || user.sub, cancellation_reason: reason, provider_updated_at:now, updated_at:now, ...sync };
  const out = rows(await request(`/commercial_bookings?id=eq.${encodeURIComponent(b.id)}`, { method:'PATCH', headers:{Prefer:'return=representation'}, body:patch }))[0];
  await audit(request, out || b, 'cancel', user, {status:b.status}, patch);
  await request('/rpc/space_produce_calcom_meeting',{method:'POST',body:{p_booking_id:b.id,p_google_event_id:null,p_meet_link:null}}).catch(()=>null);
  return model(out || {...b,...patch});
}
async function premeetingNotifications({request=supabaseFetch,user,isAdmin,now=new Date()}) {
  const upper = new Date(now.getTime()+5*60000+30000).toISOString(), lower = new Date(now.getTime()-60000).toISOString();
  const scope = isAdmin ? `&sdr_uid=eq.${encodeURIComponent(user.sub)}` : `&sdr_uid=eq.${encodeURIComponent(user.sub)}`;
  const list = rows(await request(`/commercial_bookings?select=${fields}${scope}&status=in.(confirmed,pending)&start_at=gte.${encodeURIComponent(lower)}&start_at=lte.${encodeURIComponent(upper)}&notification_5min_sent_at=is.null&order=start_at.asc&limit=10`));
  const sent=[];
  for (const b of list) {
    const at = new Date().toISOString();
    const out = rows(await request(`/commercial_bookings?id=eq.${encodeURIComponent(b.id)}&notification_5min_sent_at=is.null`, { method:'PATCH', headers:{Prefer:'return=representation'}, body:{notification_5min_sent_at:at,updated_at:at} }))[0];
    if(out) sent.push(model(out));
  }
  return sent;
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
module.exports={CAL_LINK,CAL_EVENT_TYPE_ID,list,context,manual,confirm,reschedule,cancel,premeetingNotifications,reconcile,verifySignature,bookingUid,fail};
