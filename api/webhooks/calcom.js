const {sendJson}=require('../_lib/http');
const booking=require('../_lib/commercial-bookings');
const readRaw=async req=>{
  const chunks=[];let length=0;
  for await(const chunk of req){const b=Buffer.from(chunk);length+=b.length;if(length>262144)throw booking.fail('payload_too_large',413);chunks.push(b);}
  return Buffer.concat(chunks);
};
const createHandler=({request,fetcher,env=process.env}={})=>async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return sendJson(res,405,{error:'method_not_allowed'});
  try{
    const raw=await readRaw(req);
    const secret=String(env.CALCOM_WEBHOOK_SECRET||'').trim();
    if(secret&&!booking.verifySignature(raw,req.headers['x-cal-signature-256'],secret))throw booking.fail('invalid_signature',401);
    let event;try{event=JSON.parse(raw.toString('utf8'));}catch{throw booking.fail('invalid_json');}
    if(!['BOOKING_CREATED','BOOKING_CANCELLED','BOOKING_RESCHEDULED'].includes(event.triggerEvent))return sendJson(res,200,{ignored:true});
    if(!booking.bookingUid(event.payload?.uid))throw booking.fail('invalid_booking');
    // The webhook is only a notification. Even without a configured signature secret,
    // every field/ownership/status is independently read from Cal's fixed API origin.
    // Never persist the supplied payload, and never return booking/attendee data here.
    await booking.reconcile({uid:event.payload.uid,request,fetcher,env});
    return sendJson(res,200,{ok:true});
  }catch(e){return sendJson(res,e.status||500,{error:e.status&&e.status<500?e.message:'booking_sync_failed'});}
};
module.exports=createHandler();module.exports.createHandler=createHandler;
module.exports.config={api:{bodyParser:false}};
