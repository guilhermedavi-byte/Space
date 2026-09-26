const {businessDisposition}=require('./business-disposition');
const rows=r=>Array.isArray(r?.data)?r.data:[];
const ratio=(numerator,denominator)=>({numerator,denominator,percent:denominator?100*numerator/denominator:null});
const empty=()=>({calls:0,answered:0,scheduled:0,bookings:0,done:0,unlinked:0});
function metrics(c){return {...c,attendance:ratio(c.answered,c.calls),callToBooking:ratio(c.scheduled,c.calls),answeredToBooking:ratio(c.scheduled,c.answered),bookingToDone:{...ratio(c.done,c.bookings),...(c.unlinked?{percent:null}:{}),incomplete:c.unlinked>0}};}
async function conversion({request,calls,user,isAdmin,sdr,range,resolveNames,sdrs=[]}){
 if(!user?.sub)throw Object.assign(new Error('forbidden'),{status:403});
 const owner=isAdmin?(sdr&&sdr!=='all'?sdr:null):user.sub;
 const eligible=new Set((sdrs||[]).map(s=>s&&s.uid).filter(Boolean));
 const allowed=uid=>!isAdmin||eligible.has(uid);
 const groups=new Map();const group=uid=>{if(!groups.has(uid))groups.set(uid,empty());return groups.get(uid);};
 if(isAdmin)for(const s of sdrs)if(!owner||s.uid===owner)group(s.uid);
 // Do not trust callers to pre-scope or pre-filter inputs.
 for(const c of calls){
  const time=Date.parse(c.started_at||c.created_at);
  if((owner&&c.space_user_uid!==owner)||!allowed(c.space_user_uid)||!(time>=Date.parse(range.from)&&time<=Date.parse(range.to)))continue;
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
   const b=bookings[cursor++];if(!b.sdr_uid||(owner&&b.sdr_uid!==owner)||!allowed(b.sdr_uid)||b.status!=='confirmed'||b.rescheduled_to)continue;
   const g=group(b.sdr_uid);g.bookings++;
   const response=await request('/rpc/space_resolve_booking_meeting',{method:'POST',body:{p_booking_id:b.id}});
   const link=response.data;
   if(!link || link.booking_id!==b.id || link.meeting_status==='unresolved'){g.unlinked++;continue;}
   if(link.meeting_id && ['completed','show'].includes(link.meeting_status))g.done++;
  }
 }));
 const totals=empty();for(const g of groups.values())for(const key of Object.keys(totals))totals[key]+=g[key];
 const names=isAdmin?await resolveNames([...groups.keys()].map(space_user_uid=>({space_user_uid})),user):new Map();
 return { ...metrics(totals),updatedAt:new Date().toISOString(),temporalRule:'calls_started_at__bookings_start_at',...(isAdmin?{ranking:[...groups].map(([uid,g])=>({uid,displayName:names.get(uid)||'SDR sem nome cadastrado',...metrics(g)})).sort((a,b)=>b.scheduled-a.scheduled||b.calls-a.calls)}:{}) };
}
module.exports={conversion,ratio};
