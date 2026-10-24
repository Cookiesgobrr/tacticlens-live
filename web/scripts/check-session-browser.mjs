// End-to-end OFFLINE coordinator -> real HTTP read -> React -> replay.
// Model calls use a slow fake. Never contacts Azure or a production Function.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
const root=new URL('../../',import.meta.url),target='http://127.0.0.1:5188/';
const api=spawn(process.env.PYTHON??'python',['-m','api.tests.session_browser_server'],{cwd:root,stdio:'inherit'});
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5188','--strictPort'],{
 cwd:new URL('../',import.meta.url),env:{...process.env,VITE_LIVE_SESSION_READ_ORIGIN:'https://session.offline.test'},stdio:'inherit'});
async function ready(url){for(let i=0;i<100;i++){try{if((await fetch(url)).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw Error('Test service unavailable');}
let browser;
try{
 await Promise.all([ready(target),ready('http://127.0.0.1:5190/')]);
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}: {})});
 const page=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push({url:r.url(),method:r.method()}));
 await page.route('https://session.offline.test/**',async route=>{
  const r=await fetch('http://127.0.0.1:5190/');await route.fulfill({json:await r.json()});
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
 await page.reload();await timeline.fill('840');await status.filter({hasText:'Verified insight available'}).waitFor();
 assert.equal(await page.locator('.live-session-history>li[data-state=verified]').count(),2);
 assert.equal((await (await fetch('http://127.0.0.1:5190/stats')).json()).calls,6,'Audience, replay, refresh never invoke model');
 assert.ok(requests.filter(r=>r.url.includes('session.offline.test')).every(r=>r.method==='GET'));
 assert.deepEqual(errors,[]);
 console.log('OFFLINE browser flow passed: two dynamic events, three mock agents each, real coordinator/verification/public reads, asynchronous states, editions, replay, refresh and 320–1440px. Azure calls: 0.');
}catch(error){
 console.error('OFFLINE diagnostics',await (await fetch('http://127.0.0.1:5190/')).json());
 if(browser?.contexts()[0]?.pages()[0]){mkdirSync(new URL('../test-results/session/',import.meta.url),{recursive:true});await browser.contexts()[0].pages()[0].screenshot({path:new URL('../test-results/session/failure.png',import.meta.url).pathname,fullPage:true});}
 throw error;
}finally{await browser?.close();server.kill();api.kill();}
