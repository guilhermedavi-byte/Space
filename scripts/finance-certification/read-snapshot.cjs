// Bounded read cache for dry-run only, populated from real production SELECTs.
const {uuid}=require('../../api/_lib/finance-domain');
async function readSnapshot(store,request,connectionId){
  uuid(connectionId);const capturedAt=new Date().toISOString();
  const read=async(table,order)=>{const rows=[];for(let offset=0;offset<20000;offset+=500){const r=await request('/'+table+'?connection_id=eq.'+connectionId+'&order='+order+'&offset='+offset+'&limit=500');if(!Array.isArray(r.data))throw Error('snapshot_invalid');rows.push(...r.data);if(r.data.length<500)return rows;}throw Error('snapshot_limit');};
  const [receivables,links,objects]=await Promise.all([read('finance_receivables','asaas_payment_id'),read('finance_customer_student_links','asaas_customer_id,firestore_doc_id'),read('finance_provider_objects','resource,external_object_id')]);
  const byId=new Map(receivables.map(r=>[r.asaas_payment_id,r]));const identity=new Map();for(const l of links){const a=identity.get(l.asaas_customer_id)||[];a.push(l.firestore_doc_id);identity.set(l.asaas_customer_id,a);}const objectById=new Map(objects.map(o=>[o.resource+':'+o.external_object_id,o]));
  const view={rpc:async(action,args)=>{if(args.connection_id!==connectionId)throw Error('snapshot_scope_invalid');if(action==='get')return args.resource==='payments'?byId.get(args.external_object_id)||null:objectById.get(args.resource+':'+args.external_object_id)||null;if(action==='identity')return identity.get(args.customer_id)||[];if(action==='connection'||action==='health'&&!args.health)return store.rpc(action,args);throw Error('snapshot_read_only');},localPaymentIds:async(c,{offset=0,limit=100})=>{if(c!==connectionId)throw Error('snapshot_scope_invalid');const ids=receivables.map(r=>r.asaas_payment_id);return {ids:ids.slice(offset,offset+limit),hasMore:ids.length>offset+limit};}};
  return {store:view,capturedAt,rows:{receivables:receivables.length,links:links.length,objects:objects.length}};
}
module.exports={readSnapshot};
