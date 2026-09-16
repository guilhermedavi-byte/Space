// Include historical customers omitted from the Asaas list so identity uniqueness
// is evaluated against the same customer universe as the financial portfolio.
async function completeCustomers(customers,ids,client){const found=new Set(customers.map(c=>c.id));const missing=[...new Set(ids)].filter(id=>id&&!found.has(id));let cursor=0;await Promise.all(Array.from({length:Math.min(4,missing.length)},async()=>{while(cursor<missing.length){const id=missing[cursor++];try{const row=await client.request('/customers/'+encodeURIComponent(id));if(row.id!==id)throw Error('customer_identity_mismatch');customers.push(row);}catch(e){if(e.code!=='asaas_not_found')throw e;customers.push({id,unavailable:true});}}}));return customers;}
module.exports={completeCustomers};
