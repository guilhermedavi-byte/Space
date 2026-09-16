const { supabaseFetch } = require('./supabase-rest');
const { FinanceError } = require('./finance-domain');
const { AsaasError } = require('./asaas');
const SAFE_CODES = new Set(['finance_connection_inactive','finance_environment_mismatch','finance_account_mismatch',
  'finance_lease_lost','finance_event_not_found','finance_event_object_mismatch','finance_snapshot_id_mismatch','finance_run_not_found']);
function safeFinanceError(error) {
  if(error instanceof FinanceError || error instanceof AsaasError) return {code:error.code,retryable:error.retryable,status:error.status};
  return {code:'finance_storage_error',retryable:true,status:503};
}
function createFinanceStore({request=supabaseFetch}={}) {
  const rpc=async(action,args)=>{
    try {const result=await request('/rpc/finance_rpc',{method:'POST',body:{p_action:action,p_args:args}});return result.data;}
    catch(e){const code=SAFE_CODES.has(e.message)?e.message:'finance_storage_error'; throw new FinanceError(code,code==='finance_storage_error'||code==='finance_lease_lost',503);}
  };
  const localPaymentIds=async(connectionId,{offset=0,limit=100}={})=>{
    if(!/^[a-f0-9-]{36}$/i.test(connectionId)||!Number.isInteger(offset)||offset<0||!Number.isInteger(limit)||limit<1||limit>100)
      throw new FinanceError('finance_pagination_invalid');
    try {
      const result=await request(`/finance_receivables?connection_id=eq.${connectionId}&select=asaas_payment_id&order=asaas_payment_id&offset=${offset}&limit=${limit+1}`,{method:'GET'});
      if(!Array.isArray(result.data))throw new Error();
      return {ids:result.data.slice(0,limit).map(row=>row.asaas_payment_id),hasMore:result.data.length>limit};
    }catch{throw new FinanceError('finance_storage_error',true,503);}
  };
  return {rpc,localPaymentIds};
}
module.exports={createFinanceStore,safeFinanceError};
