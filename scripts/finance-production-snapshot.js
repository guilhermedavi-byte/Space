const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { FinanceError, externalId, uuid } = require('../api/_lib/finance-domain');
// Private, bounded read-backup. No rows, credentials or payloads go to stdout.
function productionSnapshotStore(store, { directory, request }) {
  if (!directory || !path.isAbsolute(directory)) throw new FinanceError('finance_snapshot_directory_required');
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const stat = fs.lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.mode & 0o077)) throw new FinanceError('finance_snapshot_directory_not_private');
  const save = async (action, args) => {
    let queries;
    const rows = [];
    if (action === 'acquire') {
      const c = uuid(args.connection_id), id = encodeURIComponent(externalId(args.external_object_id));
      queries = args.resource === 'payments' ? [
        `/finance_receivables?connection_id=eq.${c}&asaas_payment_id=eq.${id}&limit=2`,
        `/finance_payments?connection_id=eq.${c}&asaas_payment_id=eq.${id}&limit=2`,
      ] : [`/finance_provider_objects?connection_id=eq.${c}&resource=eq.${encodeURIComponent(args.resource)}&external_object_id=eq.${id}&limit=2`];
      if (args.event_id) queries.push(`/finance_webhook_events?connection_id=eq.${c}&id=eq.${uuid(args.event_id)}&select=id,event_type,external_object_id,processing_status,attempt_count,received_at,processed_at,last_error&limit=1`);
    } else if (action === 'configure') {
      rows.push({table:'connections',records:await store.rpc('preview_configure',args)});
      queries = [];
    } else if (action === 'link') {
      queries = [`/finance_customer_student_links?connection_id=eq.${uuid(args.connection_id)}&asaas_customer_id=eq.${encodeURIComponent(externalId(args.customer_id))}&firestore_doc_id=eq.${encodeURIComponent(args.firestore_doc_id)}&limit=1`];
    } else return;
    for (const query of queries) rows.push({table: query.split('?')[0].slice(1), records: (await request(query)).data});
    try {
      fs.writeFileSync(path.join(directory, randomUUID()+'.json'), JSON.stringify({captured_at:new Date().toISOString(),action,connection_id:args.connection_id||null,external_object_id:args.external_object_id||null,rows}), {flag:'wx',mode:0o600});
    } catch { throw new FinanceError('finance_snapshot_write_failed'); }
  };
  return {...store,rpc:async(action,args)=>{await save(action,args);return store.rpc(action,args);}};
}
module.exports = { productionSnapshotStore };
