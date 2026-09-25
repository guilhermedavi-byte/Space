// One callback per original voice call. Time-derived states survive offline clients.
const rows = r => Array.isArray(r?.data) ? r.data : [];
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const fields = 'id,space_user_uid,lead_id,opportunity_id,lead_name,to_number,callback_at,callback_status';
const scope = ({ user, isAdmin, sdr }) => {
  if (!user?.sub) throw fail('forbidden', 403);
  const uid = isAdmin ? (sdr && sdr !== 'all' ? sdr : '') : user.sub;
  return uid ? `&space_user_uid=eq.${encodeURIComponent(uid)}` : '';
};
const status = (row, now = Date.now()) => {
  if (['completed', 'cancelled'].includes(row.callback_status)) return row.callback_status;
  const delta = new Date(row.callback_at).getTime() - now;
  return delta < -60000 ? 'overdue' : delta <= 0 ? 'due' : row.callback_status === 'snoozed' ? 'snoozed' : 'scheduled';
};
async function list({ request, user, isAdmin, sdr }) {
  const result = rows(await request(`/voice_calls?select=${fields}&callback_at=not.is.null&callback_status=in.(scheduled,snoozed)${scope({user,isAdmin,sdr})}&order=callback_at.asc,id.asc&limit=1000`));
  return result.map(r => ({ id:r.id, sdrUid:r.space_user_uid, name:r.lead_name || '', number:r.to_number, leadId:r.lead_id, opportunityId:r.opportunity_id, callbackAt:r.callback_at, callbackStatus:status(r) }));
}
async function update({ request, user, isAdmin, id, patch, now = Date.now() }) {
  if (!/^[a-f0-9-]{36}$/i.test(String(id))) throw fail('invalid_call_id');
  const filter = `id=eq.${id}${scope({user,isAdmin})}`;
  const current = rows(await request(`/voice_calls?select=${fields}&${filter}&limit=1`))[0];
  if (!current) throw fail('call_not_found',404);
  const action = patch.action;
  const body = { updated_at:new Date(now).toISOString() };
  if (action === 'callback_complete' || action === 'callback_cancel') {
    body.callback_status = action === 'callback_complete' ? 'completed' : 'cancelled';
  } else {
    const at = new Date(patch.callbackAt).getTime();
    if (!Number.isFinite(at) || at <= now) throw fail('callback_future_time_required');
    body.callback_at = new Date(at).toISOString();
    body.callback_status = action === 'callback_snooze' ? 'snoozed' : 'scheduled';
  }
  const saved = rows(await request(`/voice_calls?${filter}`,{method:'PATCH',body,headers:{Prefer:'return=representation'}}))[0];
  if (!saved) throw fail('callback_not_saved',409);
  return {ok:true,callback:{id,callbackAt:saved.callback_at,callbackStatus:status(saved,now)}};
}
module.exports = { list, update, status, scope };
