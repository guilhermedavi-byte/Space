const {businessDisposition}=require('./business-disposition');
const rows=r=>Array.isArray(r?.data)?r.data:[];
const ratio=(numerator,denominator)=>({numerator,denominator,percent:denominator?100*numerator/denominator:null});
const empty=()=>({calls:0,answered:0,scheduled:0,bookings:0,done:0,unlinked:0});
function metrics(c){return {...c,attendance:ratio(c.answered,c.calls),callToBooking:ratio(c.scheduled,c.calls),answeredToBooking:ratio(c.scheduled,c.answered),bookingToDone:{...ratio(c.done,c.bookings),incomplete:c.unlinked>0}};}
async function conversion({request,calls,user,isAdmin,sdr,range,resolveNames,sdrs=[]}){
 if(!user?.sub)throw Object.assign(new Error('forbidden'),{status:403});
 const owner=isAdmin?(sdr&&sdr!=='all'?sdr:null):user.sub;
 const groups=new Map();const group=uid=>{if(!groups.has(uid))groups.set(uid,empty());return groups.get(uid);};
 if(isAdmin)for(const s of sdrs)if(!owner||s.uid===owner)group(s.uid);
 // Do not trust callers to pre-scope or pre-filter inputs.
 for(const c of calls){
  const time=Date.parse(c.started_at||c.created_at);
  if((owner&&c.space_user_uid!==owner)||!(time>=Date.parse(range.from)&&time<=Date.parse(range.to)))continue;
  const g=group(c.space_user_uid);const d=businessDisposition(c);g.calls++;g.answered+=Number(d.humanContact);g.scheduled+=Number(d.scheduled);
 }
 const bookings=[];
 for(let offset=0;;offset+=200){
  const page=rows(await request(`/commercial_bookings?select=id,sdr_uid,lead_id,start_at,status,rescheduled_to&status=eq.confirmed&start_at=gte.${encodeURIComponent(range.from)}&start_at=lte.${encodeURIComponent(range.to)}${owner?`&sdr_uid=eq.${encodeURIComponent(owner)}`:'&sdr_uid=not.is.null'}&order=start_at.asc,id.asc&offset=${offset}&limit=200`));
  bookings.push(...page);if(page.length<200)break;
 }
 let cursor=0;
 await Promise.all(Array.from({length:Math.min(4,bookings.length)},async()=>{
  while(cursor<bookings.length){
   const b=bookings[cursor++];if(!b.sdr_uid||(owner&&b.sdr_uid!==owner)||b.status!=='confirmed'||b.rescheduled_to)continue;
   const g=group(b.sdr_uid);g.bookings++;
   if(!b.lead_id){g.unlinked++;continue;}
   const candidates=rows(await request(`/sdr_meetings?select=id,status&lead_id=eq.${encodeURIComponent(b.lead_id)}&starts_at=eq.${encodeURIComponent(b.start_at)}&limit=2`));
   // Multiple bookings for one appointment cannot each claim the same completed meeting.
   if(candidates.length!==1||bookings.filter(other=>other.lead_id===b.lead_id&&Date.parse(other.start_at)===Date.parse(b.start_at)).length!==1){g.unlinked++;continue;}
   if(['attended','completed'].includes(candidates[0].status))g.done++;
  }
 }));
 const totals=empty();for(const g of groups.values())for(const key of Object.keys(totals))totals[key]+=g[key];
 const names=isAdmin?await resolveNames([...groups.keys()].map(space_user_uid=>({space_user_uid})),user):new Map();
 return { ...metrics(totals),updatedAt:new Date().toISOString(),temporalRule:'calls_started_at__bookings_start_at',...(isAdmin?{ranking:[...groups].map(([uid,g])=>({uid,displayName:names.get(uid)||'SDR sem nome cadastrado',...metrics(g)})).sort((a,b)=>b.scheduled-a.scheduled||b.calls-a.calls)}:{}) };
}
module.exports={conversion,ratio};
