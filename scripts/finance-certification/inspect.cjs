const PAYMENT_FIELDS=['id','customer','subscription','status','deleted','value','netValue','dueDate','originalDueDate','billingType','invoiceUrl','bankSlipUrl','paymentDate','confirmedDate','clientPaymentDate','creditDate','estimatedCreditDate','dateCreated','refunds'];
const pickPayment=p=>Object.fromEntries(PAYMENT_FIELDS.filter(k=>Object.hasOwn(p,k)).map(k=>[k,k==='refunds'&&Array.isArray(p[k])?p[k].map(r=>({dateCreated:r.dateCreated,value:r.value,status:r.status})):p[k]]));
async function inspect(client,env=process.env){
  const inventory={};for(const resource of ['payments','customers','subscriptions']){const r=await client.request('/'+resource+'?limit=1&offset=0');inventory[resource]={total:r.totalCount,hasMore:r.hasMore};}
  const statuses={};for(const status of ['PENDING','OVERDUE','CONFIRMED','RECEIVED','RECEIVED_IN_CASH','REFUNDED']){const r=await client.request('/payments?limit=1&offset=0&status='+status);statuses[status]={total:r.totalCount,sample:r.data?.[0]?pickPayment(r.data[0]):null};}
  const hooks=await client.request('/webhooks?limit=100&offset=0');
  return {inventory,statuses,webhooks:{total:hooks.totalCount,hasMore:hooks.hasMore,data:hooks.data.map(w=>{let url;try{const u=new URL(w.url);url=u.origin+u.pathname;}catch{url='invalid';}return {id:w.id,url,enabled:w.enabled,interrupted:w.interrupted,sendType:w.sendType,events:w.events,authTokenPresent:!!w.authToken,matchesDedicated:!!w.authToken&&w.authToken===env.ASAAS_WEBHOOK_TOKEN,matchesLegacy:!!w.authToken&&[env.ASAAS_WEBHOOK_SECRET,env.N8N_WEBHOOK_SECRET].filter(Boolean).includes(w.authToken)};})}};
}
module.exports={inspect,pickPayment};
