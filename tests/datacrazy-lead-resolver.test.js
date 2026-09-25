const test = require('node:test');
const assert = require('node:assert/strict');
const { localMatches, remoteMatches, variants, phoneMatches } = require('../api/_lib/datacrazy-lead-resolver');
const { resolveDatacrazy, getQualificationPayload } = require('../api/_lib/space-phone-n8n');
const phone = '+14075917081';
const lead = { id: 'lead-ronaldo', name: 'Lead', phone };
const none = async () => ({ matches: [], incomplete: false });

test('reported phone variants include digits, E164, national and last eight', () => {
  assert.deepEqual(variants(phone), ['14075917081', '+14075917081', '4075917081', '75917081']);
  for (const stored of [phone, '1 (407) 591-7081', '4075917081', '75917081']) assert.equal(phoneMatches(stored, phone), true);
  assert.equal(phoneMatches('55475917081', phone), false);
});
for (const [table, row] of [
  ['n8n_estado_leads_comercial_space', { telefone_normalizado: '4075917081', datacrazy_contact_id: lead.id }],
  ['n8n_sales_call_outcome_enrichment_space', { raw_lead_match: { candidates: [lead] } }],
  ['n8n_datacrazy_alunos_space', { id_externo: 'business-not-lead', raw_payload: { id: 'business', lead } }],
  ['datacrazy_businesses', { payload: { id: 'business', lead } }],
]) test(`reported phone resolves real lead ID from ${table}`, async () => {
  const r = await resolveDatacrazy({ phone, request: async path => ({ data: path.startsWith('/'+table+'?') ? [row] : [] }), lookupRemote: async () => { throw Error('unnecessary remote lookup'); } });
  assert.equal(r.matched, true); assert.equal(r.datacrazyContactId, lead.id);
});
test('duplicate IDs collapse; different IDs across sources block handoff', async () => {
  for (const id of [lead.id, 'other-lead']) {
    const r = await resolveDatacrazy({ phone, request: async path => ({ data: path.startsWith('/n8n_estado') ? [{ telefone_normalizado: phone, datacrazy_contact_id: lead.id }] : path.startsWith('/n8n_datacrazy_alunos') ? [{ raw_payload: { lead: { ...lead, id } } }] : [] }), lookupRemote: none });
    assert.equal(r.matched, id === lead.id);
    if (id !== lead.id) assert.equal(r.reason, 'ambiguous_match');
  }
});
test('missing mirror is optional; infra, truncation and deal-only matches never succeed', async () => {
  const missing = await localMatches(phone, async () => { throw Object.assign(Error(), { code:'PGRST205' }); });
  assert.deepEqual(missing.matches, []);
  await assert.rejects(localMatches(phone, async () => { throw Object.assign(Error('db_offline'), { status: 503 }); }), /db_offline/);
  const r = await resolveDatacrazy({ phone, request: async () => ({data: Array(101).fill({})}), lookupRemote: async () => { throw Error('not safe'); } });
  assert.equal(r.reason,'match_search_incomplete');
  const noLead = await resolveDatacrazy({ phone, request: async () => ({data:[{id_externo:'deal',raw_payload:{id:'deal',lead:{phone}}}]}), lookupRemote:none });
  assert.equal(noLead.reason,'lead_not_found');
});
test('remote fallback uses certified read contract, checks actual phone and deduplicates', async () => {
  const seen=[];
  const r = await resolveDatacrazy({ phone, request: async()=>({data:[]}), lookupRemote: p => remoteMatches(p,{ base:'https://crm.test',apiKey:'test-secret',fetchImpl:async(url,opts)=>{
    assert.equal(opts.method,undefined); assert.equal(opts.redirect,'error');
    const u=new URL(url); assert.equal(u.pathname,'/api/v1/leads');seen.push(u.searchParams.get('search'));
    return {ok:true,json:async()=>({items:[lead,{id:'irrelevant',phone:'+5511999999999'}]})};
  }}) });
  assert.deepEqual(seen,variants(phone));assert.equal(r.leadId,lead.id);assert.equal(r.matches.length,1);
});
test('remote pagination, ambiguity and HTTP failure cannot yield false success', async () => {
  let page=0;
  const r=await remoteMatches(phone,{base:'https://crm.test',apiKey:'secret',fetchImpl:async()=>({ok:true,json:async()=>page++===0?Array(100).fill(lead):[{...lead,id:'second'}]})});
  assert.ok(r.matches.some(m=>m.datacrazyContactId==='second'));
  await assert.rejects(remoteMatches(phone,{base:'https://crm.test',apiKey:'secret',fetchImpl:async()=>({ok:false,status:401})}),e=>e.message==='datacrazy_remote_lookup_failed'&&e.upstreamStatus===401);
});
test('n8n qualification uses real profile name, never email as SDR name', async()=>{
  const r=await getQualificationPayload({callId:'call',request:async path=>({data:path.startsWith('/voice_calls')?[{id:'call',space_user_uid:'luana-uid',space_user_email:'luanamendonca@spaceschoolbr.com'}]:[]}),resolveNames:async rows=>{assert.equal(rows[0].space_user_uid,'luana-uid');return new Map([['luana-uid','Luana Mendonça']]);}});
  assert.equal(r.sdrName,'Luana Mendonça');assert.equal(r.sdrEmail,'luanamendonca@spaceschoolbr.com');
});
