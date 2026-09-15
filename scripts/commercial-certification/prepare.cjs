// OFFLINE ONLY: constructs a reviewable bundle; never invokes Vercel or reads env files.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),Module=require('node:module');
const root=path.resolve(__dirname,'../..');
function prepare({expiresAt=new Date(Date.now()+30*60000).toISOString(),destination=path.join(root,'.commercial-certification-bundle')}={}){
  if(!Number.isFinite(Date.parse(expiresAt))||Date.parse(expiresAt)<=Date.now()||Date.parse(expiresAt)>Date.now()+3600000)throw new Error('expiry_must_be_within_one_hour');
  if(path.resolve(destination)!==path.join(root,'.commercial-certification-bundle'))throw new Error('fixed_bundle_destination_required');
  if(fs.existsSync(destination))throw new Error('bundle_already_exists_remove_after_review');
  const functionDir=path.join(destination,'.vercel/output/functions/api/certify.func');
  const seen=new Set(),entries=[];
  function visit(file){
    file=path.resolve(file);if(seen.has(file))return;seen.add(file);
    const relative=path.relative(root,file);if(relative.startsWith('..')||!relative.match(/\.(?:js|cjs)$/))throw new Error('unsupported_dependency');
    const bytes=fs.readFileSync(file),text=bytes.toString();
    entries.push({file:relative,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
    const dest=path.join(functionDir,relative);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,bytes);
    for(const m of text.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)){
      const name=m[1];if(Module.isBuiltin(name))continue;
      if(!name.startsWith('.'))throw new Error('external_dependency_requires_review');
      visit(require.resolve(path.resolve(path.dirname(file),name)));
    }
  }
  for(const name of ['handler.cjs','worker.cjs','collect.cjs','guard.cjs','output.cjs'])visit(path.join(__dirname,name));
  const manifest={purpose:'commercial_read_only_certification',expiresAt,projectId:'prj_FcxsR8A6rXLVIo2DArdAFDlm7pq8',teamId:'team_QFoYBpP3YUXGD4agYHZ7I6jV',route:'/api/certify',requiredProtection:'all_except_custom_domains_or_stricter',files:entries.sort((a,b)=>a.file.localeCompare(b.file))};
  fs.writeFileSync(path.join(functionDir,'index.js'),"module.exports=require('./scripts/commercial-certification/handler.cjs').createHandler({manifest:require('./audit-manifest.json')});\n");
  fs.writeFileSync(path.join(functionDir,'audit-manifest.json'),JSON.stringify(manifest,null,2));
  fs.writeFileSync(path.join(functionDir,'.vc-config.json'),JSON.stringify({runtime:'nodejs24.x',handler:'index.js',launcherType:'Nodejs',shouldAddHelpers:true,maxDuration:300}));
  fs.writeFileSync(path.join(destination,'.vercel/output/config.json'),JSON.stringify({version:3,routes:[{src:'^/api/certify$',dest:'/api/certify'},{src:'/.*',status:404}]},null,2));
  fs.writeFileSync(path.join(destination,'.vercel/project.json'),JSON.stringify({projectId:manifest.projectId,orgId:manifest.teamId}));
  fs.writeFileSync(path.join(destination,'vercel.json'),JSON.stringify({version:2,framework:null}));
  fs.writeFileSync(path.join(destination,'package.json'),JSON.stringify({name:'temporary-commercial-certification',private:true,engines:{node:'24.x'}}));
  // Exactly one prebuilt function. No static output, frontend, cron or aliases.
  return manifest;
}
if(require.main===module){const m=prepare({expiresAt:process.argv[2]||undefined});console.log(JSON.stringify({files:m.files.length,expiresAt:m.expiresAt,route:m.route,deployExecuted:false}));}
module.exports={prepare};
