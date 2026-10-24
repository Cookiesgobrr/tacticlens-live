// Read-only browser verification; never contacts a generation endpoint.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFileSync,mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
const target=process.env.TACTICLENS_URL??'http://127.0.0.1:5187/';
const server=process.env.TACTICLENS_URL?null:spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5187','--strictPort'],{cwd:new URL('../',import.meta.url),stdio:'ignore'});
const directory=new URL('../test-results/live/',import.meta.url).pathname;mkdirSync(directory,{recursive:true});
let browser;
try{
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch(target)).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(ready);
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}:{})});
 const page=await browser.newPage({viewport:{width:1440,height:1050}}),requests=[],errors=[];
 page.on('request',r=>requests.push({url:r.url(),method:r.method(),headers:r.headers()}));page.on('pageerror',e=>errors.push(e.message));
 await page.goto(target+'?seed=82&tour=off');
 await page.getByRole('button',{name:'2D pitch',exact:true}).click();
 const timeline=page.getByRole('slider',{name:'Match timeline'}),preview=page.locator('.live-cache-preview');
 await preview.locator('summary').click();await preview.getByRole('checkbox',{name:'Use verified live-test cache'}).check();
 assert.ok((await page.getByTestId('live-cache-status').innerText()).includes('Waiting'));
 await timeline.fill('4680');assert.equal(requests.filter(r=>r.url.includes('live-sim82-4680.25.json')).length,0);
 await timeline.fill('4680.25');
 await page.getByTestId('live-cache-status').filter({hasText:'Verified · protected live-test result'}).waitFor();
 const moment=page.getByTestId('foundry-moment');assert.equal(await moment.getAttribute('data-source-mode'),'protected-live-test');
 assert.equal(+(await moment.getAttribute('data-moment-time')),4680.25);assert.ok((await page.locator('.new-score').innerText()).includes('3 : 2'));
 await page.getByText('Agent trace, all evidence & broadcast exports',{exact:true}).click();
 assert.equal(await page.locator('.new-ai-stage').count(),3);
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export AI moment JSON',exact:true}).click();
 const exported=JSON.parse(readFileSync(await (await download).path(),'utf8'));
 assert.equal(exported.livePublication.authorizationId,'issue40-seed82-winner');assert.equal(exported.livePublication.pack.cards.length,1);
 assert.equal(exported.text,(await page.getByTestId('editorial-commentary').innerText()).replace(/\s+/g,' ').trim());
 assert.ok(exported.livePublication.generationDisabledVerifiedAt);
 await page.getByText('Agent trace, all evidence & broadcast exports',{exact:true}).click();
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:directory+'desktop-live.png',fullPage:true});
 await preview.getByRole('checkbox').uncheck();assert.equal(await moment.getAttribute('data-source-mode'),'showcase');
 await preview.getByRole('checkbox').check();await page.getByTestId('live-cache-status').filter({hasText:'Verified'}).waitFor();
 await timeline.fill('4585.25');assert.equal(await moment.getAttribute('data-source-mode'),'showcase');
 await timeline.fill('4680.25');await page.getByTestId('live-cache-status').filter({hasText:'Verified'}).waitFor();
 assert.equal(await moment.getAttribute('data-source-mode'),'protected-live-test');
 await page.getByLabel('Track a player',{exact:true}).selectOption('20');await page.getByRole('button',{name:'Player',exact:true}).click();
 assert.equal(await page.getByTestId('foundry-moment').count(),0,'Wrong player must retain deterministic fallback');
 await page.getByRole('button',{name:'Fan',exact:true}).click();await page.getByRole('button',{name:'Analyst',exact:true}).click();
 assert.ok((await page.getByTestId('editorial-commentary').innerText()).includes('synthetic xG'));
 await page.getByRole('button',{name:'Fan',exact:true}).click();
 for(const width of [320,390]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:directory+`mobile-live-${width}.png`,fullPage:true});}
 await timeline.fill('0');assert.equal(await page.getByTestId('foundry-moment').count(),0);assert.ok((await page.getByTestId('live-cache-status').innerText()).includes('Waiting'));
 await page.getByRole('spinbutton',{name:'Reproducible match seed'}).fill('2027');await page.getByRole('button',{name:'Load',exact:true}).click();await timeline.fill('5400');
 assert.equal(await page.getByTestId('foundry-moment').count(),0);
 assert.equal(requests.filter(r=>r.url.includes('live-sim82-4680.25.json')).length,1,'One cache GET across toggles, rewinds, audiences and seeds');
 const allowedRead=url=>{const u=new URL(url);return u.origin==='https://tacticlens-api-2927.azurewebsites.net'&&u.pathname==='/api/session-feed/live-20261024-82'&&!u.search;};
 assert.ok(requests.every(r=>r.method==='GET'&&!r.headers['x-functions-key']&&!/services\.ai\.azure\.com|api\.openai\.com/.test(r.url)&&(!/azurewebsites\.net/.test(r.url)||allowedRead(r.url))),'Only the finite read-only session feed may contact Azure; never model access or keys');
 // Failure views read genuine showcase evidence; no fabricated live result.
 for(const kind of ['missing','tampered','network']){
  const failure=await browser.newPage({viewport:{width:390,height:844}});
  await failure.route('**/data/live-sim82-4680.25.json',async route=>{
   if(kind==='network')return route.abort();
   if(kind==='missing')return route.fulfill({status:404,body:'not published'});
   const broken=structuredClone(exported.livePublication);broken.pack.cards[0].moment.checks.score[0]=99;return route.fulfill({json:broken});
  });
  await failure.goto(target+'?seed=82&tour=off');await failure.getByRole('slider',{name:'Match timeline'}).fill('4680.25');
  await failure.locator('.live-cache-preview > summary').click();await failure.getByRole('checkbox',{name:'Use verified live-test cache'}).check();
  await failure.getByTestId('live-cache-status').filter({hasText:'Unavailable'}).waitFor();
  assert.equal(await failure.getByTestId('foundry-moment').getAttribute('data-source-mode'),'showcase');
  assert.ok((await failure.locator('.new-score').innerText()).includes('3 : 2'));
  if(kind==='tampered')await failure.screenshot({path:directory+'mobile-fallback.png',fullPage:true});
  await failure.close();
 }
 assert.deepEqual(errors,[]);
 console.log('Live-cache browser review passed: genuine record, one GET, no POST/keys/model exposure; finite session GET only, JSON parity, seek/player/seed isolation, 320/390/1440px, and missing/tampered/network fallback.');
}finally{await browser?.close();server?.kill();}
