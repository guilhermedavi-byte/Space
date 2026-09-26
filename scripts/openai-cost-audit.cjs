#!/usr/bin/env node
/*
  Read-only OpenAI organization usage audit.
  Requires OPENAI_ADMIN_KEY=sk-admin-...
  Does not print secrets, prompts, transcripts, or request content.
*/
const fs = require('fs');
const key = process.env.OPENAI_ADMIN_KEY || process.env.OPENAI_ADMIN_API_KEY;
if (!key || !key.startsWith('sk-admin-')) {
  console.error('Missing OPENAI_ADMIN_KEY=sk-admin-...');
  process.exit(2);
}
const day = process.env.OPENAI_AUDIT_DATE || new Date().toISOString().slice(0,10);
const start = Math.floor(new Date(`${day}T00:00:00Z`).getTime()/1000);
const end = Math.floor(new Date(`${day}T23:59:59Z`).getTime()/1000) + 1;
const base = 'https://api.openai.com/v1';
async function get(path) {
  const res = await fetch(base + path, { headers: { Authorization: `Bearer ${key}`, 'Content-Type':'application/json' }});
  const json = await res.json().catch(()=>({}));
  if (!res.ok) throw new Error(`${res.status} ${json.error?.message || res.statusText}`);
  return json;
}
async function paged(path) {
  const out=[]; let next=null;
  do {
    const sep = path.includes('?') ? '&' : '?';
    const json = await get(path + (next ? `${sep}page=${encodeURIComponent(next)}` : ''));
    out.push(...(json.data || []));
    next = json.next_page || null;
  } while (next);
  return out;
}
function qs(params){return new URLSearchParams(params).toString();}
function flattenBuckets(buckets){return buckets.flatMap(b => (b.results || []).map(r => ({start_time:b.start_time,end_time:b.end_time,...r})));}
function sum(rows, f){return rows.reduce((a,r)=>a+Number(r[f]||0),0);}
(async()=>{
  const common = { start_time:String(start), end_time:String(end), bucket_width:'1d', limit:'31' };
  const group = ['project_id','api_key_id','model'];
  const groupParams = new URLSearchParams(common);
  for (const g of group) groupParams.append('group_by', g);
  const [compBuckets, audioBuckets, costBuckets] = await Promise.all([
    paged(`/organization/usage/completions?${groupParams}`),
    paged(`/organization/usage/audio_transcriptions?${groupParams}`),
    paged(`/organization/costs?${new URLSearchParams({...common, group_by:'project_id'})}`),
  ]);
  const completions = flattenBuckets(compBuckets).map(r => ({
    project_id:r.project_id||'', api_key_id:r.api_key_id||'', model:r.model||'',
    requests:Number(r.num_model_requests||0), input_tokens:Number(r.input_tokens||0),
    output_tokens:Number(r.output_tokens||0), cached_tokens:Number(r.input_cached_tokens||0),
  }));
  const audio = flattenBuckets(audioBuckets).map(r => ({
    project_id:r.project_id||'', api_key_id:r.api_key_id||'', model:r.model||'',
    requests:Number(r.num_model_requests||0), audio_seconds:Number(r.seconds||0),
    audio_minutes:Number(r.seconds||0)/60,
  }));
  const costs = flattenBuckets(costBuckets).map(r => ({project_id:r.project_id||'', cost_usd:Number(r.amount?.value||0), currency:r.amount?.currency||'usd'}));
  const report = {
    date: day,
    completions_summary: {requests:sum(completions,'requests'), input_tokens:sum(completions,'input_tokens'), output_tokens:sum(completions,'output_tokens'), cached_tokens:sum(completions,'cached_tokens')},
    audio_transcriptions_summary: {requests:sum(audio,'requests'), audio_seconds:sum(audio,'audio_seconds'), audio_minutes:sum(audio,'audio_minutes')},
    costs_summary: {cost_usd: costs.reduce((a,r)=>a+r.cost_usd,0)},
    completions,
    audio_transcriptions: audio,
    costs,
  };
  console.log(JSON.stringify(report, null, 2));
})().catch(err => { console.error('openai_cost_audit_failed:', err.message); process.exit(1); });
