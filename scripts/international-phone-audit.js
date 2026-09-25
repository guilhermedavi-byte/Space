// Run with an existing production environment. Dry-run by default; no secrets or phone values on stdout.
const fs=require('node:fs'),path=require('node:path');
const {inspectPhone}=require('../src/international-phone/core');
async function run({directory,apply=false}={}){
 if(!directory||!path.isAbsolute(directory))throw Error('private_snapshot_directory_required');
 fs.mkdirSync(directory,{recursive:true,mode:0o700});if(fs.lstatSync(directory).mode&0o077)throw Error('snapshot_directory_not_private');
 if(!process.env.SUPABASE_URL?.includes('mlpojyvwyqcrelagtgkw.supabase.co'))throw Error('production_environment_required');
 const sa=JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON||'{}');if(sa.project_id!=='plataforma-space')throw Error('production_firestore_required');
 const {listCollectionAsAdmin}=require('../api/_lib/firestore-admin');
 const {getGoogleAccessToken}=require('../_lib/google-service-account');
 const {FIRESTORE_BASE,encodeFields}=require('../api/_lib/firestore-rest');
 const {supabaseFetch}=require('../api/_lib/supabase-rest');
 const results=[],snapshots=[],summary={total:0,e164:0,normalizable:0,ambiguous:0,invalid:0,incomplete:0,empty:0,updated:0,skipped_conflict:0,sources:[]};
 const inspect=(source,rows,fields,kind)=>{
  const counts={source,total:0,e164:0,normalizable:0,ambiguous:0,invalid:0,incomplete:0,empty:0};
  for(const row of rows)for(const field of fields){if(row[field]==null||row[field]==='')continue;const raw=String(row[field]);const country=String(row.countryCode||row.country_code||'').toUpperCase();const p=inspectPhone(raw,{defaultCountry:/^[A-Z]{2}$/.test(country)?country:undefined,preferCountry:!!country});const category=p.e164?(p.e164===raw?'e164':'normalizable'):p.state;counts.total++;counts[category]++;summary.total++;summary[category]++;
   results.push({source,kind,id:row.firestoreDocId||row.id||null,field,raw,canonical:p.e164,state:category,country:p.country});
  }summary.sources.push(counts);
 };
 for(const [collection,fields] of [['users',['telefone','phone','telefoneWhatsapp','whatsapp','celular']],['crmContacts',['phone']],['leads',['whatsapp']],['contratos',['whatsapp']]]){const rows=await listCollectionAsAdmin(collection,{maxPages:100,decorate:false});snapshots.push({source:collection,records:rows.map(r=>Object.fromEntries(['firestoreDocId','countryCode',...fields].filter(k=>r[k]!=null).map(k=>[k,r[k]])))});inspect(collection,rows,fields,'firestore');}
 for(const source of require('./phone-audit-sources.json')){
  const rows=[];
  try { for(let offset=0;offset<100000;offset+=1000){const {data}=await supabaseFetch(`/${source.table_name}?select=${(source.table_name==='students'?['id',...source.fields]:source.fields).join(',')}&offset=${offset}&limit=1000`,{timeoutMs:15000});rows.push(...data);if(data.length<1000)break;if(offset===99000)throw Error('phone_audit_limit');}
  } catch(error) { summary.sources.push({source:source.table_name,blocked:error.code||'read_failed'});continue; }
  inspect(source.table_name,rows,source.fields,'supabase');
 }
 const stamp=new Date().toISOString().replace(/[:.]/g,'-');
 const report=path.join(directory,`${stamp}.json`);fs.writeFileSync(report,JSON.stringify({captured_at:new Date().toISOString(),summary,results,snapshots}),{flag:'wx',mode:0o600});
 // A privileged read-only SQL snapshot supplements the private identity table.
 const contactFile=path.join(directory,'contact-identities.json');
 if(fs.existsSync(contactFile)) { const contacts=JSON.parse(fs.readFileSync(contactFile));inspect('contact_identities',contacts,['phone_raw','normalized_phone'],'supabase');summary.sources=summary.sources.filter(x=>!(x.source==='contact_identities'&&x.blocked)); }
 if(apply){
  // Master Firestore only. Event/transport history and external n8n mirrors are not rewritten.
  const access=await getGoogleAccessToken({scope:'https://www.googleapis.com/auth/datastore'});
  const candidates=results.filter(r=>r.kind==='firestore'&&r.state==='normalizable');
  for(const row of candidates){
   if(results.some(other=>other.source===row.source&&other.id!==row.id&&other.canonical===row.canonical)){summary.skipped_conflict++;continue;}
   const url=`${FIRESTORE_BASE}/${row.source}/${encodeURIComponent(row.id)}`;const headers={Authorization:`Bearer ${access.accessToken}`,'Content-Type':'application/json'};
   const fresh=await fetch(url,{headers});if(!fresh.ok)throw Error('phone_backfill_read_'+fresh.status);const doc=await fresh.json();if(doc.fields?.[row.field]?.stringValue!==row.raw){summary.skipped_conflict++;continue;}
   const query=new URLSearchParams({'updateMask.fieldPaths':row.field,'currentDocument.updateTime':doc.updateTime});
   const saved=await fetch(url+'?'+query,{method:'PATCH',headers,body:JSON.stringify(encodeFields({[row.field]:row.canonical}))});
   if(saved.status===409||saved.status===412){summary.skipped_conflict++;continue;}if(!saved.ok)throw Error('phone_backfill_write_'+saved.status);
   const check=await fetch(url,{headers});if(!check.ok||(await check.json()).fields?.[row.field]?.stringValue!==row.canonical)throw Error('phone_backfill_verification_failed');summary.updated++;
  }
  for(const row of results.filter(r=>r.source==='students'&&r.state==='normalizable')) {
    if(results.some(other=>other.source===row.source&&other.id!==row.id&&other.canonical===row.canonical)){summary.skipped_conflict++;continue;}
    const {data}=await supabaseFetch(`/students?id=eq.${encodeURIComponent(row.id)}&phone=eq.${encodeURIComponent(row.raw)}`, {method:'PATCH',body:{phone:row.canonical}});
    if(data.length===1&&data[0].phone===row.canonical)summary.updated++;else summary.skipped_conflict++;
  }
 }
 fs.writeFileSync(path.join(directory,`${stamp}-summary.json`),JSON.stringify(summary,null,2),{flag:'wx',mode:0o600});
 console.log(JSON.stringify({report,...summary}));return summary;
}
module.exports={run};
if(require.main===module)run({directory:process.argv.find(x=>x.startsWith('--directory='))?.split('=')[1],apply:process.argv.includes('--apply')}).catch(e=>{console.error(e.code||e.message);process.exitCode=1;});
