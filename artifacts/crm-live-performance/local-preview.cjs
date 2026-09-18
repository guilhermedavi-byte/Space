// Local-only visual fixture. Never used as evidence of production metrics.
const http = require('http'), fs = require('fs'), vm = require('vm');
const root = require('path').resolve(__dirname, '../..');
const source = fs.readFileSync(root+'/tests/crm-live-boot.test.js','utf8');
const payload = vm.runInNewContext(source.slice(source.indexOf('const createPayload ='),source.indexOf('\nconst flush ='))+'\ncreatePayload()');
payload.weekly.commercialWeek = {startDateKey:'2026-09-16',endDateKey:'2026-09-22'};
const rows = Array.from({length:5},(_,i)=>({personId:'visual-'+i,displayName:i===1?'Pessoa com nome extenso para validar a legibilidade do ranking':'Pessoa de teste '+(i+1),targetValue:20,actualValue:10,progressPct:50,photoURL:'',numerator:i?20:0,denominator:i?100:0,conversionRate:i?20:null}));
payload.weekly.sdrs=rows;
payload.conversions={sdr:rows,closers:rows.map(r=>({...r,role:'closer'}))};
payload.recordCandidates=rows.map((r,i)=>({...r,id:'record:'+r.personId,personName:r.displayName,role:i<3?'sdr':'closer',type:'personal_best',historicalBest:14,actualValue:12}));
payload.news=[];
http.createServer((req,res)=>{
 if(req.url.includes('/api/crm-live-data')){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(payload));}
 if(req.url.includes('/api/crm-live-events')){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({events:[]}));}
 if(req.url.startsWith('/tv/crm-live')){res.setHeader('Content-Type','text/html');return res.end(require(root+'/api/crm-live').buildHtml({buildId:'local-visual-only'}));}
 res.statusCode=404;res.end();
}).listen(4179,'127.0.0.1',()=>console.log('Local visual preview http://127.0.0.1:4179/tv/crm-live'));
