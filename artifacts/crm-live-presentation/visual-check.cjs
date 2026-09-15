const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');
const { chromium } = require('playwright');
const root = require('path').resolve(__dirname, '../..');
const output = __dirname;
const { buildHtml } = require(root + '/api/crm-live');
const { buildWeeklyNewsScreens } = require(root + '/api/_lib/crm-live');
const testSource = fs.readFileSync(root + '/tests/crm-live-boot.test.js', 'utf8');
const payload = vm.runInNewContext(testSource.slice(testSource.indexOf('const createPayload ='), testSource.indexOf('\nconst flush =')) + '\ncreatePayload()');
payload.weekly.commercialWeek = { startDateKey: '2030-01-01', endDateKey: '2030-01-07' };
payload.weekly.sdrs = Array.from({length:9}, (_,i)=>({personId:'person-'+i,displayName:i===1?'Maria Alexandra de Albuquerque Vasconcelos e Silva dos Santos': ['Luana Mendonça','Ayres André','Felipe Santos'][i%3]+' '+i,actualValue:[75,18,17,10,0,30,16,2,9][i],targetValue:30,progressPct:[250,60,56.67,33.33,0,100,53.33,6.67,30][i],photoURL:'',missingToLead:15,leaderName:'Maria Alexandra de Albuquerque Vasconcelos e Silva dos Santos'}));
payload.news = buildWeeklyNewsScreens({weekly:{sdrs:payload.weekly.sdrs},weeklyRollups:[{peopleProgress:{sdrs:payload.weekly.sdrs.map(r=>({personId:r.personId,actualValue:17}))}}]});
fs.writeFileSync(output + '/payload.json',JSON.stringify(payload,null,2));
(async()=>{
 const browser = await chromium.launch({executablePath:process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const results=[];
 for(const [width,height] of [[1920,1080],[1366,768],[1280,720],[1080,1920]]) for(const split of [false,true]){
  if(split&&height>width)continue;
  const page=await browser.newPage({viewport:{width,height}});
  await page.clock.install({time:new Date(split ? '2030-01-07T15:00:00Z' : '2030-01-03T15:00:00Z')});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*', async route=>{
   const url=route.request().url();
   if(url.endsWith('/tv/crm-live'))return route.fulfill({contentType:'text/html',body:buildHtml({buildId:'visual-qa'})});
   if(url.includes('/api/crm-live-data'))return route.fulfill({json:payload});
   if(url.includes('/api/crm-live-events'))return route.fulfill({json:{events:[]}});
   return route.abort();
  });
  await page.goto('http://localhost:4179/tv/crm-live');
  await page.waitForSelector('.crm-live-screen.is-active');
  const initialTitle=await page.locator('.crm-live-screen.is-active h1').textContent();
  await page.clock.fastForward(10000);
  assert.notEqual(await page.locator('.crm-live-screen.is-active h1').textContent(),initialTitle);
  await page.click('[data-crm-live-toggle]');
  assert.equal(await page.locator('.crm-live').evaluate(el=>el.classList.contains('is-deadline-mode')),split);
  const found=[];
  for(let step=0;step<18;step++){
   const active=page.locator('.crm-live-screen.is-active');
   const title=await active.locator('h1').textContent();
   if(title.includes('Ranking dos SDRs')||title==='Recorde pessoal'){
    const check=await active.evaluate(el=>{
     const issues=[];const body=el.querySelector('.crm-live-body').getBoundingClientRect();
     const rows=[...el.querySelectorAll('.crm-live-ranking-row')];
     let bottom=-Infinity;let barRight=null;
     for(const row of rows){
      const box=row.getBoundingClientRect();
      const bar=row.querySelector('.crm-live-ranking-bar').getBoundingClientRect();
      if(barRight!==null&&Math.abs(bar.right-barRight)>1)issues.push('bars misaligned');barRight=bar.right;
      if(box.top<bottom-1)issues.push('rows overlap');bottom=box.bottom;
      const copy=[...row.querySelector('.crm-live-ranking-copy').children].map(c=>c.getBoundingClientRect());
      for(let i=1;i<copy.length;i++)if(copy[i].top<copy[i-1].bottom-1)issues.push('copy overlaps');
      if(copy.at(-1).bottom>box.bottom+1)issues.push('copy exceeds row');
      const name=row.querySelector('.crm-live-ranking-name').getBoundingClientRect();
      const avatar=row.querySelector('.crm-live-avatar').getBoundingClientRect();
      if(avatar.right>name.left+1)issues.push('avatar overlaps name');
      const pct=row.querySelector('.crm-live-ranking-pct').getBoundingClientRect();
      if(name.right>pct.left+1)issues.push('name overlaps percentage');
      if(pct.right>body.right+1)issues.push('percentage outside body');
      if(box.bottom>body.bottom+1)issues.push('row outside body');
      const footer=document.querySelector('.crm-live-footer').getBoundingClientRect();
      if(copy.at(-1).bottom>footer.top+1)issues.push('copy overlaps footer');
     }
     for(const selector of ['.crm-live-news-phrase','.crm-live-news-context']){
      const node=el.querySelector(selector);if(!node)continue;const b=node.getBoundingClientRect();
      if(b.bottom>body.bottom+1||b.top<body.top-1||b.right>body.right+1)issues.push(selector+' outside body');
     }
     return {issues,text:el.innerText};
    });
    found.push({title,...check});
    if((title.includes('1/3')||title.includes('2/3')||(title==='Recorde pessoal'&&check.text.includes('Maria Alexandra'))))await page.screenshot({path:`${output}/${width}x${height}-${split?'split':'full'}-${title.includes('Ranking')?title.slice(-3).replace('/','-'):'record'}.png`});
   }
   await page.click('[data-crm-live-next]');
  }
  assert.equal(new Set(found.filter(f=>f.title==='Recorde pessoal').map(f=>f.text)).size,9);
  assert.equal(new Set(found.filter(f=>f.title.includes('Ranking dos SDRs')).map(f=>f.title)).size,3);
  results.push({width,height,split,errors,found});
  await page.close();
 }
 fs.writeFileSync(output + '/layout-results.json',JSON.stringify(results,null,2));
 await browser.close();
 const failures=results.flatMap(r=>r.found.filter(x=>x.issues.length).map(x=>({viewport:[r.width,r.height],split:r.split,title:x.title,issues:x.issues})));
 console.log(JSON.stringify({viewports:results.length,failures},null,2));
 assert.equal(failures.length,0);assert.ok(results.every(r=>!r.errors.length));
})().catch(e=>{console.error(e);process.exitCode=1});
