// Deletes only the generated bundle's manifest-listed files; refuses unknown files.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),bundle=path.join(root,'.commercial-certification-bundle');
function clean(){
 if(!fs.existsSync(bundle))return;
 const prefix='.vercel/output/functions/api/certify.func/';
 const m=JSON.parse(fs.readFileSync(path.join(bundle,prefix,'audit-manifest.json')));
 if(m.purpose!=='commercial_read_only_certification')throw new Error('invalid_bundle');
 const allowed=new Set([...m.files.map(f=>prefix+f.file),prefix+'index.js',prefix+'audit-manifest.json',prefix+'.vc-config.json','.vercel/output/config.json','.vercel/project.json','vercel.json','package.json']);
 const files=[],dirs=[];
 function scan(dir){for(const name of fs.readdirSync(dir)){const p=path.join(dir,name),s=fs.lstatSync(p);if(s.isSymbolicLink())throw new Error('symlink_refused');if(s.isDirectory())scan(p);else{if(!allowed.has(path.relative(bundle,p)))throw new Error('unknown_bundle_file');files.push(p);}}dirs.push(dir);}
 scan(bundle);for(const p of files)fs.unlinkSync(p);for(const p of dirs)fs.rmdirSync(p);
}
if(require.main===module){clean();console.log('Generated bundle removed; source and reports preserved.');}
module.exports={clean};
