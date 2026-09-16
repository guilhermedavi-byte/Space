const {assessStoredSnapshot}=require('../../api/_lib/crm-snapshot-publish');
const crypto=require('node:crypto');
async function backfill({store,month,ledger,source,existingPath}){
 if(!['2026-07','2026-08'].includes(month))throw Error('backfill_scope_rejected');
 const path=existingPath||`crmLiveSnapshots/commercial-certified-${month}-v4`;
 if(!/^crmLiveSnapshots\/[A-Za-z0-9_-]+$/.test(path))throw Error('backfill_scope_rejected');
 const prior=await store.read(path),before=assessStoredSnapshot(prior?.data.payload,ledger.rows,'month');
 if(before.status==='RECONCILED')return {month,status:'PASS',operation:'unchanged',financialDelta:0,dealIdDelta:0};
 const backupPath=`crmLiveSnapshotBackups/${crypto.createHash('sha256').update(path+':'+(prior?.version||'absent')).digest('hex')}`;
 const generatedAt=new Date().toISOString();
 const rows=ledger.rows.map(({name,sourceResponsibleName,sourceSdrName,...r})=>r);
 const payload={generatedAt,month:{period:{...ledger.period,monthKey:month},summary:{realizado:ledger.metrics.monthly_realized,totalVendas:rows.length}},
  snapshot:{scope:'month',status:'VALID',calculationVersion:4,calculatedAt:generatedAt,fetchCompleted:true,paginationCompleted:true,pagesFetched:source.pagesFetched,expectedPages:source.expectedPages,monthlyIncludedDeals:rows},
  certification:{basis:'production-certified-2dc073c',backupPath}};
 const after=assessStoredSnapshot(payload,ledger.rows,'month');if(after.status!=='RECONCILED')throw Error('backfill_validation_failed');
 const backup={targetPath:path,existed:!!prior,previousVersion:prior?.version||null,previousData:prior?.data||null,createdAt:generatedAt};
 await store.commit([{path:backupPath,data:backup,version:null},{path,data:{...(prior?.data||{}),payload,generatedAt,snapshot:payload.snapshot},version:prior?.version||null}]);
 const saved=await store.read(path),verified=assessStoredSnapshot(saved?.data.payload,ledger.rows,'month');
 if(verified.status!=='RECONCILED')throw Error('backfill_readback_failed');
 return {month,status:'PASS',operation:prior?'replaced_invalid':'created_missing',previousRevenue:before.revenue,revenue:verified.revenue,count:verified.deal_count,financialDelta:verified.delta,dealIdDelta:verified.comparison.differences.length,backupPath,path};
}
module.exports={backfill};
