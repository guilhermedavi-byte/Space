// LOCAL ONLY: consumes already-sanitized HTTP JSON, validates again before disk.
const fs=require('node:fs'),path=require('node:path');
const {sanitize}=require('./output.cjs');
async function persist(stream,directory){
  let text='';for await(const chunk of stream){text+=chunk;if(Buffer.byteLength(text)>3000000)throw new Error('report_too_large');}
  const result=sanitize(JSON.parse(text));
  if(!['PASS','FAIL'].includes(result.certification)||!Object.hasOwn(result,'writesAttempted'))throw new Error('invalid_report_schema');
  if(result.certification==='PASS'&&(!['authenticatedSourceLoaded','firestoreLoaded','datacrazyLoaded','sdrCertified','closerCertified'].every(k=>result[k]===true)||!['financialDelta','dealIdDelta','duplicateRevenue','unallocatedRevenue','writesAttempted'].every(k=>result[k]===0)))throw new Error('unsubstantiated_pass');
  const root=path.resolve(__dirname,'../../artifacts'),dest=path.resolve(directory);
  if(!dest.startsWith(root+path.sep))throw new Error('output_must_be_under_artifacts');
  fs.mkdirSync(dest,{recursive:true});
  fs.writeFileSync(path.join(dest,'result.json'),JSON.stringify(result,null,2),{mode:0o600,flag:'wx'});
  const rows=Object.entries(result.months||{}).map(([k,m])=>`| ${k} | ${m.monthlyRevenue} | ${m.weeklyRevenue} | ${m.monthlyWeeklyFinancialDelta} | ${m.monthlyWeeklyDealIdDelta} |`).join('\n');
  const markdown=`# Commercial production certification\n\nCertification: **${result.certification}**\n\nAuthenticated source loaded: ${result.authenticatedSourceLoaded}\n\nWrites attempted: ${result.writesAttempted}\n\n| Month | Monthly | Weekly | Financial delta | DealId delta |\n|---|---:|---:|---:|---:|\n${rows}\n\nSDR certified: ${result.sdrCertified}. Closer certified: ${result.closerCertified}.\n\nFull sanitized details: result.json.\n`;
  fs.writeFileSync(path.join(dest,'relatorio.md'),markdown,{mode:0o600,flag:'wx'});
}
if(require.main===module)persist(process.stdin,process.argv[2]||'').catch(()=>{process.stderr.write('Certification output rejected; no raw output logged.\n');process.exitCode=1;});
module.exports={persist};
