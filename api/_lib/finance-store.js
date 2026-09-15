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
  return {rpc};
}
module.exports={createFinanceStore,safeFinanceError};
