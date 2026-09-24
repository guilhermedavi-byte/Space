'use strict';
const {daysBetween,tier}=require('./retention-health-engine');
const notice=s=>['cancellation_scheduled','notice_period'].includes(String(s||'').toLowerCase());
const state=s=>String(s||'').toLowerCase();
const rank={unknown:-1,healthy:0,attention:1,risk:2,critical:3};
function lifecycleContext(events=[],occurrences=[],on=new Date().toISOString()) {
 const ordered=events.filter(e=>e.occurred_at<=on).slice().sort((a,b)=>a.occurred_at.localeCompare(b.occurred_at)||String(a.id).localeCompare(String(b.id)));
 let recovery=null,latestRequest=null;
 const noticed=new Set();
 for(const e of ordered) {
  const before=state(e.state_before?.lifecycle_status),after=state(e.state_after?.lifecycle_status);
  if(notice(before)||notice(after))noticed.add(e.case_id);
  if(after==='cancellation_requested'&&before!==after) {latestRequest=e;recovery=null;}
  if(notice(after))recovery=null;
  if(after==='active' && (before==='cancellation_requested'||notice(before))) {
   recovery={started_at:e.occurred_at,type:notice(before)||noticed.has(e.case_id)||e.state_before?.notice_started_at?'post_notice_recovery':'post_cancellation_recovery',reason:null};
  }
 }
 // A new, explicitly recorded critical episode during recovery restarts that same recovery ladder.
 if(recovery)for(const o of occurrences.filter(o=>o.severity==='critical'&&o.opened_at<=on).sort((a,b)=>a.opened_at.localeCompare(b.opened_at))) {
  if(o.opened_at>recovery.started_at && daysBetween(recovery.started_at,o.opened_at)<=60)recovery={...recovery,started_at:o.opened_at,reason:'critical_occurrence'};
 }
 return {recovery,latestRequest};
}
function applyLifecycleHealth(score,{lifecycle,events=[],occurrences=[],on=new Date().toISOString()}={}) {
 const context=lifecycleContext(events,occurrences,on),s=state(lifecycle);
 let cap=null,reason=null,recovery=context.recovery,age=null;
 if(s==='cancellation_requested'){cap=25;reason='cancellation_requested';recovery=null;}
 else if(notice(s)){cap=10;reason='notice_period';recovery=null;}
 else if(s==='active'&&recovery) {
  age=daysBetween(recovery.started_at,on);
  const limits=recovery.type==='post_notice_recovery'?[35,55,74]:[44,64,79];
  cap=age<=14?limits[0]:age<=30?limits[1]:age<=60?limits[2]:null;
  if(cap!==null)reason=recovery.reason||recovery.type;
 }
 const raw=score.health_score_raw??null;
 const effective=raw===null?null:cap===null?raw:Math.min(raw,cap);
 const capTier=cap===null?'unknown':tier(cap);
 const baseTier=score.health_tier_effective||score.health_tier_raw||'unknown';
 const effectiveTier=rank[capTier]>rank[baseTier]?capTier:baseTier;
 const priority=notice(s)?0:s==='cancellation_requested'?1:effectiveTier==='critical'?2:effectiveTier==='risk'?3:effectiveTier==='attention'?4:effectiveTier==='healthy'?5:6;
 const pre=context.latestRequest;
 return {...score,health_score_effective:effective,health_tier_effective:effectiveTier,
  health_score:effective,health_tier:effectiveTier,health_cap:cap,health_cap_reason:reason,
  health_recovery_started_at:recovery?.started_at||null,health_recovery_type:recovery?.type||null,health_recovery_day:age,
  operational_priority:priority,
  pre_cancellation_health_score:pre?.pre_cancellation_health_score??null,
  pre_cancellation_health_tier:pre?.pre_cancellation_health_tier??null,
  pre_cancellation_health_at:pre?.pre_cancellation_health_at??null,
  lifecycle_overlay_version:'v1'};
}
module.exports={applyLifecycleHealth,lifecycleContext};
