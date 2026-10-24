// End-to-end OFFLINE coordinator -> real HTTP read -> React -> replay.
// Model calls use a slow fake. Never contacts Azure or a production Function.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
const root=new URL('../../',import.meta.url),target='http://127.0.0.1:5188/';
const api=spawn(process.env.PYTHON??'python',['-m','api.tests.session_browser_server'],{cwd:root,stdio:'inherit'});
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5188','--strictPort'],{
 cwd:new URL('../',import.meta.url),env:{...process.env,VITE_LIVE_SESSION_READ_ORIGIN:'https://session.offline.test',VITE_LIVE_SESSION_ID:'offline-session-82'},stdio:'inherit'});
async function ready(url){for(let i=0;i<100;i++){try{if((await fetch(url)).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw Error('Test service unavailable');}
let browser,page,readStates=[];
try{
 await Promise.all([ready(target),ready('http://127.0.0.1:5190/')]);
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}: {})});
 page=await browser.newPage({viewport:{width:1440,height:1050}});const errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push({url:r.url(),method:r.method()}));
 await page.route('https://session.offline.test/**',async route=>{
  const r=await fetch('http://127.0.0.1:5190/');const data=await r.json();readStates.push(data.records.map(r=>[r.candidate.id,r.state]));await route.fulfill({json:data});
 });
 await page.goto(target+'?seed=82&tour=off&session=offline-session-82');
 await page.getByRole('button',{name:'2D pitch',exact:true}).click();
 const status=page.getByTestId('session-status'),timeline=page.getByRole('slider',{name:'Match timeline'});
 await status.filter({hasText:'Waiting for match events'}).waitFor();
 let job=fetch('http://127.0.0.1:5190/advance?at=60',{method:'POST'});
 await timeline.fill('60');await status.filter({hasText:'AI processing'}).waitFor();
 await status.filter({hasText:'Evidence verification'}).waitFor();assert.equal((await (await job).json()).status,'published');
 await status.filter({hasText:'Verified insight available'}).waitFor();
 assert.equal(await page.locator('.live-session-history>li[data-state=verified]').count(),1);
 await timeline.fill('840');job=fetch('http://127.0.0.1:5190/advance?at=840',{method:'POST'});
 await status.filter({hasText:/AI processing|Evidence verification/}).waitFor();assert.equal((await (await job).json()).status,'published');
 await status.filter({hasText:'Verified insight available'}).waitFor();
 assert.equal(await page.locator('.live-session-history>li[data-state=verified]').count(),2);
 assert.equal((await (await fetch('http://127.0.0.1:5190/stats')).json()).calls,6);
 const history=page.getByRole('list',{name:'AI Moments history'});
 const fan=await history.innerText();await page.getByLabel('AI moment perspective',{exact:true}).selectOption('analyst');assert.notEqual(await history.innerText(),fan);
 await page.getByLabel('AI moment perspective',{exact:true}).selectOption('player');
 assert.ok((await history.innerText()).includes('No verified analysis for the selected player'));
 await page.getByLabel('AI moment perspective',{exact:true}).selectOption('fan');
 await history.getByRole('button',{name:'Replay AI moment',exact:true}).first().click();
 assert.ok(+(await timeline.inputValue())<809,'Replay uses real pre-roll');
 await page.getByRole('button',{name:'Pause',exact:true}).click();
 await timeline.fill('840');
 mkdirSync(new URL('../test-results/session/',import.meta.url),{recursive:true});
 await page.screenshot({path:new URL('../test-results/session/desktop.png',import.meta.url).pathname,fullPage:true});
 console.log('SESSION_DESKTOP_PREVIEW='+(await page.locator('.live-session-preview').screenshot({type:'jpeg',quality:45})).toString('base64'));
 for(const width of [320,390]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:new URL(`../test-results/session/mobile-${width}.png`,import.meta.url).pathname,fullPage:true});}
 console.log('SESSION_MOBILE_PREVIEW='+(await page.locator('.live-session-preview').screenshot({type:'jpeg',quality:45})).toString('base64'));
 // A completed Azure session has its generation timer OFF, but its verified
 // history remains available. Prefer same-origin immutable mirror even if Azure
 // cannot be reached (simulated by explicitly aborting remote reads).
 const completedFeed={...(await (await fetch('http://127.0.0.1:5190/')).json()),
   status:'completed',generationEnabled:false,serviceAvailable:false,clock:840,speed:30};
 await page.route('**/data/session-offline-session-82.json',async route=>route.fulfill({json:completedFeed}));
 await page.route('https://session.offline.test/**',async route=>route.abort('failed'));
 await page.reload();
 await status.filter({hasText:'verified AI insights available'}).waitFor();
 assert.equal(await page.locator('.live-session-history>li[data-state=verified]').count(),0,
   'Archive history is spoiler-free until seeking or opening completed history');
 await page.getByRole('button',{name:'View completed AI history'}).click();
 assert.equal(await page.getByRole('list',{name:'AI Moments history'}).locator('li[data-state=verified]').count(),2);
 assert.ok((await page.locator('.new-speed').innerText()).includes('1×'),
   'Operator 30× acceleration must never control spectator playback');
 assert.ok((await status.innerText()).includes('Verified insight available'),
   'Disabled generator must not hide completed verified history');
 await page.getByRole('button',{name:'2D pitch',exact:true}).click();
 await timeline.fill('840');await status.filter({hasText:'Verified insight available'}).waitFor();
 assert.equal(await page.locator('.live-session-history>li[data-state=verified]').count(),2);
 assert.equal((await (await fetch('http://127.0.0.1:5190/stats')).json()).calls,6,'Audience, replay, refresh never invoke model');
 assert.ok(requests.filter(r=>r.url.includes('session.offline.test')).every(r=>r.method==='GET'));
 assert.deepEqual(errors,[]);
 console.log('OFFLINE browser flow passed: two dynamic events, three mock agents each, read-only same-origin completed archive with Azure unreachable, 30× operator clock stays 1× spectator playback, disabled generation retains verified history, replay, refresh and 320–1440px. Azure calls: 0.');
}catch(error){
 console.error('OFFLINE diagnostics',JSON.stringify(await (await fetch('http://127.0.0.1:5190/')).json()));
 console.error('UI_STATUS',await page?.getByTestId('session-status').innerText(),'READ_STATES',JSON.stringify(readStates));
 if(page)console.log('SESSION_FAILURE_PREVIEW='+(await page.locator('.live-session-preview').screenshot({type:'jpeg',quality:45})).toString('base64'));
 if(browser?.contexts()[0]?.pages()[0]){mkdirSync(new URL('../test-results/session/',import.meta.url),{recursive:true});await browser.contexts()[0].pages()[0].screenshot({path:new URL('../test-results/session/failure.png',import.meta.url).pathname,fullPage:true});}
 throw error;
}finally{await browser?.close();server.kill();api.kill();}
