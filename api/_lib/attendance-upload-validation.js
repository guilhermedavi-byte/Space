const { fail } = require('./attendance-domain');
const { safeFilename } = require('./attendance-media');
const TYPES = {
 jpg:['image','image/jpeg',8],jpeg:['image','image/jpeg',8],png:['image','image/png',8],webp:['image','image/webp',8],
 mp4:['video','video/mp4',24],webm:['video','video/webm',24],pdf:['document','application/pdf',20],
 doc:['document','application/msword',20],docx:['document','application/vnd.openxmlformats-officedocument.wordprocessingml.document',20],
 xls:['document','application/vnd.ms-excel',20],xlsx:['document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',20],
 csv:['document','text/csv',2],txt:['document','text/plain',2],mp3:['audio','audio/mpeg',16],ogg:['audio','audio/ogg',16],
 m4a:['audio','audio/mp4',16],wav:['audio','audio/wav',16],
};
function uploadSpec(body) {
 const name=String(body.filename||'');const ext=name.split('.').pop().toLowerCase();const type=TYPES[ext];
 if(!type||!name||name.length>180||/[\x00-\x1f\\/]/.test(name))fail('upload_invalid_file',422);
 let [kind,mime,mb]=type;const declared=String(body.mime||'').toLowerCase().split(';')[0].trim();
 if(ext==='webm' && declared==='audio/webm'){kind='audio';mime='audio/webm';mb=16;}
 if(![mime,...(ext==='wav'?['audio/x-wav']:[]),...(ext==='m4a'?['audio/x-m4a']:[]),...(ext==='ogg'?['application/ogg']:[]),...(ext==='csv'?['application/vnd.ms-excel','text/plain']:[])].includes(declared))fail('upload_invalid_mime',422);
 if(!Number.isSafeInteger(body.size)||body.size<=0||body.size>mb*1024*1024)fail('upload_too_large',422);
 if(body.voice_note && kind!=='audio')fail('upload_invalid_file',422);
 return {filename:safeFilename(name),ext,kind,mime,size:body.size,voice_note:body.voice_note===true,duration:Math.max(0,Math.min(7200,Number(body.duration)||0))};
}
async function validateBytes(buffer,spec) {
 if(buffer.length!==spec.size)fail('upload_size_mismatch',422);
 if(['txt','csv'].includes(spec.ext)){
   let decoded;try{decoded=new TextDecoder('utf-8',{fatal:true}).decode(buffer);}catch{fail('upload_invalid_file',422);}
   if(/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(decoded)||/<\s*(?:!doctype\s+html|html|script|iframe|svg|object|embed)\b|javascript\s*:/i.test(decoded))fail('upload_invalid_file',422);
   return;
 }
 if(spec.ext==='pdf' && /\/(?:JavaScript|JS|Launch|EmbeddedFile)\b/.test(buffer.toString('latin1')))fail('upload_invalid_file',422);
 const {fileTypeFromBuffer}=await import('file-type');const detected=await fileTypeFromBuffer(buffer).catch(()=>null);
 if(['doc','xls'].includes(spec.ext)) {
   // Legacy Office is a compound binary document. Inspect stream names, reject VBA/macros.
   if(!buffer.subarray(0,8).equals(Buffer.from('d0cf11e0a1b11ae1','hex')))fail('upload_invalid_file',422);
   const CFB=require('cfb');let doc;try{doc=CFB.read(buffer,{type:'buffer'});}catch{fail('upload_invalid_file',422);}
   const names=doc.FullPaths||[];
   if(names.some(n=>/VBA|Macros|_VBA_PROJECT|ObjectPool/i.test(n))||!names.some(n=>spec.ext==='doc'?/\/WordDocument$/.test(n):/\/(Workbook|Book)$/.test(n)))fail('upload_invalid_file',422);
   return;
 }
 if(!detected || !(detected.mime===spec.mime || (spec.mime==='audio/webm'&&detected.mime==='video/webm') || (spec.mime==='audio/mp4'&&['video/mp4','audio/x-m4a'].includes(detected.mime))))fail('upload_invalid_file',422);
 if(['docx','xlsx'].includes(spec.ext)){
   // file-type identifies OOXML; forbid embedded macros/active payloads in its ZIP directory.
   if(/vbaProject\.bin|embeddings\/|\.html\b|\.js\b/i.test(buffer.toString('latin1')))fail('upload_invalid_file',422);
 }
}
module.exports={uploadSpec,validateBytes,TYPES};
