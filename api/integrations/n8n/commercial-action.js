const crypto=require('node:crypto');
const {readJsonBody,sendJson}=require('../../_lib/http');
const {executeCommercialAction}=require('../../_lib/commercial-action-engine');
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return sendJson(res,405,{error:'method_not_allowed'});
 const expected=String(process.env.COMMERCIAL_ACTION_SECRET||'').trim();
 const supplied=String(req.headers['x-space-commercial-secret']||'').trim();
 if(expected.length<32)return sendJson(res,503,{error:'commercial_action_not_configured'});
 if(Buffer.byteLength(supplied)!==Buffer.byteLength(expected)||!crypto.timingSafeEqual(Buffer.from(supplied),Buffer.from(expected)))return sendJson(res,401,{error:'unauthorized'});
 try{const body=await readJsonBody(req);const result=await executeCommercialAction(body);return sendJson(res,200,result);}
 catch(e){const code=/^[A-Z0-9_]+$/.test(e?.code||'')?e.code:'COMMERCIAL_ACTION_FAILED';console.error('[commercial-action]',{code});return sendJson(res,503,{error:code,action_allowed:false});}
};
