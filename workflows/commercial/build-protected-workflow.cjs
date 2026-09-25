// Offline transformer: source and destination exports contain credentials and MUST remain outside Git.
const fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');
function build(source,secret){
 const w=structuredClone(source);const node=name=>{const n=w.nodes.find(n=>n.name===name);if(!n)throw Error('Missing node '+name);return n;};
 const context=fs.readFileSync(path.join(__dirname,'context.js'),'utf8');
 const transcript=fs.readFileSync(path.join(__dirname,'transcript.js'),'utf8');
 node('Resolver contexto pós-call1').parameters.jsCode=context+`\nconst raw=$json; const businesses=Array.isArray(raw)?raw:raw.data||raw.businesses||[];
return [{json:resolveContext($('Normalizar chave da reunião1').first().json,$('Coletar vínculo SDR1').first().json.meetings||[],businesses)}];`;
 node('Coletar vínculo SDR1').parameters.jsCode=`const meetings=$input.all().flatMap(i=>Array.isArray(i.json)?i.json:Array.isArray(i.json.data)?i.json.data:i.json.id?[i.json]:[]);return [{json:{meetings}}];`;
 node('Supabase | localizar reunião do Meet1').parameters.queryParameters={parameters:[
  {name:'select',value:'*'}, {name:'meet_link',value:'=eq.{{ $json.meet_link }}'},
  {name:'starts_at',value:"=eq.{{ $json.vexa_data?.scheduled_at || '1970-01-01T00:00:00Z' }}"}, {name:'limit',value:'2'}]};
 node('Normalizar chave da reunião1').parameters.jsCode=node('Normalizar chave da reunião1').parameters.jsCode.replace('vexa_status: m.status || null,','vexa_status: m.status || null,\n    vexa_transcription_outcome: m.transcription_outcome || null,\n    recording_id: m.recording_id || m.recording?.id || null,');
 node('Montar transcrição CORRETA1').parameters.jsCode=transcript+`\nreturn [{json:transcriptEvidence($('Resolver contexto pós-call1').first().json,$json)}];`;
 node('Cruzar reunião + negócio + closer1').parameters.jsCode=context+`\nconst appointments=$('Agrupar reuniões scheduled1').first().json.reunioes||[];
const raw=$('Vexa | listar reuniões1').first().json;const meetings=raw.meetings||raw.data?.meetings||raw.data||[];
const businesses=Array.isArray($json)?$json:$json.data||$json.businesses||[];
return appointments.flatMap(a=>{const found=meetings.filter(m=>Date.parse(m.data?.scheduled_at)===Date.parse(a.starts_at)&&(m.constructed_meeting_url||m.data?.constructed_meeting_url)===a.meet_link);if(found.length!==1)return [];
const m=found[0];const ctx=resolveContext({meeting_id:m.id,vexa_meeting_id:m.id,meet_link:a.meet_link,vexa_attendees:m.data?.attendees||[],vexa_data:m.data||{},vexa_status:m.status,vexa_transcription_outcome:m.transcription_outcome,call_title:m.data?.title||'',vexa_found:true},[a],businesses);return [{json:{...ctx,age_minutes:(Date.now()-Date.parse(a.starts_at))/60000,needs_presence_check:Date.now()-Date.parse(a.starts_at)>=900000},pairedItem:0}];});`;
 node('Classificar presença +15 min1').parameters.jsCode=transcript+`\nreturn [{json:transcriptEvidence($('Vexa encontrou a call?1').item.json,$json)}];`;
 const endpoint='https://plataforma.spaceschoolbr.com/api/integrations/n8n/commercial-action';
 function params(action,sourceNode,preview=false){
  return {method:'POST',url:endpoint,sendHeaders:true,headerParameters:{parameters:[{name:'x-space-commercial-secret',value:secret}]},sendBody:true,specifyBody:'json',jsonBody:`={{ (()=>{const c=$('${sourceNode}').item.json; return {action:${JSON.stringify(action)},preview:${preview},workflow_version:'VEXACOMV7SPACE01/action-engine-v1',event_id:c.event_id||null,business_id:c.business_id,lead_id:c.lead_id,meeting:{id:c.meeting_id||c.vexa_meeting_id,recording_id:c.recording_id,calendar_uid:c.vexa_data?.calendar_uid||c.google_event_id,scheduled_at:c.vexa_data?.scheduled_at||c.starts_at,meet_link:c.meet_link,attendees:c.vexa_attendees||[]},evidence:c.evidence||{},note:$json.internal_note||null,attachment:{url:$json.drive_report_url,name:$json.report_filename,size:$json.report_file_size}};})() }}`,options:{timeout:120000}};
 }
 const post='Montar transcrição CORRETA1',period='Classificar presença +15 min1';
 const sinks={
  'DataCrazy | mover para No-show (mantém SDR)':['no_show',period],
  'DataCrazy | salvar resumo no histórico do lead':['note',post],
  'DataCrazy | nota interna No-show1':['no_show_note',period],
  'DataCrazy | no-show pós-call1':['no_show',post],
  'DataCrazy | mover Reunião Realizada + closer1':['attended',post],
  'DataCrazy | anexar arquivo ao lead1':['attachment',post],
  'Supabase | marcar attended1':['meeting_attended',period],
  'Supabase | marcar no_show1':['meeting_no_show',period],
  'Supabase | no_show pós-call1':['meeting_no_show',post],
  'Supabase | marcar completed1':['meeting_completed',post],
 };
 for(const [name,[action,sourceNode]]of Object.entries(sinks)){const n=node(name);n.parameters=params(action,sourceNode);delete n.credentials;delete n.continueOnFail;delete n.onError;n.retryOnFail=false;}
 // Every event is evaluated and audited before branching; auditing may continue
 // for eligible sales meetings even when attendance remains unknown.
 for(const [sourceNode,next,label]of [[post,'Lead participou da call?1','pós-call'],[period,'Lead entrou?1','periódico']]){
  const gateName=`Action Engine | avaliar ${label}`;const restoreName=`Action Engine | contexto ${label}`;
  const pos=node(sourceNode).position||[0,0];
  w.nodes.push({id:crypto.randomUUID(),name:gateName,type:'n8n-nodes-base.httpRequest',typeVersion:4.2,position:[pos[0]+100,pos[1]+200],parameters:params('attended',sourceNode,true),retryOnFail:false});
  w.nodes.push({id:crypto.randomUUID(),name:restoreName,type:'n8n-nodes-base.code',typeVersion:2,position:[pos[0]+300,pos[1]+200],parameters:{jsCode:`const c=$('${sourceNode}').item.json;const d=$json.decision||{};return [{json:{...c,commercial_action_eligibility:d,action_allowed:d.action_allowed===true,can_auto_stage:d.action_allowed===true,audit_eligible:d.meeting_type==='sales'&&d.identity_confidence==='exact'&&d.is_existing_student===false&&d.transcript_status==='available'&&!d.technical_failure_detected,attendance_confirmed:d.attendance_confirmed===true,no_show_confirmed:d.absence_confirmed===true,attendance_status:d.action_allowed?(d.attendance_confirmed?'attended':'no_show'):'pending'}}];`}});
  const edge=n=>({main:[[{node:n,type:'main',index:0}]]});w.connections[sourceNode]=edge(gateName);w.connections[gateName]=edge(restoreName);w.connections[restoreName]=edge(next);
 }
 node('Lead participou da call?1').parameters.conditions.conditions[0].leftValue='={{ $json.audit_eligible === true }}';
 // Write nodes remain gated by the action engine even if an old IF is bypassed.
 node('Tem negócio para Reunião Realizada?1').parameters.conditions.conditions[0].leftValue='={{ $json.business_found === true }}';
 // Audits/Drive files remain useful as evidence even when the CRM write is blocked.
 w.connections['Tem negócio para Reunião Realizada?1'].main[1]=[{node:'Drive | Upload transcrição1',type:'main',index:0}];
 w.active=false;w.pinData={};return w;
}
module.exports={build};
if(require.main===module){const [input,secretFile,output]=process.argv.slice(2);const w=build(JSON.parse(fs.readFileSync(input)),fs.readFileSync(secretFile,'utf8').trim());fs.writeFileSync(output,JSON.stringify(w,null,2),{mode:0o600});console.log(JSON.stringify({nodes:w.nodes.length,guardedSinks:10,output}));}
