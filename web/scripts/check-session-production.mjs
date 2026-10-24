// Public release regression: archived Foundry session should remain viewable
// without the Azure generator, with ordinary 1x pitch playback and no POSTs.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const base=process.env.TACTICLENS_URL??'https://cookiesgobrr.github.io/tacticlens-live/';
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?
  {executablePath:process.env.CHROMIUM_PATH,
   args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}: {})});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const requests=[];page.on('request',r=>requests.push({url:r.url(),method:r.method()}));
 await page.goto(base+'?seed=82&tour=off');
 const session=page.getByTestId('live-session');
 await session.waitFor({timeout:15000});
 await page.getByTestId('session-status').filter({hasText:'verified AI insights available'}).waitFor({timeout:18000});
 await session.getByRole('button',{name:'View completed AI history'}).click();
 const clock=page.getByRole('slider',{name:'Match timeline'});
 assert.ok(+(await clock.inputValue())>=5399,'Completed history advances to full-time evidence');
 assert.equal(await session.locator('.live-session-history>li[data-state=verified]').count(),9);
 assert.ok((await page.locator('.new-speed').innerText()).includes('1×'),'Server simulation speed is NOT spectator playback speed');
 assert.ok((await page.getByTestId('session-status').innerText()).includes('Verified insight available'));
 const first=session.locator('.live-session-history>li[data-state=verified]').first();
 await first.getByRole('button',{name:'Replay AI moment'}).click();
 assert.ok(+(await clock.inputValue())<5400,'Replay returns to actual footage');
 assert.ok((await page.locator('.new-speed').innerText()).includes('1×'));
 await page.getByRole('button',{name:'Pause',exact:true}).click();
 await page.setViewportSize({width:390,height:844});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),
  'Session history fits a mobile viewport');
 assert.ok(requests.every(r=>r.method==='GET'),'Replay and browsing cannot initiate model inference');
 await page.close();
 console.log('Public read-only AI history verified: nine real cached moments, no 30x leakage, no fake unavailable state, mobile responsive, GET only.');
}finally{await browser.close();}
