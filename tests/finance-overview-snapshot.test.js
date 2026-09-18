const test=require('node:test'),assert=require('node:assert/strict');
const {writeOverviewSnapshot,readOverviewSnapshot,OVERVIEW_SNAPSHOT_SCHEMA}=require('../api/_lib/finance-dashboard-snapshot');
const C='11111111-1111-4111-8111-111111111111';

test('overview snapshot persists through finance rpc response envelope',async()=>{
 const calls=[],runs=[];
 const request=async(path,{method,body}={})=>{calls.push({path,method,body});
  if(path==='/rpc/finance_rpc'&&body.p_action==='run_start')return {data:{run_id:'22222222-2222-4222-8222-222222222222'}};
  if(path==='/rpc/finance_rpc'&&body.p_action==='run_update'){runs.push(body.p_args.report);return {data:{updated:true}};}
  if(path.startsWith('/finance_sync_runs'))return {data:runs.map((report,i)=>({id:String(i+1),report,started_at:report.snapshot_at,finished_at:report.snapshot_at}))};
  throw Error('unexpected_request');};
 const payload={meta:{revenue_policy:'backend_central_v1',overview_snapshot_schema:OVERVIEW_SNAPSHOT_SCHEMA},kpis:{revenue:1}};
 await writeOverviewSnapshot(C,'2026-09',payload,{request});
 const found=await readOverviewSnapshot(C,'2026-09',{request});
 assert.equal(found.payload.kpis.revenue,1);assert.equal(calls.filter(c=>c.path==='/rpc/finance_rpc').length,2);
});
