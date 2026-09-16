const {supabaseFetch}=require('./supabase-rest');
const {FINANCE_TABLE}=require('./finance-integrations');
const UNOWNED_FILTER='&or=(id_cobranca_externa.is.null,id_cobranca_externa.eq.)';
const deny=()=>{const e=new Error('finance_asaas_authoritative');e.code='finance_asaas_authoritative';e.status=409;throw e;};
async function assertLegacyFinancialWrite({id,body={},request=supabaseFetch}){
  if(String(body.id_cobranca_externa||'').trim())deny();
  if(!id)return;
  const r=await request(`/${FINANCE_TABLE}?id=eq.${encodeURIComponent(id)}&select=id,id_cobranca_externa&limit=1`);
  if(!Array.isArray(r.data))throw Error('finance_ownership_read_failed');
  if(r.data.some(row=>String(row.id_cobranca_externa||'').trim()))deny();
}
module.exports={assertLegacyFinancialWrite,UNOWNED_FILTER};
