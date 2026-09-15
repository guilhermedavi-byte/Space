// Transitional projection into Firestore. Supabase remains the authority.
// Every retry reloads the latest subscription state; CAS prevents stale delivery.
const service = require('./student-lifecycle');
async function syncProjection(studentId, { load=service.getForStudent, read, write } = {}) {
  if (!read || !write) {
    const firestore = require('./firestore-rest');
    const { getGoogleAccessToken } = require('../../_lib/google-service-account');
    const token = (await getGoogleAccessToken({ scope: 'https://www.googleapis.com/auth/datastore' })).accessToken;
    read = async id => {
      const response = await firestore.firestoreGetDocument({docPath:`users/${id}`,idToken:token});
      if (!response.ok) throw new Error('lifecycle_projection_student_unavailable');
      return { fields: firestore.decodeFields(response.data), updateTime: response.data.updateTime };
    };
    write = async (id, fields, updateTime) => {
      const { FIRESTORE_BASE, encodeFields, requestJson } = firestore;
      const params = new URLSearchParams({ 'currentDocument.updateTime': updateTime });
      Object.keys(fields).forEach(field => params.append('updateMask.fieldPaths',field));
      const result = await requestJson(`${FIRESTORE_BASE}/users/${encodeURIComponent(id)}?${params}`, {
        method:'PATCH', headers:{Authorization:`Bearer ${token}`}, body:encodeFields(fields) });
      if (!result.ok) throw Object.assign(new Error('lifecycle_projection_conflict'),{status:result.status});
    };
  }
  for (let attempt=0; attempt<4; attempt++) {
    const latest = await load(studentId);
    const rows = service.contracts(latest);
    const revision = rows.reduce((sum,row) => sum + Number(row.version || 0),0);
    const existing = await read(studentId);
    if (Number(existing.fields.lifecycleRevision || 0) > revision) return { stale:true };
    const chosen = service.effective(latest);
    const churn = service.getChurnDate(chosen);
    const projection = { lifecycle:chosen, lifecycleSubscriptions:rows, lifecycleRevision:revision,
      ativo:service.isActiveOn(latest,new Date()),
      // Current/future SP dates have -03 offset; policy decisions themselves use date keys.
      lifecycleLastActiveDay:service.getLastActiveDate(chosen) ? new Date(`${service.getLastActiveDate(chosen)}T00:00:00Z`) : null,
      lifecycleChurnAt:churn ? new Date(`${churn}T00:00:00-03:00`) : null };
    if (Number(existing.fields.lifecycleRevision || 0) === revision &&
      JSON.stringify(existing.fields.lifecycle) === JSON.stringify(chosen) && existing.fields.ativo === projection.ativo) return { idempotent:true };
    try { await write(studentId,projection,existing.updateTime); return { updated:true, revision }; }
    catch (error) { if (![409,412].includes(error.status) || attempt===3) throw error; }
  }
}
async function drainProjections(limit=50) {
  const { supabaseFetch } = require('./supabase-rest');
  const { data } = await supabaseFetch(`/outbox_events?aggregate_type=eq.retention_case&projection_delivered_at=is.null&order=created_at.asc&limit=${Math.min(500,Math.max(1,limit))}`);
  const report = { delivered:0, failed:0 };
  for (const event of data || []) {
    const id=event.payload?.firestore_student_id;
    if (!id) { report.failed++; continue; } // Legacy events need reconciliation; never guess identity.
    try {
      await syncProjection(id);
      await supabaseFetch(`/outbox_events?id=eq.${encodeURIComponent(event.id)}`,{method:'PATCH',body:{projection_delivered_at:new Date().toISOString()}});
      report.delivered++;
    } catch { report.failed++; }
  }
  return report;
}
module.exports={syncProjection,drainProjections};
