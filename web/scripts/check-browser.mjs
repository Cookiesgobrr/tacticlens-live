import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
const root=new URL('../',import.meta.url);
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5179','--strictPort'],{cwd:root,stdio:'ignore'});
let browser;
try{
  let ready=false;
  for(let i=0;i<100;i++){
    try{if((await fetch('http://127.0.0.1:5179')).ok){ready=true;break;}}catch{}
    await new Promise(r=>setTimeout(r,100));
  }
  assert.ok(ready,'Vite must start');
  browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}: {})});
  const page=await browser.newPage({viewport:{width:1440,height:1050}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5179');
  const pitch=page.locator('.new-pitch');await pitch.waitFor();
  assert.equal(await pitch.locator('g[style]').count(),22);
  const timeline=page.getByRole('slider',{name:'Match timeline'});
  await timeline.fill('1200');
  await page.getByRole('button',{name:'Play',exact:true}).click();
  await page.waitForTimeout(1100);
  await page.getByRole('button',{name:'Pause',exact:true}).click();
  const elapsed=+(await timeline.inputValue())-1200;
  assert.ok(elapsed>.8&&elapsed<2,`1x wall-clock advance: ${elapsed}`);
  await page.getByRole('button',{name:'Restart',exact:true}).click();
  assert.equal(await timeline.inputValue(),'0');
  await page.getByRole('checkbox',{name:'Player stats'}).check();
  await timeline.fill('2700');
  mkdirSync(new URL('../test-results/',import.meta.url),{recursive:true});
  await page.screenshot({path:new URL('../test-results/desktop.png',import.meta.url).pathname,fullPage:true});
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow on mobile');
  await page.screenshot({path:new URL('../test-results/mobile.png',import.meta.url).pathname,fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('Browser smoke passed: 22 actors, seeking, wall-clock 1x, restart, stats, desktop/mobile layout.');
}finally{await browser?.close();server.kill();}
