// Offline verification; deploy/invoke commands are deliberately absent.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),bundle=path.join(root,'.commercial-certification-bundle');
function verify(){
 const dir=path.join(bundle,'.vercel/output/functions/api/certify.func'),m=JSON.parse(fs.readFileSync(path.join(dir,'audit-manifest.json')));
 for(const f of m.files){
  for(const p of [path.join(root,f.file),path.join(dir,f.file)])if(crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')!==f.sha256)throw new Error('runtime_hash_changed_reprepare');
 }
 const cfg=JSON.parse(fs.readFileSync(path.join(bundle,'.vercel/output/config.json'))),fn=JSON.parse(fs.readFileSync(path.join(dir,'.vc-config.json')));
 if(cfg.version!==3||cfg.routes.length!==2||cfg.routes[0].src!=='^/api/certify$'||cfg.routes[1].status!==404||fn.runtime!=='nodejs24.x')throw new Error('invalid_bundle_routes');
 if(fs.existsSync(path.join(bundle,'.vercel/output/static')))throw new Error('static_output_forbidden');
 return {files:m.files.length,expiresAt:m.expiresAt,expired:Date.now()>Date.parse(m.expiresAt),runtimeHashesMatch:true,deployExecuted:false};
}
if(require.main===module){try{console.log(JSON.stringify(verify()));}catch{process.stderr.write('Bundle verification failed.\n');process.exitCode=1;}}
module.exports={verify};
